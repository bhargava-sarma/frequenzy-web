/**
 * The mini player, docked above the tab bar.
 *
 * Tap or flick it up for the full player; swipe it sideways to skip. The axis
 * is decided once per gesture, so a slightly diagonal flick does one thing.
 */

import { useRef, useState, type PointerEvent } from 'react';

import { Artwork } from '../Artwork';
import { NextKey, PlayKey } from '../player/Transport';
import { songArtist } from '../../lib/format';
import { player, usePlayer, useProgress } from '../../state/player';
import { haptic, ui } from '../../state/ui';

function MiniProgress() {
  const time = useProgress((p) => p.time);
  const duration = usePlayer((s) => s.duration);
  const fraction = duration > 0 ? Math.min(1, time / duration) : 0;
  return (
    <div className="mini__progress" aria-hidden="true">
      <div style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}

export function MiniPlayer() {
  const current = usePlayer((s) => s.current);
  const [nudge, setNudge] = useState(0);
  const gesture = useRef({ x: 0, y: 0, t: 0, active: false, axis: 'none' as 'none' | 'x' | 'y', used: false });

  if (!current) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement).closest('button')) return;
    gesture.current = { x: event.clientX, y: event.clientY, t: performance.now(), active: true, axis: 'none', used: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (g.axis === 'none') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // A flick upward leaves the bar almost immediately; keep the pointer.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (g.axis === 'x') setNudge(Math.max(-80, Math.min(80, dx * 0.4)));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    setNudge(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    const elapsed = Math.max(1, performance.now() - g.t);
    if (g.axis === 'x' && (Math.abs(dx) > 64 || Math.abs(dx / elapsed) > 0.5)) {
      g.used = true;
      haptic(8);
      if (dx < 0) player.next();
      else player.previous();
    } else if (g.axis === 'y' && (dy < -36 || dy / elapsed < -0.4)) {
      g.used = true;
      ui.openFullPlayer();
    } else if (g.axis !== 'none') {
      g.used = true;
    }
  };

  return (
    <div
      className="mini"
      role="button"
      tabIndex={0}
      aria-label={`Now playing: ${current.title}. Open the player`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current.active = false;
        setNudge(0);
      }}
      onClick={(event) => {
        if (gesture.current.used) {
          gesture.current.used = false;
          return;
        }
        if ((event.target as HTMLElement).closest('button')) return;
        ui.openFullPlayer();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') ui.openFullPlayer();
      }}
    >
      <MiniProgress />
      <Artwork coverArt={current.coverArt} name={current.title} size={44} className="mini__art" eager />
      <div className="mini__text" style={nudge ? { transform: `translateX(${nudge}px)` } : undefined}>
        <span className="mini__title truncate">{current.title}</span>
        <span className="mini__sub truncate">{songArtist(current)}</span>
      </div>
      <div className="mini__keys">
        <PlayKey size="sm" />
        <NextKey size="sm" className="tkey--flat" />
      </div>
    </div>
  );
}
