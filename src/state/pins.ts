/**
 * Pinned items: albums, artists and playlists kept one click away in the
 * sidebar and at the top of the Library tab. Local to this device.
 */

import { createStore, useStore } from '../lib/store';

export interface Pin {
  type: 'album' | 'artist' | 'playlist';
  id: string;
  name: string;
  coverArt?: string;
}

const KEY = 'frequenzy.pins.v1';
const LIMIT = 24;

function load(): Pin[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((p) => p?.id && p?.type && p?.name) : [];
  } catch {
    return [];
  }
}

export const pinsStore = createStore<{ pins: Pin[] }>({ pins: load() });

pinsStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(pinsStore.get().pins));
  } catch {
    /* ignore */
  }
});

export function isPinned(type: Pin['type'], id: string): boolean {
  return pinsStore.get().pins.some((p) => p.type === type && p.id === id);
}

/** Returns true when the item is now pinned. */
export function togglePin(pin: Pin): boolean {
  if (isPinned(pin.type, pin.id)) {
    pinsStore.set((s) => ({ pins: s.pins.filter((p) => !(p.type === pin.type && p.id === pin.id)) }));
    return false;
  }
  pinsStore.set((s) => ({ pins: [pin, ...s.pins].slice(0, LIMIT) }));
  return true;
}

export function unpin(type: Pin['type'], id: string): void {
  pinsStore.set((s) => ({ pins: s.pins.filter((p) => !(p.type === type && p.id === id)) }));
}

export function movePin(from: number, to: number): void {
  pinsStore.set((s) => {
    const pins = [...s.pins];
    if (from < 0 || from >= pins.length || to < 0 || to >= pins.length) return {};
    const [moved] = pins.splice(from, 1);
    pins.splice(to, 0, moved);
    return { pins };
  });
}

export function usePins(): Pin[] {
  return useStore(pinsStore, (s) => s.pins);
}

export function useIsPinned(type: Pin['type'], id: string | undefined): boolean {
  return useStore(pinsStore, (s) => (id ? s.pins.some((p) => p.type === type && p.id === id) : false));
}

export function pinRoute(pin: Pin): string {
  return `/${pin.type}/${encodeURIComponent(pin.id)}`;
}
