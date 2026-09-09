/**
 * Time-synced lyrics.
 *
 * The active line is centred and sharpened while its neighbours sit back,
 * blurred and dimmed — the depth-of-field effect Apple Music uses — with a
 * single highlight that glides from line to line rather than being redrawn
 * under each one.
 *
 * Non-Latin lyrics get a romanized reading so they can still be sung along to;
 * the original stays visible above it, because the point is transliteration,
 * never translation.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { HistoryIcon, LanguageIcon } from './Icons';
import { activeLineIndex, fetchLyrics, forgetLyrics, romanizeLyrics, type Lyrics } from '../lib/lyrics';
import { preloadRomanizers } from '../lib/romanize';
import type { Song } from '../lib/types';
import { usePlayer } from '../state/player';
import { useSettings } from '../state/settings';

/** How long to leave auto-scroll disabled after the user scrolls by hand. */
const MANUAL_SCROLL_GRACE = 4500;
/** A gap longer than this between lines is treated as an instrumental break. */
const INTERLUDE_GAP = 6;
/** Breathing room between the words and the edge of the highlight. */
const MARKER_PAD = 15;

export function LyricsView({ song }: { song: Song }) {
  const { currentTime, actions } = usePlayer();
  const { settings, update } = useSettings();

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [romanizing, setRomanizing] = useState(false);
  /** Bumped by "Try Again"; it is the fetch effect's only other dependency. */
  const [attempt, setAttempt] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const markerPlaced = useRef(false);
  const lastManualScroll = useRef(0);
  const lastScrolledIndex = useRef(-1);

  const retry = useCallback(() => {
    forgetLyrics(song.id);
    setAttempt((n) => n + 1);
  }, [song.id]);

  /* ------------------------------------------------------------------ fetch */

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setLyrics(null);
    lastScrolledIndex.current = -1;
    markerPlaced.current = false;

    fetchLyrics(song, controller.signal)
      .then((result) => {
        if (!alive) return;
        setLyrics(result);
        setLoading(false);
        preloadRomanizers(result.profile);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [song, attempt]);

  /* ------------------------------------------------------------ romanization */

  const wantsRomanization =
    settings.romanization === 'always' ||
    (settings.romanization === 'auto' && (lyrics?.profile.needsRomanization ?? false));

  useEffect(() => {
    if (!lyrics || !wantsRomanization || lyrics.romanized || lyrics.lines.length === 0) return;
    let alive = true;
    setRomanizing(true);
    romanizeLyrics(song.id, lyrics, settings.pinyinTones)
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
  }, [lyrics, settings.pinyinTones, song.id, wantsRomanization]);

  /* -------------------------------------------------------------- active line */

  const activeIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    return activeLineIndex(lyrics.lines, currentTime, lyrics.offset);
  }, [currentTime, lyrics]);

  /** True when we are sitting in a long instrumental gap before the next line. */
  const inInterlude = useMemo(() => {
    if (!lyrics?.synced) return false;
    const next = lyrics.lines[activeIndex + 1];
    const active = lyrics.lines[activeIndex];
    if (!next?.time) return false;
    const from = active?.time ?? 0;
    return next.time - from > INTERLUDE_GAP && next.time - (currentTime + lyrics.offset) > 1.6;
  }, [activeIndex, currentTime, lyrics]);

  /* -------------------------------------------------------------- auto scroll */

  useEffect(() => {
    if (activeIndex < 0 || activeIndex === lastScrolledIndex.current) return;
    if (Date.now() - lastManualScroll.current < MANUAL_SCROLL_GRACE) return;

    const container = scrollRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;

    lastScrolledIndex.current = activeIndex;
    // Centre the active line rather than merely bringing it into view.
    const target = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  const onManualScroll = useCallback(() => {
    lastManualScroll.current = Date.now();
  }, []);

  /* ------------------------------------------------------ travelling highlight */

  const showOriginal = wantsRomanization && settings.showOriginalWithRomanization;

  /**
   * One highlight for the whole sheet, moved to the active line.
   *
   * Drawing a background on `.is-active` instead would mean the rectangle
   * blinks out on one line and in on another, half a beat apart, so it never
   * appears to travel with the words. Measuring the line and sliding a single
   * element is what makes it read as one moving object.
   */
  const placeMarker = useCallback(
    (animate = markerPlaced.current) => {
      const el = markerRef.current;
      const line = lineRefs.current[activeIndex];
      if (!el) return;

      if (activeIndex < 0 || !line || !lyrics?.lines[activeIndex]?.text.trim()) {
        // Nothing to sit behind — during an instrumental it fades where it is.
        el.style.opacity = '0';
        return;
      }

      // Hug the words rather than the row: a lyric line is a full-width button,
      // and a band running the whole way across reads as a table selection.
      let left = line.offsetLeft;
      let width = line.offsetWidth;
      const range = document.createRange();
      range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      if (text.width > 0) {
        const box = line.getBoundingClientRect();
        left = line.offsetLeft + (text.left - box.left) - MARKER_PAD;
        width = Math.min(line.offsetWidth, text.width + MARKER_PAD * 2);
      }

      if (!animate) el.style.transition = 'none';
      el.style.transform = `translate3d(${left}px, ${line.offsetTop}px, 0)`;
      el.style.width = `${width}px`;
      el.style.height = `${line.offsetHeight}px`;
      el.style.opacity = '1';
      if (!animate) {
        void el.offsetHeight;
        el.style.transition = '';
      }
      // Only now: a hidden marker was never placed, and animating out of the
      // top-left corner the first time a line lands is exactly what the flag
      // exists to prevent.
      markerPlaced.current = true;
    },
    [activeIndex, lyrics],
  );

  useLayoutEffect(() => {
    placeMarker();
  }, [placeMarker, showOriginal, romanizing]);

  /** Lines reflow when the panel is resized; the highlight has to follow. */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => placeMarker(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [placeMarker]);

  /* ------------------------------------------------------------------ render */

  if (loading) {
    return (
      <div className="fz-lyrics" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="fz-spinner" />
      </div>
    );
  }

  if (!lyrics || lyrics.lines.length === 0) {
    const instrumental = lyrics?.instrumental ?? false;
    return (
      <div className="fz-lyrics fz-lyrics--empty">
        <div className="fz-lyrics__empty">
          <div className="fz-lyrics__empty-title">
            {instrumental ? 'Instrumental' : 'No lyrics found'}
          </div>
          <div className="fz-lyrics__empty-note">
            {instrumental
              ? 'This track has no words.'
              : 'Nothing attached to the file, and LRCLIB had no match for this title, artist and length.'}
          </div>
          {/* Worth offering even for an instrumental: the tag may be wrong. */}
          <button type="button" className="fz-btn fz-btn--glass fz-lyrics__retry" onClick={retry}>
            <HistoryIcon /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fz-lyrics__toolbar">
        {lyrics.profile.needsRomanization && (
          <button
            type="button"
            className={`fz-chip ${wantsRomanization ? 'is-on' : ''}`}
            onClick={() => update({ romanization: wantsRomanization ? 'never' : 'always' })}
            title="Transliterate into the Latin alphabet — the sound, not a translation"
          >
            <LanguageIcon />
            {romanizing ? 'Romanizing…' : 'Romanized'}
          </button>
        )}
        {wantsRomanization && (
          <button
            type="button"
            className={`fz-chip ${settings.showOriginalWithRomanization ? 'is-on' : ''}`}
            onClick={() => update({ showOriginalWithRomanization: !settings.showOriginalWithRomanization })}
          >
            Original
          </button>
        )}
        <span className="fz-lyrics__source">
          {lyrics.synced ? 'Synced' : 'Static'} · {lyrics.source === 'lrclib' ? 'LRCLIB' : 'Library'}
        </span>
      </div>

      <div className="fz-lyrics">
        <div className="fz-lyrics__scroll fz-scroll" ref={scrollRef} onWheel={onManualScroll} onTouchMove={onManualScroll}>
          {lyrics.synced && <div className="fz-lyrics__marker" ref={markerRef} aria-hidden="true" />}
          {lyrics.lines.map((line, i) => {
            const isActive = i === activeIndex;
            const state = isActive ? 'is-active' : i < activeIndex ? 'is-past' : i === activeIndex + 1 ? 'is-next' : '';
            const roman = wantsRomanization ? line.romanized : undefined;
            const empty = line.text.trim().length === 0;

            if (empty) {
              return isActive && inInterlude ? (
                <div key={i} className="fz-lyric-dots" ref={(el) => (lineRefs.current[i] = el)}>
                  <span /><span /><span />
                </div>
              ) : (
                <div key={i} style={{ height: 14 }} ref={(el) => (lineRefs.current[i] = el)} />
              );
            }

            return (
              <button
                key={i}
                type="button"
                ref={(el) => (lineRefs.current[i] = el)}
                className={`fz-lyric ${state}`}
                onClick={() => {
                  if (line.time !== null) actions.seek(Math.max(0, line.time + (lyrics.offset ?? 0)));
                }}
              >
                {roman ? (
                  <>
                    {showOriginal && <span className="fz-lyric__original">{line.text}</span>}
                    <span className="fz-lyric__roman">{roman}</span>
                  </>
                ) : (
                  <WordLine line={line} time={currentTime + lyrics.offset} active={isActive} />
                )}
              </button>
            );
          })}
          {/* Breathing room so the last line can still reach the centre. */}
          <div style={{ height: '38vh' }} />
        </div>
      </div>
    </>
  );
}

/** Word-by-word fill for enhanced LRC sheets; plain text otherwise. */
function WordLine({ line, time, active }: { line: { text: string; words?: { time: number; text: string }[] }; time: number; active: boolean }) {
  if (!line.words || line.words.length === 0) return <>{line.text}</>;
  return (
    <>
      {line.words.map((word, i) => (
        <span key={i} className={`fz-lyric__word ${active && time >= word.time ? 'is-sung' : ''}`}>
          {word.text}
        </span>
      ))}
    </>
  );
}
