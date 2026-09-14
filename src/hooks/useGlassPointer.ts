/**
 * Pointer tracking for a glass surface.
 *
 * Publishes where the cursor is over an element as CSS custom properties, so a
 * specular highlight can follow it and — where asked for — the surface can lean
 * a degree or two toward it. Both are registered properties, so the browser
 * interpolates them and the highlight glides rather than teleporting.
 *
 * Writes are batched into one animation frame. A pointer can fire a hundred
 * and twenty events a second on a high-rate display, and a style write per
 * event is a style recalculation per event.
 */

import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

interface Options {
  /** Maximum lean, in degrees. Omit for a flat surface that only lights up. */
  tilt?: number;
}

export function useGlassPointer<T extends HTMLElement>({ tilt = 0 }: Options = {}) {
  const ref = useRef<T | null>(null);
  const frame = useRef(0);
  const pending = useRef({ x: 50, y: 0, tiltX: 0, tiltY: 0 });

  const commit = useCallback(() => {
    frame.current = 0;
    const el = ref.current;
    if (!el) return;
    const { x, y, tiltX, tiltY } = pending.current;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
    if (tilt) {
      el.style.setProperty('--tilt-x', `${tiltX}deg`);
      el.style.setProperty('--tilt-y', `${tiltY}deg`);
    }
  }, [tilt]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(commit);
  }, [commit]);

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      pending.current = {
        x: px * 100,
        y: py * 100,
        // Lean away from the cursor on Y and toward it on X, which is how a
        // physical panel pivoting under a fingertip actually behaves.
        tiltY: (px - 0.5) * 2 * tilt,
        tiltX: (0.5 - py) * 2 * tilt,
      };
      schedule();
    },
    [schedule, tilt],
  );

  const onPointerLeave = useCallback(() => {
    pending.current = { x: 50, y: 0, tiltX: 0, tiltY: 0 };
    schedule();
  }, [schedule]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { ref, onPointerMove, onPointerLeave };
}
