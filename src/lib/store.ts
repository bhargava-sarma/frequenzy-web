/**
 * A very small external store.
 *
 * React context re-renders every consumer whenever any part of its value
 * changes. The player's clock ticks four times a second, so with context every
 * track row and every album card in the app was re-rendering four times a
 * second just because something, somewhere, was playing. A store with
 * selectors lets each component subscribe to exactly the slice it draws: a row
 * asks "is my song the current one?" and only re-renders when that answer
 * flips.
 */

import { useRef, useSyncExternalStore } from 'react';

export type Listener = () => void;

export interface Store<S> {
  get(): S;
  set(patch: Partial<S> | ((state: S) => Partial<S>)): void;
  subscribe(listener: Listener): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      let changed = false;
      for (const key in next) {
        if (!Object.is(next[key], state[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** True when two plain objects or arrays hold the same values one level down. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

interface SnapshotCache<S, T> {
  state: S;
  selector: (state: S) => T;
  value: T;
}

/**
 * Subscribe to a slice of a store.
 *
 * The cache is keyed on both the state and the selector, because selectors
 * often close over props (a row asking about *its* song id) and a cache keyed
 * on state alone would hand a recycled row the previous row's answer. When the
 * recomputed value is equal to the last one, the old reference is returned so
 * React sees no change.
 */
export function useStore<S, T>(
  store: Store<S>,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = useRef<SnapshotCache<S, T> | null>(null);

  const getSnapshot = (): T => {
    const state = store.get();
    const cached = cacheRef.current;
    if (cached && cached.state === state && cached.selector === selector) return cached.value;
    const next = selector(state);
    const value = cached && isEqual(cached.value, next) ? cached.value : next;
    cacheRef.current = { state, selector, value };
    return value;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
