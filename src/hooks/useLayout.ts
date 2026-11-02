/**
 * Which shell the app should wear, and what kind of pointer is driving it.
 *
 * Mobile and desktop are genuinely different arrangements here — a tab bar
 * and a sheet player versus a sidebar and a docked deck — so this is a mode,
 * not a pile of breakpoints scattered through components. Each query has one
 * shared listener, however many components ask.
 */

import { useSyncExternalStore } from 'react';

const COMPACT = '(max-width: 899px)';
const TOUCH = '(hover: none) and (pointer: coarse)';
const WIDE = '(min-width: 1280px)';

function mediaStore(query: string) {
  const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;
  return {
    get: () => media?.matches ?? false,
    subscribe(listener: () => void) {
      media?.addEventListener('change', listener);
      return () => media?.removeEventListener('change', listener);
    },
  };
}

const compactStore = mediaStore(COMPACT);
const touchStore = mediaStore(TOUCH);
const wideStore = mediaStore(WIDE);

export function useIsCompact(): boolean {
  return useSyncExternalStore(compactStore.subscribe, compactStore.get, compactStore.get);
}

/** True on devices whose primary input is a finger — drives gesture affordances. */
export function useIsTouch(): boolean {
  return useSyncExternalStore(touchStore.subscribe, touchStore.get, touchStore.get);
}

/** Wide enough for the side panel to take its own column rather than float. */
export function useIsWide(): boolean {
  return useSyncExternalStore(wideStore.subscribe, wideStore.get, wideStore.get);
}

export function isCompactNow(): boolean {
  return compactStore.get();
}

export function isTouchNow(): boolean {
  return touchStore.get();
}
