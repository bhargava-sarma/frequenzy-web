/**
 * Which shell the app should wear.
 *
 * Mobile and desktop are genuinely different products here — a tab bar and a
 * sheet player versus a sidebar and a docked bar — so this is a mode, not a
 * pile of breakpoints scattered through the CSS.
 */

import { useEffect, useState } from 'react';

export type LayoutMode = 'compact' | 'regular';

const COMPACT_MAX = 899;

function query(): string {
  return `(max-width: ${COMPACT_MAX}px)`;
}

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() =>
    typeof window !== 'undefined' && window.matchMedia(query()).matches ? 'compact' : 'regular',
  );

  useEffect(() => {
    const media = window.matchMedia(query());
    const apply = () => setMode(media.matches ? 'compact' : 'regular');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return mode;
}

export function useIsCompact(): boolean {
  return useLayoutMode() === 'compact';
}

/** True on devices whose primary input is a finger — drives gesture affordances. */
export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => setTouch(media.matches);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return touch;
}
