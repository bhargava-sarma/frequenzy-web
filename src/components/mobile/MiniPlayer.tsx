/**
 * The docked player above the tab bar.
 *
 * Tapping or flicking up expands the full sheet; swiping sideways skips
 * tracks, which is the gesture iOS trains you to expect here.
 */

import { useRef, useState, type PointerEvent } from 'react';

import { Artwork } from '../Artwork';
import { NextIcon, PauseIcon, PlayIcon } from '../Icons';
import { songArtist } from '../../lib/format';
import { usePlayer } from '../../state/player';

export function MiniPlayer({ onExpand }: { onExpand: () => void }) {
  const { current, playing, currentTime, duration, actions } = usePlayer();
  const [nudge, setNudge] = useState(0);
  const start = useRef({ x: 0, y: 0, time: 0, active: false });
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided');

  if (!current) return null;

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    start.current = { x: event.clientX, y: event.clientY, time: performance.now(), active: true };
    axis.current = 'undecided';
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current.active) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (axis.current === 'undecided') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // A flick upward leaves the bar almost immediately, so capture the
      // pointer or the rest of the gesture lands on whatever is above.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (axis.current === 'x') setNudge(dx * 0.3);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current.active) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    const elapsed = Math.max(1, performance.now() - start.current.time);
    start.current.active = false;
    setNudge(0);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (axis.current === 'x' && (Math.abs(dx) > 60 || Math.abs(dx / elapsed) > 0.45)) {
      if (dx < 0) actions.next();
      else actions.previous();
      return;
    }
    // A flick upward is the same as tapping: show me the whole thing.
    if (axis.current === 'y' && (dy < -40 || dy / elapsed < -0.4)) onExpand();
    axis.current = 'undecided';
  };

  return (
    <div
      className="fz-mini"
      role="button"
      tabIndex={0}
      aria-label="Open player"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current.active = false;
        setNudge(0);
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('.fz-mini__btn')) return;
        onExpand();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onExpand();
      }}
    >
      <div className="fz-mini__progress" style={{ width: `${progress}%` }} />

      <div key={current.id} className="fz-swap-art">
        <Artwork coverArt={current.coverArt} name={current.title} size={120} className="fz-mini__art" />
      </div>

      <div
        key={`${current.id}-text`}
        className="fz-mini__text fz-swap-text"
        style={{ transform: `translateX(${nudge}px)` }}
      >
        <span className="fz-mini__title fz-truncate">{current.title}</span>
        <span className="fz-mini__sub fz-truncate">{songArtist(current)}</span>
      </div>

      <div className="fz-mini__actions">
        <button
          type="button"
          className="fz-mini__btn"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={actions.toggle}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className="fz-mini__btn" aria-label="Next" onClick={actions.next}>
          <NextIcon />
        </button>
      </div>
    </div>
  );
}
