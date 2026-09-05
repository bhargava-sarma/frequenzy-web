/**
 * Time-synced lyrics.
 *
 * The active line is centred and sharpened while its neighbours sit back,
 * blurred and dimmed — the depth-of-field effect Apple Music uses. Non-Latin
 * lyrics get a romanized reading so they can still be sung along to; the
 * original stays visible above it, because the point is transliteration, never
 * translation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LanguageIcon } from './Icons';
import { activeLineIndex, fetchLyrics, romanizeLyrics, type Lyrics } from '../lib/lyrics';
import { preloadRomanizers } from '../lib/romanize';
import type { Song } from '../lib/types';
import { usePlayer } from '../state/player';
import { useSettings } from '../state/settings';

/** How long to leave auto-scroll disabled after the user scrolls by hand. */
const MANUAL_SCROLL_GRACE = 4500;
/** A gap longer than this between lines is treated as an instrumental break. */
const INTERLUDE_GAP = 6;

export function LyricsView({ song }: { song: Song }) {
  const { currentTime, actions } = usePlayer();
  const { settings, update } = useSettings();

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [romanizing, setRomanizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const lastManualScroll = useRef(0);
  const lastScrolledIndex = useRef(-1);

  /* ------------------------------------------------------------------ fetch */

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setLyrics(null);
    lastScrolledIndex.current = -1;

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
  }, [song]);

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

  /* ------------------------------------------------------------------ render */

  if (loading) {
    return (
      <div className="fz-lyrics" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="fz-spinner" />
      </div>
    );
  }

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <div className="fz-lyrics" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
            {lyrics?.instrumental ? 'Instrumental' : 'No lyrics available'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {lyrics?.instrumental
              ? 'This track has no words.'
              : 'Nothing on the server, and LRCLIB has no match for this track.'}
          </div>
        </div>
      </div>
    );
  }

  const showOriginal = wantsRomanization && settings.showOriginalWithRomanization;

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
