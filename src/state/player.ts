/**
 * The playback engine.
 *
 * An imperative object that owns the two <audio> elements and the queue, with
 * React subscribing to it rather than driving it. The previous engine was a
 * web of effects reacting to each other through React state, which is how it
 * ended up with stale closures, side effects inside state updaters, and a Play
 * button that silently did nothing when the album was already loaded. Here an
 * action is a method: it changes the state and then does the work, in order.
 *
 * Two <audio> elements take turns: while one plays, the other pre-buffers the
 * next track, so the end of a song swaps to something already loaded rather
 * than opening a fresh connection. Crossfade uses the same pair. The elements
 * stay out of the Web Audio graph on purpose — routing through an
 * AudioContext resamples everything to the context's rate.
 *
 * Progress lives in its own store, so the clock ticking four times a second
 * re-renders the scrubber and nothing else.
 */

import { connection, networkKind } from '../lib/connection';
import { isDownloaded, localStreamUrl } from '../lib/downloads';
import { songArtist } from '../lib/format';
import { recordPlay } from '../lib/history';
import { compactSong, shuffled } from '../lib/song';
import { logPlay, updatePlay, type PlayHandle } from '../lib/stats';
import { createStore, useStore, type Store } from '../lib/store';
import {
  coverArtUrl, getRandomSongs, getSimilarSongs, scrobble as apiScrobble, streamUrl,
} from '../lib/subsonic';
import type { InternetRadioStation, Song } from '../lib/types';
import { getSettings, settingsStore, updateSettings } from './settings';
import { ui } from './ui';

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
  /** Where "playing from" should take you. */
  route?: string;
}

export interface QueueItem {
  /** Unique per entry, so the same song can be queued twice and still be told apart. */
  key: string;
  song: Song;
}

export interface SourceInfo {
  kind: 'stream' | 'offline' | 'radio';
  quality: 'original' | number;
  format?: string;
}

export interface PlayerState {
  queue: QueueItem[];
  index: number;
  current: Song | null;
  currentKey: string | null;
  /** What the listener wants: true from the moment Play is pressed. */
  playing: boolean;
  buffering: boolean;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
  sleep: SleepTimer | null;
  /** True while autoplay is fetching more music to keep the queue alive. */
  extending: boolean;
  context: PlaybackContextInfo | null;
  error: string | null;
  /** A-B repeat. `b` is null while the second point is still being chosen. */
  loop: { a: number; b: number | null } | null;
  /** iOS ignores element volume, so there is no point drawing a volume control. */
  volumeControl: boolean;
  source: SourceInfo | null;
}

export interface ProgressState {
  time: number;
  buffered: number;
}

export interface QueueSnapshot {
  queue: QueueItem[];
  index: number;
  original: QueueItem[] | null;
  context: PlaybackContextInfo | null;
  playing: boolean;
  time: number;
}

/* ---------------------------------------------------------------- constants */

const QUEUE_KEY = 'frequenzy.queue.v2';
const LEGACY_QUEUE_KEY = 'frequenzy.queue.v1';
/** Start warming the next track this many seconds before the current one ends. */
const PRELOAD_LEAD = 25;
/** Persist at most this many queue entries, centred on the current one. */
const PERSIST_LIMIT = 1000;
/** How long the sleep timer takes to fade out. */
const SLEEP_FADE_MS = 6000;
/** Buffering this long triggers a check for a better server. */
const STALL_MS = 9000;

/* --------------------------------------------------------------- utilities */

function finite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function bufferedEnd(el: HTMLAudioElement): number {
  try {
    const ranges = el.buffered;
    if (ranges.length === 0) return 0;
    // The range that contains the playhead, not merely the last one.
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= el.currentTime + 0.5 && ranges.end(i) >= el.currentTime) return ranges.end(i);
    }
    return ranges.end(ranges.length - 1);
  } catch {
    return 0;
  }
}

function canSetVolume(): boolean {
  if (typeof Audio === 'undefined') return false;
  try {
    const probe = new Audio();
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch {
    return false;
  }
}

/** A tenth of a second of silence, used to unlock elements on iOS. */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

interface PersistedQueueV2 {
  v: 2;
  queue: Song[];
  index: number;
  time: number;
  shuffle: boolean;
  repeat: RepeatMode;
  context: PlaybackContextInfo | null;
  /** Unshuffled order, as positions into `queue`. */
  original: number[] | null;
  savedAt: number;
}

function loadPersisted(): PersistedQueueV2 | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedQueueV2;
      if (parsed?.v === 2 && Array.isArray(parsed.queue)) return parsed;
    }
    // The previous format stored songs twice; carry the queue over, drop the rest.
    const legacy = localStorage.getItem(LEGACY_QUEUE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as { queue?: Song[]; index?: number; time?: number; repeat?: RepeatMode; context?: PlaybackContextInfo | null };
      localStorage.removeItem(LEGACY_QUEUE_KEY);
      if (Array.isArray(parsed.queue) && parsed.queue.length) {
        return {
          v: 2,
          queue: parsed.queue.map(compactSong),
          index: Math.min(Math.max(0, parsed.index ?? 0), parsed.queue.length - 1),
          time: parsed.time ?? 0,
          shuffle: false,
          repeat: parsed.repeat ?? 'off',
          context: parsed.context ?? null,
          original: null,
          savedAt: Date.now(),
        };
      }
    }
  } catch {
    /* corrupt or unavailable — start empty */
  }
  return null;
}

type Slot = 0 | 1;

interface Listen {
  key: string;
  song: Song;
  seconds: number;
  lastTick: number;
  recorded: boolean;
  counted: PlayHandle | null;
  scrobbled: boolean;
  nowPlayingSent: boolean;
}

/* ------------------------------------------------------------------ engine */

class PlayerEngine {
  readonly store: Store<PlayerState>;
  readonly progress: Store<ProgressState>;

  private els: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private slot: Slot = 0;
  /** Which queue entry each element holds. */
  private slotItem: [string | null, string | null] = [null, null];
  private slotBlob: [string | null, string | null] = [null, null];
  private slotInfo: [SourceInfo | null, SourceInfo | null] = [null, null];
  /** Crossfade gain per element, 0..1. */
  private fade: [number, number] = [1, 1];
  private sleepGain = 1;
  /** Pauses we caused ourselves, so their events do not read as the listener's. */
  private ownPause = new Set<HTMLAudioElement>();

  private original: QueueItem[] | null = null;
  private keyCounter = 0;
  private loadToken = 0;
  private pendingSeek: number | null = null;
  private preloadingKey: string | null = null;
  private retries = new Map<string, number>();
  private consecutiveFailures = 0;
  private listen: Listen | null = null;

  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepTimeout: ReturnType<typeof setTimeout> | null = null;
  private sleepFadeTimer: ReturnType<typeof setInterval> | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private fadeFrame = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPositionState = 0;
  private extendingFor: string | null = null;
  private extendPromise: Promise<boolean> | null = null;
  private unlocked = false;
  private silent = '';

  constructor() {
    const settings = getSettings();
    const saved = typeof window === 'undefined' ? null : loadPersisted();

    let queue: QueueItem[] = [];
    let index = -1;
    if (saved && saved.queue.length) {
      queue = saved.queue.map((song) => this.item(song));
      index = Math.min(Math.max(0, saved.index), queue.length - 1);
      if (saved.shuffle && saved.original) {
        const restored = saved.original.map((position) => queue[position]).filter(Boolean);
        this.original = restored.length === queue.length ? restored : null;
      }
    }

    this.store = createStore<PlayerState>({
      queue,
      index,
      current: queue[index]?.song ?? null,
      currentKey: queue[index]?.key ?? null,
      playing: false,
      buffering: false,
      duration: queue[index]?.song.duration ?? 0,
      volume: settings.volume,
      muted: settings.muted,
      rate: settings.playbackRate,
      shuffle: Boolean(saved?.shuffle && this.original),
      repeat: saved?.repeat ?? 'off',
      autoplay: settings.autoplay,
      sleep: null,
      extending: false,
      context: saved?.context ?? null,
      error: null,
      loop: null,
      volumeControl: canSetVolume(),
      source: null,
    });
    this.progress = createStore<ProgressState>({ time: saved?.time ?? 0, buffered: 0 });

    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    this.els = [this.makeElement(), this.makeElement()];
    this.bindMediaSession();
    this.bindLifecycle();

    // Output follows the settings that shape it, wherever they were changed.
    let last = settingsStore.get();
    settingsStore.subscribe(() => {
      const next = settingsStore.get();
      if (
        next.replayGain !== last.replayGain ||
        next.replayGainPreamp !== last.replayGainPreamp ||
        next.crossfadeSeconds !== last.crossfadeSeconds
      ) {
        this.applyOutput();
      }
      if (next.autoplay !== last.autoplay && next.autoplay !== this.store.get().autoplay) {
        this.store.set({ autoplay: next.autoplay });
      }
      last = next;
    });
  }

  /* ------------------------------------------------------------ elements */

  private makeElement(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';
    // No crossOrigin: we never read the samples, and leaving it off means
    // playback keeps working even if the server omits CORS headers on /stream.
    el.addEventListener('timeupdate', () => this.onTimeUpdate(el));
    el.addEventListener('progress', () => this.onBuffer(el));
    el.addEventListener('loadedmetadata', () => this.onMetadata(el));
    el.addEventListener('durationchange', () => this.onMetadata(el));
    el.addEventListener('play', () => this.onPlay(el));
    el.addEventListener('pause', () => this.onPause(el));
    el.addEventListener('waiting', () => this.onWaiting(el));
    el.addEventListener('playing', () => this.onPlaying(el));
    el.addEventListener('canplay', () => this.onCanPlay(el));
    el.addEventListener('ended', () => this.onEnded(el));
    el.addEventListener('error', () => this.onError(el));
    return el;
  }

  private get active(): HTMLAudioElement | null {
    return this.els?.[this.slot] ?? null;
  }

  private get idle(): HTMLAudioElement | null {
    return this.els?.[1 - this.slot] ?? null;
  }

  private slotOf(el: HTMLAudioElement): Slot | -1 {
    if (!this.els) return -1;
    return el === this.els[0] ? 0 : el === this.els[1] ? 1 : -1;
  }

  /** True for events from the element that is playing the current entry. */
  private isLive(el: HTMLAudioElement): boolean {
    const slot = this.slotOf(el);
    return slot === this.slot && this.slotItem[slot] !== null && this.slotItem[slot] === this.store.get().currentKey;
  }

  private pauseEl(el: HTMLAudioElement | null): void {
    if (!el || el.paused) return;
    this.ownPause.add(el);
    el.pause();
  }

  private unload(slot: Slot): void {
    const el = this.els?.[slot];
    if (!el) return;
    this.pauseEl(el);
    if (el.getAttribute('src')) {
      el.removeAttribute('src');
      el.load();
    }
    // Changing the source cancels a queued pause event, so the tag could
    // otherwise linger and swallow a real pause later.
    this.ownPause.delete(el);
    const blob = this.slotBlob[slot];
    if (blob) URL.revokeObjectURL(blob);
    this.slotBlob[slot] = null;
    this.slotItem[slot] = null;
    this.slotInfo[slot] = null;
    this.fade[slot] = 1;
  }

  private setSource(slot: Slot, src: { url: string; blob: boolean; info?: SourceInfo }, key: string): void {
    const el = this.els?.[slot];
    if (!el) return;
    const previousBlob = this.slotBlob[slot];
    this.ownPause.delete(el);
    el.src = src.url;
    if (previousBlob && previousBlob !== src.url) URL.revokeObjectURL(previousBlob);
    this.slotBlob[slot] = src.blob ? src.url : null;
    this.slotItem[slot] = key;
    this.slotInfo[slot] = src.info ?? null;
    this.applyRate(el, this.songFor(key));
  }

  private play(el: HTMLAudioElement): void {
    this.ownPause.delete(el);
    const attempt = el.play();
    attempt?.catch((error: DOMException) => {
      if (error?.name === 'AbortError') return; // superseded by a newer load
      if (el !== this.active) return;
      if (error?.name === 'NotAllowedError') {
        // The browser wants a tap first. Show it as paused so one tap works.
        this.store.set({ playing: false, buffering: false });
      }
    });
  }

  /* --------------------------------------------------------- source & output */

  private qualityNow(): 'original' | number {
    const settings = getSettings();
    const quality = networkKind() === 'home' ? settings.qualityHome : settings.qualityRemote;
    return quality === 'original' ? 'original' : Number(quality);
  }

  /** The source for a song, synchronously when possible so iOS keeps the tap. */
  private syncSource(song: Song): { url: string; blob: boolean; info: SourceInfo } | null {
    if (song.isRadio && song.streamUrl) return { url: song.streamUrl, blob: false, info: { kind: 'radio', quality: 'original' } };
    if (isDownloaded(song.id)) return null;
    if (connection.baseUrl === null) return null;
    const quality = this.qualityNow();
    const format = getSettings().transcodeFormat;
    return {
      url: streamUrl(song.id, { quality, format }),
      blob: false,
      info: { kind: 'stream', quality, format: quality === 'original' ? undefined : format },
    };
  }

  private async asyncSource(song: Song): Promise<{ url: string; blob: boolean; info: SourceInfo }> {
    if (isDownloaded(song.id)) {
      const local = await localStreamUrl(song.id);
      if (local) return { url: local, blob: true, info: { kind: 'offline', quality: 'original' } };
    }
    await connection.ensure().catch(() => {});
    const quality = this.qualityNow();
    const format = getSettings().transcodeFormat;
    return {
      url: streamUrl(song.id, { quality, format }),
      blob: false,
      info: { kind: 'stream', quality, format: quality === 'original' ? undefined : format },
    };
  }

  private songFor(key: string | null): Song | null {
    if (!key) return null;
    const { queue } = this.store.get();
    return queue.find((item) => item.key === key)?.song ?? null;
  }

  /** ReplayGain as a linear factor, attenuation only — an element cannot boost. */
  private gainFor(song: Song | null): number {
    const { replayGain, replayGainPreamp } = getSettings();
    if (!song || replayGain === 'off' || song.isRadio) return 1;
    const rg = song.replayGain;
    if (!rg) return 1;
    const gain = replayGain === 'album' ? (rg.albumGain ?? rg.trackGain) : (rg.trackGain ?? rg.albumGain);
    if (gain === undefined || !Number.isFinite(gain)) return 1;
    let factor = 10 ** ((gain + replayGainPreamp) / 20);
    const peak = replayGain === 'album' ? (rg.albumPeak ?? rg.trackPeak) : (rg.trackPeak ?? rg.albumPeak);
    if (peak && peak > 0) factor = Math.min(factor, 1 / peak);
    return Math.max(0, Math.min(1, factor));
  }

  private applyOutput(): void {
    if (!this.els) return;
    const { volume, muted } = this.store.get();
    // Squared, because loudness is not linear: the bottom half of a linear
    // slider is where all the useful range is.
    const base = muted ? 0 : volume * volume;
    for (const slot of [0, 1] as Slot[]) {
      const el = this.els[slot];
      const value = base * this.gainFor(this.songFor(this.slotItem[slot])) * this.fade[slot] * this.sleepGain;
      const clamped = Math.max(0, Math.min(1, value));
      if (Math.abs(el.volume - clamped) > 0.0005) el.volume = clamped;
    }
  }

  private applyRate(el: HTMLAudioElement, song: Song | null): void {
    const rate = song?.isRadio ? 1 : this.store.get().rate;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }

  /* ------------------------------------------------------------- starting */

  private item(song: Song): QueueItem {
    this.keyCounter += 1;
    return { key: `q${this.keyCounter}`, song };
  }

  private currentItem(): QueueItem | null {
    const { queue, index } = this.store.get();
    return queue[index] ?? null;
  }

  /** Commit a new queue / index, keeping the derived fields in step. */
  private commit(patch: Partial<PlayerState>): void {
    const state = this.store.get();
    const queue = patch.queue ?? state.queue;
    const index = patch.index ?? state.index;
    const entry = queue[index];
    this.store.set({ ...patch, current: entry?.song ?? null, currentKey: entry?.key ?? null });
    this.schedulePersist();
  }

  /**
   * Load the current entry and (optionally) play it. Swaps to the idle element
   * when it already holds this entry, which is what makes track changes
   * gapless.
   */
  private start({ at = 0, autoplay = true, force = false }: { at?: number; autoplay?: boolean; force?: boolean } = {}): void {
    const els = this.els;
    const entry = this.currentItem();
    const token = ++this.loadToken;
    this.clearStall();
    this.cancelFadeFrame();
    this.finishListen();
    this.store.set({ error: null, loop: null });
    this.stopLoopTimer();
    if (!els) return;

    if (!entry) {
      this.unload(0);
      this.unload(1);
      this.store.set({ playing: false, buffering: false, duration: 0, source: null });
      this.progress.set({ time: 0, buffered: 0 });
      return;
    }

    const song = entry.song;
    const idleSlot = (1 - this.slot) as Slot;

    // Already buffered on the idle element: swap to it.
    if (
      !force &&
      at === 0 &&
      this.slotItem[idleSlot] === entry.key &&
      els[idleSlot].getAttribute('src') &&
      !els[idleSlot].error
    ) {
      this.unload(this.slot);
      this.slot = idleSlot;
      const el = els[this.slot];
      this.fade[this.slot] = 1;
      this.applyOutput();
      this.applyRate(el, song);
      this.store.set({
        playing: autoplay,
        buffering: autoplay && el.readyState < 3,
        duration: finite(el.duration) ? el.duration : (song.duration ?? 0),
        source: this.slotInfo[this.slot],
      });
      this.progress.set({ time: el.currentTime, buffered: bufferedEnd(el) });
      if (autoplay) this.play(el);
      else this.pauseEl(el);
      this.beginListen(entry);
      this.updateMediaMetadata();
      return;
    }

    // A fresh load. The idle element may hold something else; let it go.
    if (this.slotItem[idleSlot] !== null && this.slotItem[idleSlot] !== this.upcomingItem()?.key) {
      this.unload(idleSlot);
    } else if (this.slotItem[idleSlot] !== null) {
      // Still the right next track, but it may have started fading in.
      this.pauseEl(els[idleSlot]);
      try {
        if (els[idleSlot].currentTime > 0) els[idleSlot].currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
    this.fade = [1, 1];

    const el = els[this.slot];
    this.pauseEl(el);
    this.store.set({ playing: autoplay, buffering: autoplay, duration: song.duration ?? 0 });
    this.progress.set({ time: at, buffered: 0 });
    this.pendingSeek = at > 0.25 && !song.isRadio ? at : null;

    const begin = (src: { url: string; blob: boolean; info: SourceInfo }) => {
      if (token !== this.loadToken) {
        if (src.blob) URL.revokeObjectURL(src.url);
        return;
      }
      this.setSource(this.slot, src, entry.key);
      this.applyOutput();
      this.store.set({ source: src.info });
      if (autoplay) this.play(el);
      else this.store.set({ buffering: false });
    };

    const sync = this.syncSource(song);
    if (sync) begin(sync);
    else void this.asyncSource(song).then(begin, () => {
      if (token === this.loadToken) this.store.set({ buffering: false, playing: false, error: 'No server reachable' });
    });

    this.beginListen(entry);
    this.updateMediaMetadata();
  }

  /* ---------------------------------------------------------- element events */

  private onTimeUpdate(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    const time = el.currentTime;
    this.progress.set({ time, buffered: bufferedEnd(el) });
    this.trackListen(el);
    this.maybePreload(time);
    this.maybeCrossfade();
    this.checkLoop(el);
    const now = performance.now();
    if (now - this.lastPositionState > 1000) {
      this.lastPositionState = now;
      this.updatePositionState();
    }
  }

  private onBuffer(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    this.progress.set({ time: this.progress.get().time, buffered: bufferedEnd(el) });
  }

  private onMetadata(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    const song = this.store.get().current;
    if (finite(el.duration)) this.store.set({ duration: el.duration });
    else if (song && !song.isRadio && song.duration) this.store.set({ duration: song.duration });
    else if (song?.isRadio) this.store.set({ duration: 0 });
    if (this.pendingSeek !== null && el.readyState >= 1) {
      const target = this.pendingSeek;
      this.pendingSeek = null;
      try {
        el.currentTime = Math.min(target, finite(el.duration) ? el.duration - 0.5 : target);
      } catch {
        /* not seekable yet */
      }
    }
  }

  private onPlay(el: HTMLAudioElement): void {
    // A play event that arrives after we paused again is stale.
    if (!this.isLive(el) || el.paused) return;
    if (!this.store.get().playing) this.store.set({ playing: true });
    if (this.listen) this.listen.lastTick = performance.now();
  }

  private onPause(el: HTMLAudioElement): void {
    if (this.ownPause.delete(el)) return;
    // Stale: we have already set it playing again (a new source, a resume).
    if (!el.paused) return;
    if (!this.isLive(el) || el.ended) return;
    // Paused from outside: headphones unplugged, a phone call, the OS.
    this.store.set({ playing: false, buffering: false });
    this.pauseEl(this.idle);
    this.clearStall();
    this.persistNow();
  }

  private onWaiting(el: HTMLAudioElement): void {
    if (!this.isLive(el) || !this.store.get().playing) return;
    this.store.set({ buffering: true });
    this.armStall();
  }

  private onPlaying(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    this.store.set({ buffering: false, error: null });
    this.clearStall();
    this.consecutiveFailures = 0;
    const listen = this.listen;
    if (listen && !listen.nowPlayingSent && !listen.song.isRadio && getSettings().scrobble) {
      listen.nowPlayingSent = true;
      void apiScrobble(listen.song.id, false).catch(() => {});
    }
  }

  private onCanPlay(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    if (el.paused && !this.store.get().playing) this.store.set({ buffering: false });
  }

  private onEnded(el: HTMLAudioElement): void {
    if (!this.isLive(el)) return;
    const state = this.store.get();
    this.finishListen();

    if (state.sleep?.mode === 'endOfTrack') {
      this.setSleep(null);
      this.stopAtEnd();
      ui.toast('sleep timer — stopped');
      return;
    }
    if (state.repeat === 'one') {
      el.currentTime = 0;
      this.play(el);
      const entry = this.currentItem();
      if (entry) this.beginListen(entry);
      return;
    }
    const next = this.nextIndex();
    if (next !== null) {
      this.commit({ index: next });
      this.start({ autoplay: true });
      return;
    }
    if (state.autoplay && state.current && !state.current.isRadio) {
      const at = state.index;
      const key = state.currentKey;
      this.store.set({ buffering: true });
      void this.extend().then(() => {
        const now = this.store.get();
        if (now.currentKey !== key) return; // the listener moved on meanwhile
        if (at + 1 < now.queue.length) {
          this.commit({ index: at + 1 });
          this.start({ autoplay: true });
        } else {
          this.stopAtEnd();
        }
      });
      return;
    }
    this.stopAtEnd();
  }

  private onError(el: HTMLAudioElement): void {
    if (!el.getAttribute('src') || el.getAttribute('src') === this.silent) return;
    if (el.error?.code === 1 /* MEDIA_ERR_ABORTED */) return;
    if (!this.isLive(el)) {
      // A preload that failed: forget it, so the track loads fresh when its turn comes.
      const slot = this.slotOf(el);
      if (slot !== -1 && slot !== this.slot && this.slotItem[slot] !== null) this.unload(slot);
      return;
    }
    this.handleFailure();
  }

  /**
   * A stream died. Try again — after re-racing the servers, since the usual
   * cause is the network moving — from where it stopped. After two misses,
   * report it and move on to the next track.
   */
  private handleFailure(): void {
    const entry = this.currentItem();
    if (!entry) return;
    const { playing } = this.store.get();
    const at = this.progress.get().time;
    const attempts = this.retries.get(entry.key) ?? 0;
    this.clearStall();

    if (attempts < 2) {
      this.retries.set(entry.key, attempts + 1);
      this.store.set({ buffering: playing });
      setTimeout(async () => {
        if (this.currentItem()?.key !== entry.key) return;
        if (!isDownloaded(entry.song.id) && !entry.song.isRadio) await connection.handleNetworkFailure().catch(() => null);
        if (this.currentItem()?.key !== entry.key) return;
        this.start({ at, autoplay: playing, force: true });
      }, 700 * (attempts + 1));
      return;
    }

    this.retries.delete(entry.key);
    this.consecutiveFailures += 1;
    const message =
      connection.state.status === 'offline' ? 'no server reachable' : `couldn't play “${entry.song.title}”`;
    this.store.set({ error: message, buffering: false, playing: false });
    ui.error(message);
    if (playing && this.consecutiveFailures < 3 && this.nextIndex() !== null) {
      setTimeout(() => {
        if (this.currentItem()?.key === entry.key) this.next();
      }, 1200);
    }
  }

  private armStall(): void {
    this.clearStall();
    const entry = this.currentItem();
    if (!entry || isDownloaded(entry.song.id)) return;
    this.stallTimer = setTimeout(async () => {
      this.stallTimer = null;
      if (this.currentItem()?.key !== entry.key || !this.store.get().buffering) return;
      const before = connection.baseUrl;
      const result = await connection.resolve(true).catch(() => null);
      const after = result ? result.candidate.url.replace(/\/+$/, '') : null;
      if (this.currentItem()?.key !== entry.key || !this.store.get().buffering) return;
      // Only start over if there is somewhere better to start over from.
      if (after !== null && after !== before) {
        this.start({ at: this.progress.get().time, autoplay: true, force: true });
      }
    }, STALL_MS);
  }

  private clearStall(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = null;
  }

  private stopAtEnd(): void {
    const el = this.active;
    this.pauseEl(el);
    if (el && el.getAttribute('src')) {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this.store.set({ playing: false, buffering: false });
    this.progress.set({ time: 0, buffered: this.progress.get().buffered });
    this.persistNow();
  }

  /* ----------------------------------------------------- preload & crossfade */

  private nextIndex(): number | null {
    const { index, queue, repeat } = this.store.get();
    if (index + 1 < queue.length) return index + 1;
    if (repeat === 'all' && queue.length > 0) return 0;
    return null;
  }

  private upcomingItem(): QueueItem | null {
    const { repeat, queue } = this.store.get();
    if (repeat === 'one') return null;
    const next = this.nextIndex();
    return next === null ? null : (queue[next] ?? null);
  }

  private activeDuration(): number {
    const el = this.active;
    if (el && finite(el.duration)) return el.duration;
    return this.store.get().current?.duration ?? 0;
  }

  private maybePreload(time: number): void {
    const current = this.store.get().current;
    if (!current || current.isRadio) return;
    const duration = this.activeDuration();
    if (!finite(duration) || duration - time > PRELOAD_LEAD) return;

    const upcoming = this.upcomingItem();
    if (!upcoming) {
      // Autoplay fetches more ahead of time, so the next song can be gapless too.
      const { autoplay, repeat } = this.store.get();
      if (autoplay && repeat === 'off' && this.nextIndex() === null) void this.extend();
      return;
    }
    if (upcoming.song.isRadio) return;
    const idleSlot = (1 - this.slot) as Slot;
    if (this.slotItem[idleSlot] === upcoming.key || this.preloadingKey === upcoming.key) return;

    this.preloadingKey = upcoming.key;
    const token = this.loadToken;
    const place = (src: { url: string; blob: boolean; info: SourceInfo }) => {
      const stillNext = this.upcomingItem()?.key === upcoming.key;
      if (token !== this.loadToken || !stillNext || this.preloadingKey !== upcoming.key) {
        if (src.blob) URL.revokeObjectURL(src.url);
        if (this.preloadingKey === upcoming.key) this.preloadingKey = null;
        return;
      }
      this.preloadingKey = null;
      this.fade[idleSlot] = 1;
      this.setSource(idleSlot, src, upcoming.key);
      this.applyOutput();
    };
    const sync = this.syncSource(upcoming.song);
    if (sync) place(sync);
    else void this.asyncSource(upcoming.song).then(place, () => {
      if (this.preloadingKey === upcoming.key) this.preloadingKey = null;
    });
  }

  /** Throw away a preload that no longer matches what plays next. */
  private invalidatePreload(): void {
    const idleSlot = (1 - this.slot) as Slot;
    const upcoming = this.upcomingItem();
    this.preloadingKey = null;
    if (this.slotItem[idleSlot] !== null && this.slotItem[idleSlot] !== upcoming?.key) {
      this.unload(idleSlot);
      if (this.fade[this.slot] !== 1) {
        this.fade[this.slot] = 1;
        this.applyOutput();
      }
    }
  }

  private crossfadeSeconds(): number {
    const { repeat, current } = this.store.get();
    if (repeat === 'one' || current?.isRadio) return 0;
    return Math.min(getSettings().crossfadeSeconds, PRELOAD_LEAD - 5);
  }

  /**
   * Crossfade. The next track is already buffered on the idle element, so it
   * starts early and the two volumes ramp past each other on an equal-power
   * curve. The old element's `ended` event still drives the advance, which
   * lands exactly when the fade completes.
   */
  private maybeCrossfade(): void {
    const seconds = this.crossfadeSeconds();
    const els = this.els;
    if (!els) return;
    const idleSlot = (1 - this.slot) as Slot;
    const idle = els[idleSlot];
    const active = els[this.slot];
    const upcoming = this.upcomingItem();
    const ready = seconds > 0 && upcoming && this.slotItem[idleSlot] === upcoming.key;
    const duration = this.activeDuration();
    const remaining = duration - active.currentTime;

    if (!ready || !finite(duration) || remaining > seconds || remaining <= 0) {
      // Outside the window — including after a seek backwards — put things back.
      if (!idle.paused && this.slotItem[idleSlot] !== null) {
        this.pauseEl(idle);
        try {
          idle.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      if (this.fade[this.slot] !== 1 || this.fade[idleSlot] !== 1) {
        this.fade = [1, 1];
        this.applyOutput();
      }
      return;
    }

    const progress = Math.min(1, Math.max(0, 1 - remaining / seconds));
    this.fade[this.slot] = Math.cos((progress * Math.PI) / 2);
    this.fade[idleSlot] = Math.sin((progress * Math.PI) / 2);
    this.applyOutput();
    if (idle.paused && this.store.get().playing) this.play(idle);

    // Four timeupdates a second is audibly steppy for a fade; smooth it out
    // with frames while the tab is visible.
    if (!this.fadeFrame && typeof requestAnimationFrame !== 'undefined' && !document.hidden) {
      const step = () => {
        this.fadeFrame = 0;
        if (!this.store.get().playing) return;
        this.maybeCrossfade();
        const live = this.activeDuration() - (this.active?.currentTime ?? 0);
        if (live > 0 && live <= this.crossfadeSeconds()) this.fadeFrame = requestAnimationFrame(step);
      };
      this.fadeFrame = requestAnimationFrame(step);
    }
  }

  private cancelFadeFrame(): void {
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
  }

  /* ------------------------------------------------------------- listening */

  private beginListen(entry: QueueItem): void {
    this.listen = {
      key: entry.key,
      song: entry.song,
      seconds: 0,
      lastTick: performance.now(),
      recorded: false,
      counted: null,
      scrobbled: false,
      nowPlayingSent: false,
    };
  }

  /**
   * Count real listening time, in track seconds. A seek forward is not
   * listening, and neither is a paused tab, so only small steps between
   * consecutive ticks count.
   */
  private trackListen(el: HTMLAudioElement): void {
    const listen = this.listen;
    if (!listen || listen.key !== this.store.get().currentKey || listen.song.isRadio) return;
    const now = performance.now();
    const step = (now - listen.lastTick) / 1000;
    listen.lastTick = now;
    if (el.paused || step <= 0 || step > 2) return;
    listen.seconds += step * (el.playbackRate || 1);

    const duration = this.activeDuration();
    if (!listen.recorded && listen.seconds >= Math.min(10, duration * 0.5 || 10)) {
      listen.recorded = true;
      recordPlay(listen.song);
    }
    if (!listen.counted && (listen.seconds >= 30 || (duration > 0 && listen.seconds >= duration * 0.5))) {
      listen.counted = logPlay(listen.song, listen.seconds);
    } else if (listen.counted) {
      updatePlay(listen.counted, listen.seconds);
    }
    // Half-way or four minutes is the conventional point to submit a play.
    if (!listen.scrobbled && getSettings().scrobble && duration > 30 && listen.seconds >= Math.min(duration / 2, 240)) {
      listen.scrobbled = true;
      void apiScrobble(listen.song.id, true).catch(() => {});
    }
  }

  private finishListen(): void {
    const listen = this.listen;
    if (listen?.counted) updatePlay(listen.counted, listen.seconds);
    this.listen = null;
  }

  /* ------------------------------------------------------------- autoplay */

  /**
   * When the queue runs out, keep going with songs like the one that just
   * finished. Falls back to a random pull from the same genre when the server
   * has no similarity data for it.
   */
  private extend(): Promise<boolean> {
    if (this.extendPromise) return this.extendPromise;
    const { queue } = this.store.get();
    const seed = queue[queue.length - 1];
    if (!seed || seed.song.isRadio) return Promise.resolve(false);
    // One attempt per seed: a server with nothing similar is not asked again.
    if (this.extendingFor === seed.key) return Promise.resolve(false);
    this.extendingFor = seed.key;
    this.extendPromise = this.fetchMore(seed).finally(() => {
      this.extendPromise = null;
    });
    return this.extendPromise;
  }

  private async fetchMore(seed: QueueItem): Promise<boolean> {
    const { queue } = this.store.get();
    this.store.set({ extending: true });
    try {
      const known = new Set(queue.map((entry) => entry.song.id));
      let more = (await getSimilarSongs(seed.song.id, 40).catch(() => [] as Song[])).filter((s) => !known.has(s.id));
      if (more.length === 0) {
        const random = await getRandomSongs({ size: 40, genre: seed.song.genre }).catch(() => [] as Song[]);
        more = random.filter((s) => !known.has(s.id));
      }
      if (more.length === 0) {
        const random = await getRandomSongs({ size: 40 }).catch(() => [] as Song[]);
        more = random.filter((s) => !known.has(s.id));
      }
      if (more.length === 0) return false;
      // The queue may have changed while we were asking.
      const latest = this.store.get();
      if (latest.queue[latest.queue.length - 1]?.key !== seed.key) return false;
      const items = shuffled(more).slice(0, 25).map((song) => this.item(song));
      this.commit({ queue: [...latest.queue, ...items] });
      if (this.original) this.original = [...this.original, ...items];
      return true;
    } finally {
      this.store.set({ extending: false });
    }
  }

  /* ------------------------------------------------------------ A-B repeat */

  private checkLoop(el: HTMLAudioElement): void {
    const loop = this.store.get().loop;
    if (!loop || loop.b === null) return;
    if (el.currentTime >= loop.b || el.currentTime < loop.a - 1) {
      el.currentTime = loop.a;
      this.progress.set({ time: loop.a, buffered: this.progress.get().buffered });
    }
  }

  private startLoopTimer(): void {
    this.stopLoopTimer();
    this.loopTimer = setInterval(() => {
      const el = this.active;
      if (el && !el.paused) this.checkLoop(el);
    }, 40);
  }

  private stopLoopTimer(): void {
    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = null;
  }

  /* ---------------------------------------------------------- persistence */

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 500);
  }

  persistNow(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (typeof localStorage === 'undefined') return;
    const state = this.store.get();
    try {
      if (state.queue.length === 0) {
        localStorage.removeItem(QUEUE_KEY);
        return;
      }
      // Keep a window around the current entry if the queue is enormous.
      const start = Math.max(0, Math.min(state.index - 200, state.queue.length - PERSIST_LIMIT));
      const window = state.queue.slice(start, start + PERSIST_LIMIT);
      const positions = new Map(window.map((entry, i) => [entry.key, i]));
      const payload: PersistedQueueV2 = {
        v: 2,
        queue: window.map((entry) => compactSong(entry.song)),
        index: Math.max(0, state.index - start),
        time: this.progress.get().time,
        shuffle: state.shuffle,
        repeat: state.repeat,
        context: state.context,
        original: this.original
          ? this.original.map((entry) => positions.get(entry.key)).filter((n): n is number => n !== undefined)
          : null,
        savedAt: Date.now(),
      };
      localStorage.setItem(QUEUE_KEY, JSON.stringify(payload));
    } catch {
      /* quota or private mode — playback is unaffected */
    }
  }

  private bindLifecycle(): void {
    setInterval(() => {
      if (this.store.get().playing) this.persistNow();
    }, 5000);
    window.addEventListener('pagehide', () => this.persistNow());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persistNow();
    });

    // iOS lets an element play without a tap only once it has played with one.
    if (!this.store.get().volumeControl) {
      const unlock = () => {
        if (this.unlocked || !this.els) return;
        this.unlocked = true;
        this.silent ||= silentWav();
        for (const el of this.els) {
          if (el.getAttribute('src')) continue;
          el.src = this.silent;
          void el
            .play()
            .then(() => {
              if (el.getAttribute('src') === this.silent) {
                this.ownPause.add(el);
                el.pause();
                el.removeAttribute('src');
                el.load();
              }
            })
            .catch(() => {});
        }
        window.removeEventListener('touchend', unlock, true);
        window.removeEventListener('click', unlock, true);
      };
      window.addEventListener('touchend', unlock, true);
      window.addEventListener('click', unlock, true);
    }

    // The tab title follows the music.
    let lastTitle = '';
    this.store.subscribe(() => {
      const { current, playing } = this.store.get();
      const title = current && playing ? `${current.title} · ${songArtist(current)}` : 'Frequenzy';
      if (title !== lastTitle) {
        lastTitle = title;
        document.title = title;
      }
    });
  }

  /* --------------------------------------------------------- media session */

  private updateMediaMetadata(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const current = this.store.get().current;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artwork = current.coverArt
      ? [96, 192, 384, 512].map((size) => ({ src: coverArtUrl(current.coverArt, size), sizes: `${size}x${size}`, type: 'image/jpeg' }))
      : [];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: songArtist(current),
        album: current.album ?? '',
        artwork,
      });
    } catch {
      /* MediaMetadata missing */
    }
  }

  private updatePositionState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (!('setPositionState' in session)) return;
    const duration = this.activeDuration();
    try {
      if (!finite(duration) || this.store.get().current?.isRadio) {
        session.setPositionState();
        return;
      }
      session.setPositionState({
        duration,
        position: Math.min(Math.max(0, this.progress.get().time), duration),
        playbackRate: this.store.get().rate,
      });
    } catch {
      /* Safari occasionally rejects a position update mid-seek */
    }
  }

  private bindMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.resume()],
      ['pause', () => this.pause()],
      ['previoustrack', () => this.previous()],
      ['nexttrack', () => this.next()],
      ['seekbackward', (d) => this.seekBy(-(d.seekOffset ?? 10))],
      ['seekforward', (d) => this.seekBy(d.seekOffset ?? 10)],
      ['seekto', (d) => d.seekTime !== undefined && this.seek(d.seekTime)],
      ['stop', () => this.pause()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* not every browser supports every action */
      }
    }
    this.store.subscribe(() => {
      try {
        navigator.mediaSession.playbackState = this.store.get().current
          ? this.store.get().playing
            ? 'playing'
            : 'paused'
          : 'none';
      } catch {
        /* ignore */
      }
    });
  }

  /* ==================================================================== API */

  /** The element's own clock, for things that need better than 4 Hz. */
  currentTime(): number {
    if (this.pendingSeek !== null) return this.pendingSeek;
    const el = this.active;
    if (el && this.slotItem[this.slot] === this.store.get().currentKey && el.getAttribute('src')) return el.currentTime;
    return this.progress.get().time;
  }

  /**
   * Replace the queue and start playing. Always (re)starts — pressing Play on
   * the album that is already loaded plays it, rather than doing nothing.
   *
   * `shuffle: true` turns shuffle on and starts from a random track; `false`
   * turns it off; leaving it out keeps the current mode, starting from
   * `startIndex` either way.
   */
  playQueue(songs: Song[], startIndex = 0, context?: PlaybackContextInfo, opts: { shuffle?: boolean } = {}): void {
    const list = songs.filter(Boolean);
    if (list.length === 0) return;
    const items = list.map((song) => this.item(song));
    const shuffle = opts.shuffle ?? this.store.get().shuffle;
    let start = Math.min(Math.max(0, startIndex), items.length - 1);
    if (opts.shuffle === true && startIndex === 0) start = Math.floor(Math.random() * items.length);

    this.retries.clear();
    this.consecutiveFailures = 0;
    this.extendingFor = null;

    if (shuffle) {
      this.original = items;
      const first = items[start];
      const queue = [first, ...shuffled(items.filter((_, i) => i !== start))];
      this.commit({ queue, index: 0, shuffle: true, context: context ?? null, error: null });
    } else {
      this.original = null;
      this.commit({ queue: items, index: start, shuffle: false, context: context ?? null, error: null });
    }
    this.start({ autoplay: true });
  }

  playSong(song: Song, context?: PlaybackContextInfo): void {
    this.playQueue([song], 0, context);
  }

  playStation(station: InternetRadioStation): void {
    const song: Song = {
      id: `radio:${station.id}`,
      title: station.name,
      artist: 'internet radio',
      isRadio: true,
      streamUrl: station.streamUrl,
    };
    this.playQueue([song], 0, { kind: 'Radio', name: station.name, route: '/radio' }, { shuffle: false });
  }

  /** Insert after the current entry. Starts playback when nothing was queued. */
  playNext(songs: Song[]): void {
    if (songs.length === 0) return;
    const state = this.store.get();
    if (state.queue.length === 0 || !state.current) {
      this.playQueue(songs, 0, undefined, { shuffle: false });
      return;
    }
    const items = songs.map((song) => this.item(song));
    const queue = [...state.queue];
    queue.splice(state.index + 1, 0, ...items);
    if (this.original) {
      const at = this.original.findIndex((entry) => entry.key === state.currentKey);
      this.original.splice(at + 1, 0, ...items);
    }
    this.commit({ queue });
    this.invalidatePreload();
  }

  /** Append to the end. Starts playback when nothing was queued. */
  addToQueue(songs: Song[]): void {
    if (songs.length === 0) return;
    const state = this.store.get();
    if (state.queue.length === 0 || !state.current) {
      this.playQueue(songs, 0, undefined, { shuffle: false });
      return;
    }
    const items = songs.map((song) => this.item(song));
    this.commit({ queue: [...state.queue, ...items] });
    if (this.original) this.original = [...this.original, ...items];
    this.invalidatePreload();
  }

  resume(): void {
    const el = this.active;
    const entry = this.currentItem();
    if (!el || !entry) return;
    this.cancelSleepFade();
    if (this.slotItem[this.slot] !== entry.key || !el.getAttribute('src')) {
      // Nothing loaded yet (a restored queue, or after an error): load it now,
      // from wherever the playhead was left.
      this.start({ at: this.progress.get().time, autoplay: true, force: true });
      return;
    }
    if (el.ended) el.currentTime = 0;
    this.store.set({ playing: true, buffering: el.readyState < 3, error: null });
    this.play(el);
    if (this.listen) this.listen.lastTick = performance.now();
  }

  pause(): void {
    this.cancelSleepFade();
    this.pauseEl(this.active);
    this.pauseEl(this.idle);
    this.clearStall();
    this.store.set({ playing: false, buffering: false });
    this.persistNow();
  }

  toggle(): void {
    if (this.store.get().playing) this.pause();
    else this.resume();
  }

  /** Stop and forget the queue entirely. */
  stop(): void {
    this.pause();
    this.clearAll();
  }

  next(): void {
    const state = this.store.get();
    if (state.queue.length === 0) return;
    const next = this.nextIndex();
    if (next !== null) {
      this.commit({ index: next });
      this.start({ autoplay: true });
      return;
    }
    if (state.autoplay && state.current && !state.current.isRadio) {
      const at = state.index;
      const key = state.currentKey;
      this.store.set({ buffering: true });
      void this.extend().then(() => {
        const now = this.store.get();
        if (now.currentKey !== key) return;
        if (at + 1 < now.queue.length) {
          this.commit({ index: at + 1 });
          this.start({ autoplay: true });
        } else {
          this.store.set({ buffering: false });
          ui.toast('end of queue');
        }
      });
      return;
    }
    ui.toast('end of queue');
  }

  /** Apple's rule: restart the track unless it has only just begun. */
  previous(): void {
    const state = this.store.get();
    if (state.queue.length === 0) return;
    if (this.currentTime() > 3 || state.current?.isRadio) {
      this.seek(0);
      return;
    }
    if (state.index > 0) {
      this.commit({ index: state.index - 1 });
      this.start({ autoplay: true });
    } else if (state.repeat === 'all') {
      this.commit({ index: state.queue.length - 1 });
      this.start({ autoplay: true });
    } else {
      this.seek(0);
    }
  }

  seek(seconds: number): void {
    const state = this.store.get();
    if (!state.current || state.current.isRadio) return;
    const duration = this.activeDuration();
    const target = Math.max(0, finite(duration) ? Math.min(seconds, duration - 0.25) : seconds);
    const el = this.active;
    const loaded = el && this.slotItem[this.slot] === state.currentKey && el.getAttribute('src');
    if (loaded && el) {
      if (el.readyState >= 1) {
        try {
          el.currentTime = target;
        } catch {
          this.pendingSeek = target;
        }
      } else {
        this.pendingSeek = target;
      }
    }
    this.progress.set({ time: target, buffered: this.progress.get().buffered });
    if (this.listen) this.listen.lastTick = performance.now();
    this.maybeCrossfade();
    this.updatePositionState();
  }

  seekBy(delta: number): void {
    this.seek(this.currentTime() + delta);
  }

  seekFraction(fraction: number): void {
    const duration = this.activeDuration();
    if (finite(duration)) this.seek(duration * Math.min(1, Math.max(0, fraction)));
  }

  jumpTo(index: number): void {
    const { queue } = this.store.get();
    if (index < 0 || index >= queue.length) return;
    this.commit({ index });
    this.start({ autoplay: true });
  }

  jumpToKey(key: string): void {
    const index = this.store.get().queue.findIndex((entry) => entry.key === key);
    if (index >= 0) this.jumpTo(index);
  }

  /** Remove entries by key. Removing the current entry moves on to the next. */
  removeKeys(keys: string[]): void {
    if (keys.length === 0) return;
    const drop = new Set(keys);
    const state = this.store.get();
    const removingCurrent = state.currentKey !== null && drop.has(state.currentKey);
    const queue = state.queue.filter((entry) => !drop.has(entry.key));
    if (this.original) this.original = this.original.filter((entry) => !drop.has(entry.key));

    if (queue.length === 0) {
      this.clearAll();
      return;
    }
    if (removingCurrent) {
      // The first survivor at or after the old position takes over.
      let index = 0;
      for (let i = 0; i < state.queue.length && i < state.index; i++) if (!drop.has(state.queue[i].key)) index += 1;
      index = Math.min(index, queue.length - 1);
      const wasPlaying = state.playing;
      this.commit({ queue, index });
      this.start({ autoplay: wasPlaying });
      return;
    }
    const index = queue.findIndex((entry) => entry.key === state.currentKey);
    this.commit({ queue, index: Math.max(0, index) });
    this.invalidatePreload();
  }

  removeAt(index: number): void {
    const entry = this.store.get().queue[index];
    if (entry) this.removeKeys([entry.key]);
  }

  move(from: number, to: number): void {
    const state = this.store.get();
    if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return;
    const queue = [...state.queue];
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    const index = queue.findIndex((entry) => entry.key === state.currentKey);
    this.commit({ queue, index });
    this.invalidatePreload();
  }

  /** Move an upcoming entry to play straight after the current one. */
  moveToNext(key: string): void {
    const state = this.store.get();
    const from = state.queue.findIndex((entry) => entry.key === key);
    if (from < 0 || from === state.index) return;
    const to = from > state.index ? state.index + 1 : state.index;
    this.move(from, to);
  }

  clearUpcoming(): void {
    const state = this.store.get();
    if (state.index + 1 >= state.queue.length) return;
    const queue = state.queue.slice(0, state.index + 1);
    if (this.original) {
      const keep = new Set(queue.map((entry) => entry.key));
      this.original = this.original.filter((entry) => keep.has(entry.key));
    }
    this.commit({ queue });
    this.invalidatePreload();
  }

  clearPlayed(): void {
    const state = this.store.get();
    if (state.index <= 0) return;
    const queue = state.queue.slice(state.index);
    if (this.original) {
      const keep = new Set(queue.map((entry) => entry.key));
      this.original = this.original.filter((entry) => keep.has(entry.key));
    }
    this.commit({ queue, index: 0 });
  }

  clearAll(): void {
    this.loadToken += 1;
    this.finishListen();
    this.unload(0);
    this.unload(1);
    this.original = null;
    this.clearStall();
    this.stopLoopTimer();
    this.commit({ queue: [], index: -1, context: null, playing: false, buffering: false, duration: 0, error: null, loop: null, source: null });
    this.progress.set({ time: 0, buffered: 0 });
    this.persistNow();
    this.updateMediaMetadata();
  }

  shuffleUpcoming(): void {
    const state = this.store.get();
    if (state.index + 2 > state.queue.length - 1) return;
    const queue = [...state.queue.slice(0, state.index + 1), ...shuffled(state.queue.slice(state.index + 1))];
    this.commit({ queue });
    this.invalidatePreload();
  }

  /**
   * Shuffle on: the current track stays put and everything else is shuffled
   * after it. Shuffle off: back to the original order, still on the same track.
   */
  setShuffle(on: boolean): void {
    const state = this.store.get();
    if (on === state.shuffle) return;
    if (on) {
      this.original = [...state.queue];
      const current = this.currentItem();
      const rest = shuffled(state.queue.filter((entry) => entry.key !== current?.key));
      const queue = current ? [current, ...rest] : rest;
      this.commit({ queue, index: current ? 0 : -1, shuffle: true });
    } else {
      const source = this.original ?? state.queue;
      const present = new Set(state.queue.map((entry) => entry.key));
      const ordered = source.filter((entry) => present.has(entry.key));
      const missing = state.queue.filter((entry) => !ordered.includes(entry));
      const queue = [...ordered, ...missing];
      const index = queue.findIndex((entry) => entry.key === state.currentKey);
      this.original = null;
      this.commit({ queue, index: Math.max(0, index), shuffle: false });
    }
    this.invalidatePreload();
  }

  toggleShuffle(): void {
    this.setShuffle(!this.store.get().shuffle);
  }

  setRepeat(repeat: RepeatMode): void {
    this.commit({ repeat });
    this.invalidatePreload();
  }

  cycleRepeat(): void {
    const { repeat } = this.store.get();
    this.setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off');
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.store.set({ volume: clamped, muted: false });
    updateSettings({ volume: clamped, muted: false });
    this.applyOutput();
  }

  nudgeVolume(delta: number): void {
    this.setVolume(this.store.get().volume + delta);
  }

  toggleMute(): void {
    const muted = !this.store.get().muted;
    this.store.set({ muted });
    updateSettings({ muted });
    this.applyOutput();
  }

  setRate(rate: number): void {
    const clamped = Math.round(Math.max(0.5, Math.min(2, rate)) * 100) / 100;
    this.store.set({ rate: clamped });
    updateSettings({ playbackRate: clamped });
    if (this.els) for (const slot of [0, 1] as Slot[]) this.applyRate(this.els[slot], this.songFor(this.slotItem[slot]));
    this.updatePositionState();
  }

  toggleAutoplay(): void {
    const autoplay = !this.store.get().autoplay;
    this.store.set({ autoplay });
    updateSettings({ autoplay });
  }

  setSleep(timer: SleepTimer | null): void {
    if (this.sleepTimeout) clearTimeout(this.sleepTimeout);
    this.sleepTimeout = null;
    this.cancelSleepFade();
    this.store.set({ sleep: timer });
    if (timer?.mode === 'countdown') {
      const wait = Math.max(0, timer.endsAt - Date.now() - SLEEP_FADE_MS);
      this.sleepTimeout = setTimeout(() => this.sleepFadeOut(), wait);
    }
  }

  private sleepFadeOut(): void {
    this.sleepTimeout = null;
    if (!this.store.get().playing) {
      this.store.set({ sleep: null });
      return;
    }
    const began = Date.now();
    this.sleepFadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - began) / SLEEP_FADE_MS);
      this.sleepGain = 1 - progress;
      this.applyOutput();
      if (progress >= 1) {
        this.cancelSleepFade();
        this.pause();
        this.store.set({ sleep: null });
        ui.toast('sleep timer — goodnight');
      }
    }, 60);
  }

  private cancelSleepFade(): void {
    if (this.sleepFadeTimer) {
      clearInterval(this.sleepFadeTimer);
      this.sleepFadeTimer = null;
      // A fade the listener interrupted also ends the timer.
      if (this.store.get().sleep?.mode === 'countdown' && this.sleepTimeout === null) this.store.set({ sleep: null });
    }
    if (this.sleepGain !== 1) {
      this.sleepGain = 1;
      this.applyOutput();
    }
  }

  /** A-B repeat: first press marks A, the second marks B, the third clears. */
  cycleLoop(): void {
    const state = this.store.get();
    if (!state.current || state.current.isRadio) return;
    const time = this.currentTime();
    const loop = state.loop;
    if (!loop) {
      this.store.set({ loop: { a: time, b: null } });
      ui.toast('loop — point A set');
    } else if (loop.b === null) {
      if (time <= loop.a + 0.5) {
        ui.toast('loop — B has to come after A');
        return;
      }
      this.store.set({ loop: { a: loop.a, b: time } });
      this.seek(loop.a);
      this.startLoopTimer();
      ui.toast('loop — on');
    } else {
      this.store.set({ loop: null });
      this.stopLoopTimer();
      ui.toast('loop — off');
    }
  }

  clearLoop(): void {
    this.store.set({ loop: null });
    this.stopLoopTimer();
  }

  snapshot(): QueueSnapshot {
    const state = this.store.get();
    return {
      queue: [...state.queue],
      index: state.index,
      original: this.original ? [...this.original] : null,
      context: state.context,
      playing: state.playing,
      time: this.currentTime(),
    };
  }

  /** Undo for queue edits. Resumes the old track if the edit changed it. */
  restore(snapshot: QueueSnapshot): void {
    const before = this.store.get().currentKey;
    this.original = snapshot.original;
    this.commit({ queue: snapshot.queue, index: snapshot.index, context: snapshot.context, shuffle: snapshot.original !== null });
    const after = this.store.get().currentKey;
    if (after !== before) this.start({ at: snapshot.time, autoplay: snapshot.playing, force: true });
    else this.invalidatePreload();
  }

  /** Replace the queue's songs without touching playback — used by queue sync. */
  adoptQueue(songs: Song[], index: number, time: number, context: PlaybackContextInfo | null): void {
    this.pause();
    this.original = null;
    const items = songs.map((song) => this.item(song));
    const at = Math.min(Math.max(0, index), items.length - 1);
    this.loadToken += 1;
    this.unload(0);
    this.unload(1);
    this.commit({ queue: items, index: at, shuffle: false, context });
    this.progress.set({ time, buffered: 0 });
    this.store.set({ duration: items[at]?.song.duration ?? 0 });
    this.updateMediaMetadata();
  }
}

/* ---------------------------------------------------------------- exports */

export const player = new PlayerEngine();

export function usePlayer<T>(selector: (state: PlayerState) => T, isEqual?: (a: T, b: T) => boolean): T {
  return useStore(player.store, selector, isEqual);
}

export function useProgress<T>(selector: (state: ProgressState) => T): T {
  return useStore(player.progress, selector);
}

/** Whether a given song is the one loaded right now. */
export function useIsCurrent(songId: string | undefined): boolean {
  return useStore(player.store, (s) => songId !== undefined && s.current?.id === songId);
}
