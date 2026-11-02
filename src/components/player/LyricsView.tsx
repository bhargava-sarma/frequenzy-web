/**
 * Time-synced lyrics.
 *
 * The active line is found from the audio element's own clock on every
 * animation frame, so the highlight lands on the beat rather than up to a
 * quarter of a second late — but the component only re-renders when the line
 * actually changes. Word-timed sheets fill word by word, and that per-frame
 * work happens straight on the DOM.
 *
 * Non-Latin lyrics get a romanized reading so they can be sung along to; the
 * original stays above it, because the point is transliteration, never
 * translation.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Spinner } from '../controls';
import { LanguageIcon, MinusIcon, PlusIcon, RefreshIcon, SearchIcon, TextSizeIcon } from '../Icons';
import {
  activeLineIndex, fetchLyrics, forgetLyrics, lyricsOffset, lyricsRevision, romanizeLyrics, setLyricsOffset,
  subscribeLyricsRevision, type LyricLine, type Lyrics,
} from '../../lib/lyrics';
import { preloadRomanizers } from '../../lib/romanize';
import type { Song } from '../../lib/types';
import { player, usePlayer } from '../../state/player';
import { updateSettings, useSettings, type LyricsSize } from '../../state/settings';
import { ui } from '../../state/ui';

/** How long auto-scroll stays out of the way after the listener scrolls. */
const MANUAL_SCROLL_GRACE = 4000;
/** A gap longer than this between lines is shown as an instrumental break. */
const INTERLUDE_GAP = 6;

const SIZES: LyricsSize[] = ['s', 'm', 'l'];

export function LyricsView({ song, variant = 'full' }: { song: Song; variant?: 'panel' | 'full' }) {
  const romanization = useSettings((s) => s.romanization);
  const showOriginal = useSettings((s) => s.showOriginalWithRomanization);
  const tones = useSettings((s) => s.pinyinTones);
  const size = useSettings((s) => s.lyricsSize);
  const isCurrent = usePlayer((s) => s.current?.id === song.id);
  const revision = useSyncExternalStore(subscribeLyricsRevision, lyricsRevision, lyricsRevision);

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [romanizing, setRomanizing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(() => lyricsOffset(song.id));
  const [active, setActive] = useState(-1);
  const [interlude, setInterlude] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const manualAt = useRef(0);
  const programmatic = useRef(false);

  /* ------------------------------------------------------------- fetching */

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setStatus('loading');
    setLyrics(null);
    setActive(-1);
    setOffset(lyricsOffset(song.id));
    fetchLyrics(song, controller.signal)
      .then((result) => {
        if (!alive) return;
        setLyrics(result);
        setStatus('ready');
        preloadRomanizers(result.profile);
      })
      .catch(() => {
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
      controller.abort();
    };
    // `song` is keyed by id; a re-render with the same song must not refetch.
  }, [song.id, attempt, revision]);

  const wantsRoman =
    romanization === 'always' || (romanization === 'auto' && (lyrics?.profile.needsRomanization ?? false));

  useEffect(() => {
    if (!lyrics || !wantsRoman || lyrics.romanized || lyrics.lines.length === 0 || !lyrics.profile.needsRomanization) return;
    let alive = true;
    setRomanizing(true);
    romanizeLyrics(song.id, lyrics, tones)
      .then((result) => {
        if (alive) setLyrics(result);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setRomanizing(false);
      });
    return () => {
      alive = false;
    };
  }, [lyrics, song.id, tones, wantsRoman]);

  /* -------------------------------------------------------------- syncing */

  const timeline = useCallback(() => player.currentTime() + (lyrics?.offset ?? 0) - offset, [lyrics, offset]);

  useEffect(() => {
    if (!lyrics?.synced || !isCurrent) {
      setActive(-1);
      setInterlude(false);
      return;
    }
    let frame = 0;
    let lastIndex = -2;
    let lastInterlude = false;
    const lines = lyrics.lines;
    const step = () => {
      const t = timeline();
      const index = activeLineIndex(lines, t, 0);
      if (index !== lastIndex) {
        lastIndex = index;
        setActive(index);
      }
      const next = lines[index + 1];
      const from = lines[index]?.time ?? 0;
      const gap = next?.time !== null && next?.time !== undefined ? next.time - from : 0;
      const resting = gap > INTERLUDE_GAP && (next!.time as number) - t > 1.5 && (index < 0 || !lines[index].text.trim() || t - from > 4);
      if (resting !== lastInterlude) {
        lastInterlude = resting;
        setInterlude(resting);
      }
      frame = requestAnimationFrame(step);
    };
    // While hidden, a quarter-second interval is plenty and costs nothing.
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        interval = setInterval(step, 250);
      } else {
        if (interval) clearInterval(interval);
        interval = null;
        frame = requestAnimationFrame(step);
      }
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      cancelAnimationFrame(frame);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', start);
    };
  }, [isCurrent, lyrics, timeline]);

  /* ------------------------------------------------------------ scrolling */

  useLayoutEffect(() => {
    if (active < 0) return;
    if (Date.now() - manualAt.current < MANUAL_SCROLL_GRACE) return;
    const container = scrollRef.current;
    const line = lineRefs.current[active];
    if (!container || !line) return;
    const target = line.offsetTop - container.clientHeight * 0.36 + line.offsetHeight / 2;
    programmatic.current = true;
    container.scrollTo({ top: Math.max(0, target), behavior: document.hidden ? 'auto' : 'smooth' });
    window.setTimeout(() => (programmatic.current = false), 600);
  }, [active, size, romanizing]);

  const onManualScroll = () => {
    if (!programmatic.current) manualAt.current = Date.now();
  };

  const nudge = (delta: number) => {
    const next = Math.round((offset + delta) * 10) / 10;
    setOffset(next);
    setLyricsOffset(song.id, next);
    ui.toast(next === 0 ? 'lyrics timing reset' : `lyrics ${next > 0 ? 'later' : 'earlier'} by ${Math.abs(next).toFixed(1)} s`);
  };

  /* -------------------------------------------------------------- render */

  if (status === 'loading') {
    return (
      <div className={`lyrics lyrics--${variant} lyrics--state`}>
        <Spinner large />
      </div>
    );
  }

  if (status === 'error' || !lyrics || lyrics.lines.length === 0) {
    const instrumental = lyrics?.instrumental ?? false;
    return (
      <div className={`lyrics lyrics--${variant} lyrics--state`}>
        <div className="lyrics__empty">
          <div className="lyrics__empty-title">{instrumental ? 'instrumental' : 'no lyrics'}</div>
          <p className="lyrics__empty-note">
            {instrumental
              ? 'This track has no words.'
              : status === 'error'
                ? 'The lyrics could not be loaded.'
                : 'Nothing attached to the file, and LRCLIB had no match for this title and artist.'}
          </p>
          <div className="lyrics__empty-keys">
            <button type="button" className="key key--sm" onClick={() => ui.openDialog({ type: 'lyricsSearch', song })}>
              <SearchIcon /> find lyrics
            </button>
            <button
              type="button"
              className="key key--sm"
              onClick={() => {
                forgetLyrics(song.id);
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshIcon /> try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lines = lyrics.lines;
  const nextIndex = active + 1;

  return (
    <div className={`lyrics lyrics--${variant} lyrics--${size}`}>
      <div className="lyrics__bar">
        {lyrics.profile.needsRomanization && (
          <button
            type="button"
            className={`chip ${wantsRoman ? 'is-on' : ''}`}
            title="Transliterate into the Latin alphabet — the sound, not a translation"
            onClick={() => updateSettings({ romanization: wantsRoman ? 'never' : 'always' })}
          >
            <LanguageIcon /> {romanizing ? 'romanizing…' : 'romaji'}
          </button>
        )}
        {wantsRoman && lyrics.profile.needsRomanization && (
          <button
            type="button"
            className={`chip ${showOriginal ? 'is-on' : ''}`}
            onClick={() => updateSettings({ showOriginalWithRomanization: !showOriginal })}
          >
            original
          </button>
        )}
        <button
          type="button"
          className="chip"
          title="Text size"
          onClick={() => updateSettings({ lyricsSize: SIZES[(SIZES.indexOf(size) + 1) % SIZES.length] })}
        >
          <TextSizeIcon /> {size}
        </button>
        {lyrics.synced && (
          <span className="lyrics__offset" title="Shift the timing for this song">
            <button type="button" className="ibtn ibtn--sm" aria-label="Lyrics earlier" onClick={() => nudge(-0.2)}>
              <MinusIcon />
            </button>
            <button type="button" className="lyrics__offset-value tnum" onClick={() => offset !== 0 && nudge(-offset)}>
              {offset > 0 ? '+' : ''}
              {offset.toFixed(1)}s
            </button>
            <button type="button" className="ibtn ibtn--sm" aria-label="Lyrics later" onClick={() => nudge(0.2)}>
              <PlusIcon />
            </button>
          </span>
        )}
        <span className="lyrics__source label">
          {lyrics.synced ? 'synced' : 'static'} · {lyrics.source === 'lrclib' ? 'lrclib' : 'file'}
        </span>
        <button
          type="button"
          className="ibtn ibtn--sm"
          aria-label="Find different lyrics"
          title="Find different lyrics"
          onClick={() => ui.openDialog({ type: 'lyricsSearch', song })}
        >
          <SearchIcon />
        </button>
      </div>

      <div className="lyrics__scroll" ref={scrollRef} onScroll={onManualScroll} onWheel={() => (manualAt.current = Date.now())} onTouchMove={() => (manualAt.current = Date.now())}>
        <div className="lyrics__pad" />
        {lines.map((line, i) => {
          const isActive = i === active && !interlude;
          const state = isActive ? 'is-active' : i < active ? 'is-past' : '';
          const roman = wantsRoman ? line.romanized : undefined;
          const blank = !line.text.trim();
          if (blank) {
            return (
              <div key={i} ref={(el) => (lineRefs.current[i] = el)} className="lyric-gap">
                {i === nextIndex - 1 && interlude ? <Dots /> : null}
              </div>
            );
          }
          return (
            <div key={i} className="lyric-wrap">
              {interlude && i === nextIndex && lines[active]?.text.trim() !== '' && <Dots />}
              <button
                type="button"
                ref={(el) => (lineRefs.current[i] = el)}
                className={`lyric ${state} ${lyrics.synced ? '' : 'is-static'}`}
                onClick={() => {
                  if (line.time === null || !isCurrent) return;
                  manualAt.current = 0;
                  player.seek(Math.max(0, line.time - (lyrics.offset ?? 0) + offset));
                }}
              >
                {roman ? (
                  <>
                    {showOriginal && <span className="lyric__original">{line.text}</span>}
                    <span className="lyric__roman">{roman}</span>
                  </>
                ) : line.words && isActive ? (
                  <WordLine line={line} timeline={timeline} />
                ) : (
                  line.text
                )}
              </button>
            </div>
          );
        })}
        <div className="lyrics__pad lyrics__pad--end" />
      </div>
    </div>
  );
}

function Dots() {
  return (
    <div className="lyric-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

/** Word-by-word fill for enhanced LRC, driven on the DOM every frame. */
const WordLine = memo(function WordLine({ line, timeline }: { line: LyricLine; timeline: () => number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const step = () => {
      const el = ref.current;
      if (el) {
        const t = timeline();
        const words = el.children;
        for (let i = 0; i < words.length; i++) {
          const word = words[i] as HTMLElement;
          const at = Number(word.dataset.t);
          word.classList.toggle('is-sung', t >= at);
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [timeline]);
  return (
    <span ref={ref}>
      {line.words!.map((word, i) => (
        <span key={i} className="lyric__word" data-t={word.time}>
          {word.text}
        </span>
      ))}
    </span>
  );
});
