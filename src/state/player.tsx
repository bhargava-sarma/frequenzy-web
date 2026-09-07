/**
 * Playback engine and queue.
 *
 * Two <audio> elements take turns: while one plays, the other pre-buffers the
 * next track, so hitting the end of a song swaps to something already loaded
 * instead of opening a fresh connection. Streams are always requested raw, so
 * what comes down the wire is the file on disk.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  coverArtUrl, getRandomSongs, getSimilarSongs, scrobble as apiScrobble, streamUrl,
} from '../lib/subsonic';
import { connection } from '../lib/connection';
import { isDownloaded, localStreamUrl } from '../lib/downloads';
import { songArtist } from '../lib/format';
import { recordPlay } from '../lib/history';
import type { Song } from '../lib/types';
import { useSettings } from './settings';

export type RepeatMode = 'off' | 'all' | 'one';

/** A sleep timer either counts down or waits for the track to finish. */
export interface SleepTimer {
  mode: 'countdown' | 'endOfTrack';
  /** Epoch ms the timer fires; ignored for 'endOfTrack'. */
  endsAt: number;
}

export interface PlaybackContextInfo {
  /** "Album", "Playlist", "Artist" — shown as "Playing from Album". */
  kind: string;
  name: string;
  id?: string;
}

export interface PlayerSnapshot {
  queue: Song[];
  index: number;
  current: Song | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
  sleepTimer: SleepTimer | null;
  /** True while autoplay is fetching more music to keep the queue alive. */
  extending: boolean;
  context: PlaybackContextInfo | null;
  error: string | null;
}

export interface PlayerActions {
  playQueue: (songs: Song[], startIndex: number, context?: PlaybackContextInfo) => void;
  playSong: (song: Song, context?: PlaybackContextInfo) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleAutoplay: () => void;
  setSleepTimer: (timer: SleepTimer | null) => void;
  playNext: (songs: Song[]) => void;
  playLater: (songs: Song[]) => void;
  removeAt: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  jumpTo: (index: number) => void;
  clearQueue: () => void;
}

type PlayerContextValue = PlayerSnapshot & { actions: PlayerActions };

const PlayerContext = createContext<PlayerContextValue | null>(null);

const QUEUE_KEY = 'frequenzy.queue.v1';
/** Start warming the next track this many seconds before the current one ends. */
const PRELOAD_LEAD = 20;

interface PersistedQueue {
  queue: Song[];
  original: Song[];
  index: number;
  time: number;
  shuffle: boolean;
  repeat: RepeatMode;
  context: PlaybackContextInfo | null;
}

function loadPersisted(): PersistedQueue | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedQueue;
    if (!Array.isArray(parsed.queue)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Fisher–Yates over a copy. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings, update: updateSettings } = useSettings();

  const persisted = useRef<PersistedQueue | null>(loadPersisted());

  const [queue, setQueue] = useState<Song[]>(persisted.current?.queue ?? []);
  const [original, setOriginal] = useState<Song[]>(persisted.current?.original ?? []);
  const [index, setIndex] = useState<number>(persisted.current?.index ?? -1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(persisted.current?.time ?? 0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(settings.volume);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(persisted.current?.shuffle ?? false);
  const [repeat, setRepeat] = useState<RepeatMode>(persisted.current?.repeat ?? 'off');
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  const [sleepTimer, setSleepTimerState] = useState<SleepTimer | null>(null);
  const [extending, setExtending] = useState(false);
  const [context, setContext] = useState<PlaybackContextInfo | null>(persisted.current?.context ?? null);
  const [error, setError] = useState<string | null>(null);

  const elements = useRef<[HTMLAudioElement, HTMLAudioElement] | null>(null);
  const activeSlot = useRef(0);
  /** Which song id is sitting on the inactive element, ready to go. */
  const preloadedId = useRef<string | null>(null);
  const scrobbled = useRef<Set<string>>(new Set());
  const seekOnLoad = useRef<number | null>(persisted.current?.time ?? null);
  const suppressAutoplay = useRef(persisted.current !== null);

  const current = index >= 0 && index < queue.length ? queue[index] : null;

  /* ------------------------------------------------------------- audio setup */

  if (elements.current === null && typeof Audio !== 'undefined') {
    const make = () => {
      const el = new Audio();
      el.preload = 'auto';
      // No crossOrigin: we never read the samples, and leaving it off means
      // playback keeps working even if the server omits CORS headers on /stream.
      return el;
    };
    elements.current = [make(), make()];
  }

  const activeEl = useCallback((): HTMLAudioElement | null => {
    return elements.current?.[activeSlot.current] ?? null;
  }, []);

  const idleEl = useCallback((): HTMLAudioElement | null => {
    return elements.current?.[1 - activeSlot.current] ?? null;
  }, []);

  /* ------------------------------------------------------------- persistence */

  /**
   * Persisting has to be split in two.
   *
   * `currentTime` ticks several times a second, so debouncing the whole payload
   * on it meant the timer was cleared before it ever fired and nothing was ever
   * written while music was playing. Queue shape is saved as it changes;
   * playback position is throttled separately and flushed when the page goes
   * away.
   */
  const latest = useRef({ queue, original, index, currentTime, shuffle, repeat, context });
  latest.current = { queue, original, index, currentTime, shuffle, repeat, context };

  const persistNow = useCallback(() => {
    const state = latest.current;
    try {
      const payload: PersistedQueue = {
        queue: state.queue.slice(0, 500),
        original: state.original.slice(0, 500),
        index: state.index,
        time: state.currentTime,
        shuffle: state.shuffle,
        repeat: state.repeat,
        context: state.context,
      };
      localStorage.setItem(QUEUE_KEY, JSON.stringify(payload));
    } catch {
      /* quota or private mode — playback is unaffected */
    }
  }, []);

  // Queue shape: write shortly after it settles.
  useEffect(() => {
    const handle = setTimeout(persistNow, 400);
    return () => clearTimeout(handle);
  }, [queue, original, index, shuffle, repeat, context, persistNow]);

  // Position: a slow heartbeat, plus a flush when the page is hidden or closed.
  useEffect(() => {
    const handle = setInterval(persistNow, 5000);
    const flush = () => persistNow();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      clearInterval(handle);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      persistNow();
    };
  }, [persistNow]);

  /* ---------------------------------------------------------------- playback */

  const srcFor = useCallback(
    (song: Song) => streamUrl(song.id, { raw: !settings.allowTranscoding }),
    [settings.allowTranscoding],
  );

  /**
   * Blob URLs handed out for downloaded tracks. They pin the bytes in memory,
   * so each is revoked as soon as the element stops pointing at it.
   */
  const objectUrls = useRef(new Map<string, string>());
  const releaseObjectUrl = useCallback((songId: string) => {
    const url = objectUrls.current.get(songId);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(songId);
    }
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  /** Guards against a fast skip resolving an older track's source last. */
  const loadToken = useRef(0);

  const advance = useRef<() => void>(() => {});

  /** Point the active element at a song and (optionally) start it. */
  const load = useCallback(
    (song: Song, autoplay: boolean, startAt = 0) => {
      const els = elements.current;
      if (!els) return;

      const idle = idleEl();
      // If the next track is already buffered on the idle element, swap to it —
      // this is what makes the gap between tracks essentially disappear.
      if (idle && preloadedId.current === song.id && idle.src) {
        const old = activeEl();
        if (old) {
          old.pause();
          old.removeAttribute('src');
          old.load();
        }
        activeSlot.current = 1 - activeSlot.current;
        preloadedId.current = null;
        const el = activeEl();
        if (el) {
          el.volume = muted ? 0 : volume;
          if (startAt) el.currentTime = startAt;
          // Its loadedmetadata already fired while it was the idle element, so
          // that handler ignored it — adopt the values now.
          setDuration(Number.isFinite(el.duration) ? el.duration : (song.duration ?? 0));
          setLoading(false);
          setError(null);
          if (autoplay) void el.play().catch(() => setPlaying(false));
        }
        return;
      }

      const el = activeEl();
      if (!el) return;
      setLoading(true);
      setError(null);
      el.volume = muted ? 0 : volume;
      seekOnLoad.current = startAt || null;

      const token = ++loadToken.current;
      const begin = (src: string) => {
        // A newer load started while we were resolving; drop this one.
        if (token !== loadToken.current) return;
        el.src = src;
        el.load();
        if (autoplay) {
          void el.play().catch(() => {
            setPlaying(false);
            setLoading(false);
          });
        }
      };

      // A downloaded track plays from disk, which also means it plays with no
      // server in reach at all.
      if (isDownloaded(song.id)) {
        void localStreamUrl(song.id).then((url) => {
          if (url) {
            objectUrls.current.set(song.id, url);
            begin(url);
          } else {
            begin(srcFor(song));
          }
        });
        return;
      }

      begin(srcFor(song));
    },
    [activeEl, idleEl, muted, srcFor, volume],
  );

  // Whenever the current song changes, load it.
  const lastLoadedId = useRef<string | null>(null);
  useEffect(() => {
    if (!current) {
      lastLoadedId.current = null;
      return;
    }
    if (lastLoadedId.current === current.id) return;
    if (lastLoadedId.current) releaseObjectUrl(lastLoadedId.current);
    lastLoadedId.current = current.id;

    const startAt = seekOnLoad.current ?? 0;
    const shouldAutoplay = !suppressAutoplay.current;
    suppressAutoplay.current = false;
    seekOnLoad.current = null;

    setCurrentTime(startAt);
    setDuration(current.duration ?? 0);
    load(current, shouldAutoplay, startAt);

    recordPlay(current);
    if (settings.scrobble && shouldAutoplay) {
      void apiScrobble(current.id, false).catch(() => {});
    }
  }, [current, load, releaseObjectUrl, settings.scrobble]);

  /* ------------------------------------------------------------ element wiring */

  useEffect(() => {
    const els = elements.current;
    if (!els) return;

    const onTimeUpdate = (event: Event) => {
      if (event.target !== activeEl()) return;
      const el = event.target as HTMLAudioElement;
      setCurrentTime(el.currentTime);

      if (el.buffered.length > 0) {
        setBuffered(el.buffered.end(el.buffered.length - 1));
      }

      // Half-way (or four minutes) is the conventional point to submit a play.
      const song = current;
      if (song && settings.scrobble && !scrobbled.current.has(song.id)) {
        const target = Math.min((song.duration ?? el.duration ?? 0) / 2, 240);
        if (target > 0 && el.currentTime >= target) {
          scrobbled.current.add(song.id);
          void apiScrobble(song.id, true).catch(() => {});
        }
      }
    };

    const onLoadedMetadata = (event: Event) => {
      if (event.target !== activeEl()) return;
      const el = event.target as HTMLAudioElement;
      setDuration(Number.isFinite(el.duration) ? el.duration : (current?.duration ?? 0));
      setLoading(false);
      if (seekOnLoad.current !== null) {
        el.currentTime = seekOnLoad.current;
        seekOnLoad.current = null;
      }
    };

    const onPlay = (event: Event) => {
      if (event.target !== activeEl()) return;
      setPlaying(true);
      setLoading(false);
    };
    const onPause = (event: Event) => {
      if (event.target !== activeEl()) return;
      setPlaying(false);
    };
    const onWaiting = (event: Event) => {
      if (event.target === activeEl()) setLoading(true);
    };
    const onPlaying = (event: Event) => {
      if (event.target === activeEl()) setLoading(false);
    };
    const onEnded = (event: Event) => {
      if (event.target !== activeEl()) return;
      advance.current();
    };
    const onError = (event: Event) => {
      if (event.target !== activeEl()) return;
      const el = event.target as HTMLAudioElement;
      if (!el.src) return;
      setLoading(false);
      setPlaying(false);
      setError(
        connection.state.status === 'offline'
          ? 'No server reachable. Frequenzy will reconnect automatically.'
          : 'This track could not be played.',
      );
    };

    for (const el of els) {
      el.addEventListener('timeupdate', onTimeUpdate);
      el.addEventListener('loadedmetadata', onLoadedMetadata);
      el.addEventListener('play', onPlay);
      el.addEventListener('pause', onPause);
      el.addEventListener('waiting', onWaiting);
      el.addEventListener('playing', onPlaying);
      el.addEventListener('ended', onEnded);
      el.addEventListener('error', onError);
    }
    return () => {
      for (const el of els) {
        el.removeEventListener('timeupdate', onTimeUpdate);
        el.removeEventListener('loadedmetadata', onLoadedMetadata);
        el.removeEventListener('play', onPlay);
        el.removeEventListener('pause', onPause);
        el.removeEventListener('waiting', onWaiting);
        el.removeEventListener('playing', onPlaying);
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('error', onError);
      }
    };
  }, [activeEl, current, settings.scrobble]);

  /* ------------------------------------------------------------------ actions */

  const jumpTo = useCallback(
    (target: number) => {
      if (target < 0 || target >= queue.length) return;
      preloadedId.current = null;
      setIndex(target);
    },
    [queue.length],
  );

  const next = useCallback(() => {
    if (queue.length === 0) return;
    if (index < queue.length - 1) {
      setIndex(index + 1);
    } else if (repeat === 'all') {
      setIndex(0);
    } else {
      const el = activeEl();
      el?.pause();
      setPlaying(false);
    }
  }, [activeEl, index, queue.length, repeat]);

  const previous = useCallback(() => {
    const el = activeEl();
    // Apple's rule: restart the track unless you press it again quickly.
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (index > 0) {
      preloadedId.current = null;
      setIndex(index - 1);
    } else if (repeat === 'all' && queue.length > 0) {
      preloadedId.current = null;
      setIndex(queue.length - 1);
    } else if (el) {
      el.currentTime = 0;
    }
  }, [activeEl, index, queue.length, repeat]);

  /**
   * Autoplay: when the queue runs out, keep the music going with songs like the
   * one that just finished. Falls back to a random pull if the server has no
   * similarity data for that track.
   */
  const extendQueue = useCallback(async (): Promise<boolean> => {
    const seed = queue[queue.length - 1];
    if (!seed) return false;
    setExtending(true);
    try {
      const known = new Set(queue.map((song) => song.id));
      let more = await getSimilarSongs(seed.id, 40).catch(() => [] as Song[]);
      more = more.filter((song) => !known.has(song.id));
      if (more.length === 0) {
        const random = await getRandomSongs({ size: 40, genre: seed.genre }).catch(() => [] as Song[]);
        more = random.filter((song) => !known.has(song.id));
      }
      if (more.length === 0) return false;
      setQueue((prev) => [...prev, ...more]);
      return true;
    } finally {
      setExtending(false);
    }
  }, [queue]);

  // `advance` is what the `ended` handler calls; kept in a ref so the listener
  // never goes stale.
  useEffect(() => {
    advance.current = () => {
      const el = activeEl();

      // An end-of-track sleep timer stops here rather than moving on.
      if (sleepTimer?.mode === 'endOfTrack') {
        setSleepTimerState(null);
        setPlaying(false);
        el?.pause();
        return;
      }

      if (repeat === 'one' && el) {
        el.currentTime = 0;
        void el.play().catch(() => {});
        return;
      }
      if (index < queue.length - 1) {
        setIndex(index + 1);
        return;
      }
      if (repeat === 'all' && queue.length > 0) {
        setIndex(0);
        return;
      }
      if (autoplay) {
        const at = index;
        void extendQueue().then((extended) => {
          if (extended) setIndex(at + 1);
          else {
            setPlaying(false);
            setCurrentTime(0);
          }
        });
        return;
      }
      setPlaying(false);
      setCurrentTime(0);
    };
  }, [activeEl, autoplay, extendQueue, index, queue.length, repeat, sleepTimer]);

  /* Sleep timer countdown. Fades out rather than cutting off abruptly. */
  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'countdown') return;
    const remaining = sleepTimer.endsAt - Date.now();
    if (remaining <= 0) {
      setSleepTimerState(null);
      activeEl()?.pause();
      return;
    }
    const handle = setTimeout(() => {
      const el = activeEl();
      setSleepTimerState(null);
      if (!el) return;
      // A three-second fade, then pause and restore the volume for next time.
      const from = el.volume;
      const steps = 30;
      let step = 0;
      const fade = setInterval(() => {
        step += 1;
        el.volume = Math.max(0, from * (1 - step / steps));
        if (step >= steps) {
          clearInterval(fade);
          el.pause();
          el.volume = from;
        }
      }, 100);
    }, remaining);
    return () => clearTimeout(handle);
  }, [activeEl, sleepTimer]);

  // Pre-buffer the next track as we approach the end of this one.
  useEffect(() => {
    if (!current || duration <= 0) return;
    if (currentTime < duration - PRELOAD_LEAD) return;
    const upcoming = index < queue.length - 1 ? queue[index + 1] : repeat === 'all' ? queue[0] : null;
    if (!upcoming || upcoming.id === current.id) return;
    if (preloadedId.current === upcoming.id) return;
    const idle = idleEl();
    if (!idle) return;
    preloadedId.current = upcoming.id;
    idle.volume = muted ? 0 : volume;
    if (isDownloaded(upcoming.id)) {
      void localStreamUrl(upcoming.id).then((url) => {
        if (preloadedId.current !== upcoming.id) return;
        if (url) objectUrls.current.set(upcoming.id, url);
        idle.src = url ?? srcFor(upcoming);
        idle.load();
      });
      return;
    }
    idle.src = srcFor(upcoming);
    idle.load();
  }, [current, currentTime, duration, idleEl, index, muted, queue, repeat, srcFor, volume]);

  /**
   * Crossfade. The next track is already buffered on the idle element, so we
   * start it early and ramp the two volumes past each other. The old element's
   * `ended` event still drives the advance, which lands exactly when the fade
   * completes.
   */
  useEffect(() => {
    const seconds = Math.min(settings.crossfadeSeconds, PRELOAD_LEAD - 2);
    const idle = idleEl();
    const active = activeEl();
    if (!idle || !active) return;

    const target = muted ? 0 : volume;
    const remaining = duration - currentTime;
    const eligible =
      seconds > 0 && current && duration > 0 && repeat !== 'one' && preloadedId.current !== null;

    if (!eligible || remaining > seconds || remaining <= 0) {
      // Outside the window — including after a seek backwards — put things back.
      if (!idle.paused) {
        idle.pause();
        idle.currentTime = 0;
      }
      if (active.volume !== target) active.volume = target;
      return;
    }

    const progress = Math.min(1, Math.max(0, 1 - remaining / seconds));
    active.volume = target * (1 - progress);
    idle.volume = target * progress;
    if (idle.paused && playing) void idle.play().catch(() => {});
  }, [
    activeEl, current, currentTime, duration, idleEl, muted, playing, repeat,
    settings.crossfadeSeconds, volume,
  ]);

  const play = useCallback(() => {
    const el = activeEl();
    if (!el) return;
    if (!el.src && current) {
      load(current, true);
      return;
    }
    void el.play().catch(() => setPlaying(false));
  }, [activeEl, current, load]);

  const pause = useCallback(() => {
    activeEl()?.pause();
  }, [activeEl]);

  const toggle = useCallback(() => {
    const el = activeEl();
    if (!el) return;
    if (el.paused) play();
    else pause();
  }, [activeEl, pause, play]);

  const seek = useCallback(
    (seconds: number) => {
      const el = activeEl();
      if (!el) return;
      const clamped = Math.max(0, Math.min(seconds, duration || el.duration || 0));
      el.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [activeEl, duration],
  );

  const seekBy = useCallback((delta: number) => seek(currentTime + delta), [currentTime, seek]);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolumeState(clamped);
      setMuted(false);
      updateSettings({ volume: clamped });
      for (const el of elements.current ?? []) el.volume = clamped;
    },
    [updateSettings],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const nextMuted = !prev;
      for (const el of elements.current ?? []) el.volume = nextMuted ? 0 : volume;
      return nextMuted;
    });
  }, [volume]);

  const playQueue = useCallback(
    (songs: Song[], startIndex: number, ctx?: PlaybackContextInfo) => {
      if (songs.length === 0) return;
      scrobbled.current.clear();
      preloadedId.current = null;
      suppressAutoplay.current = false;
      lastLoadedId.current = null;
      setOriginal(songs);
      setContext(ctx ?? null);
      setError(null);

      if (shuffle) {
        const first = songs[startIndex];
        const rest = shuffled(songs.filter((_, i) => i !== startIndex));
        setQueue([first, ...rest]);
        setIndex(0);
      } else {
        setQueue(songs);
        setIndex(startIndex);
      }
    },
    [shuffle],
  );

  const playSong = useCallback(
    (song: Song, ctx?: PlaybackContextInfo) => playQueue([song], 0, ctx),
    [playQueue],
  );

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const on = !prev;
      const currentSong = queue[index] ?? null;
      if (on) {
        const source = original.length ? original : queue;
        const rest = shuffled(source.filter((s) => s.id !== currentSong?.id));
        setQueue(currentSong ? [currentSong, ...rest] : rest);
        setIndex(currentSong ? 0 : -1);
      } else {
        const source = original.length ? original : queue;
        setQueue(source);
        const restored = currentSong ? source.findIndex((s) => s.id === currentSong.id) : -1;
        setIndex(restored >= 0 ? restored : 0);
      }
      preloadedId.current = null;
      return on;
    });
  }, [index, original, queue]);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplay((prev) => {
      updateSettings({ autoplay: !prev });
      return !prev;
    });
  }, [updateSettings]);

  const setSleepTimer = useCallback((timer: SleepTimer | null) => setSleepTimerState(timer), []);

  const playNext = useCallback(
    (songs: Song[]) => {
      if (songs.length === 0) return;
      setQueue((prev) => {
        if (prev.length === 0) {
          setIndex(0);
          setOriginal(songs);
          return songs;
        }
        const copy = [...prev];
        copy.splice(index + 1, 0, ...songs);
        return copy;
      });
      preloadedId.current = null;
    },
    [index],
  );

  const playLater = useCallback((songs: Song[]) => {
    if (songs.length === 0) return;
    setQueue((prev) => {
      if (prev.length === 0) {
        setIndex(0);
        setOriginal(songs);
        return songs;
      }
      return [...prev, ...songs];
    });
  }, []);

  const removeAt = useCallback(
    (target: number) => {
      setQueue((prev) => {
        const copy = [...prev];
        copy.splice(target, 1);
        return copy;
      });
      if (target < index) setIndex((i) => i - 1);
      else if (target === index) preloadedId.current = null;
    },
    [index],
  );

  const moveInQueue = useCallback(
    (from: number, to: number) => {
      setQueue((prev) => {
        if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
        const copy = [...prev];
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        return copy;
      });
      setIndex((prevIndex) => {
        if (from === prevIndex) return to;
        if (from < prevIndex && to >= prevIndex) return prevIndex - 1;
        if (from > prevIndex && to <= prevIndex) return prevIndex + 1;
        return prevIndex;
      });
      preloadedId.current = null;
    },
    [],
  );

  const clearQueue = useCallback(() => {
    for (const el of elements.current ?? []) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    preloadedId.current = null;
    lastLoadedId.current = null;
    setQueue([]);
    setOriginal([]);
    setIndex(-1);
    setContext(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  /* ------------------------------------------------------------ media session */

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    const artwork = current.coverArt
      ? [96, 192, 384, 512].map((size) => ({
          src: coverArtUrl(current.coverArt, size),
          sizes: `${size}x${size}`,
          type: 'image/jpeg',
        }))
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: songArtist(current),
      album: current.album ?? '',
      artwork,
    });
  }, [current]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => play()],
      ['pause', () => pause()],
      ['previoustrack', () => previous()],
      ['nexttrack', () => next()],
      ['seekbackward', (d) => seekBy(-(d.seekOffset ?? 10))],
      ['seekforward', (d) => seekBy(d.seekOffset ?? 10)],
      ['seekto', (d) => (d.seekTime !== undefined ? seek(d.seekTime) : undefined)],
      ['stop', () => pause()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* not every browser supports every action */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [next, pause, play, previous, seek, seekBy]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate: 1,
      });
    } catch {
      /* Safari occasionally rejects a position update mid-seek */
    }
  }, [currentTime, duration]);

  /* -------------------------------------------------------------------- value */

  const actions = useMemo<PlayerActions>(
    () => ({
      playQueue,
      playSong,
      toggle,
      play,
      pause,
      next,
      previous,
      seek,
      seekBy,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      toggleAutoplay,
      setSleepTimer,
      playNext,
      playLater,
      removeAt,
      moveInQueue,
      jumpTo,
      clearQueue,
    }),
    [
      clearQueue, cycleRepeat, jumpTo, moveInQueue, next, pause, play, playLater,
      playNext, playQueue, playSong, previous, removeAt, seek, seekBy,
      setSleepTimer, setVolume, toggle, toggleAutoplay, toggleMute, toggleShuffle,
    ],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue, index, current, playing, loading, currentTime, duration, buffered,
      volume, muted, shuffle, repeat, autoplay, sleepTimer, extending, context,
      error, actions,
    }),
    [
      actions, autoplay, buffered, context, current, currentTime, duration, error,
      extending, index, loading, muted, playing, queue, repeat, shuffle,
      sleepTimer, volume,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
