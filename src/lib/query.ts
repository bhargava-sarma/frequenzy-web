/**
 * Request cache.
 *
 * Every page used to fetch on mount and show skeletons until the answer came
 * back — including when you pressed Back to a page you were looking at two
 * seconds ago. This keeps the last answer per key, hands it over immediately,
 * and quietly revalidates in the background once it is old enough to be worth
 * asking again. Concurrent requests for the same key share one fetch.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

interface Entry {
  data?: unknown;
  error?: Error;
  promise?: Promise<unknown>;
  /** Epoch ms of the last successful fetch; 0 means never, or invalidated. */
  updatedAt: number;
  /** Bumped on every change, which is what subscribers compare. */
  version: number;
  listeners: Set<() => void>;
  /** The most recent fetcher a component registered, so invalidation can refetch. */
  fetcher?: () => Promise<unknown>;
}

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 400;

function entryFor(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { updatedAt: 0, version: 0, listeners: new Set() };
    entries.set(key, entry);
    evict();
  }
  return entry;
}

/** Drop the oldest unwatched entries once the cache grows past its budget. */
function evict(): void {
  if (entries.size <= MAX_ENTRIES) return;
  const idle = [...entries.entries()]
    .filter(([, entry]) => entry.listeners.size === 0 && !entry.promise)
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [key] of idle.slice(0, entries.size - MAX_ENTRIES)) entries.delete(key);
}

function notify(entry: Entry): void {
  entry.version += 1;
  for (const listener of [...entry.listeners]) listener();
}

export function fetchQuery<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const entry = entryFor(key);
  if (entry.promise && !force) return entry.promise as Promise<T>;
  const promise: Promise<T> = fetcher().then(
    (data) => {
      if (entry.promise === promise) {
        entry.data = data;
        entry.error = undefined;
        entry.updatedAt = Date.now();
        entry.promise = undefined;
        notify(entry);
      }
      return data;
    },
    (error: unknown) => {
      if (entry.promise === promise) {
        entry.error = error instanceof Error ? error : new Error(String(error));
        entry.promise = undefined;
        notify(entry);
      }
      throw error;
    },
  );
  entry.promise = promise;
  notify(entry);
  return promise;
}

/** Warm the cache ahead of a navigation; a fresh entry is left alone. */
export function prefetchQuery<T>(key: string, fetcher: () => Promise<T>, staleTime = 30_000): void {
  const entry = entryFor(key);
  if (entry.promise || (entry.updatedAt && Date.now() - entry.updatedAt < staleTime)) return;
  void fetchQuery(key, fetcher).catch(() => {});
}

export function getQueryData<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}

/** Write straight into the cache — used for optimistic edits. */
export function setQueryData<T>(key: string, updater: T | ((previous: T | undefined) => T)): void {
  const entry = entryFor(key);
  // A fetch already in flight started before this edit; letting it land would
  // briefly undo the edit. Its caller still gets its answer — the cache does not.
  entry.promise = undefined;
  entry.data =
    typeof updater === 'function' ? (updater as (previous: T | undefined) => T)(entry.data as T | undefined) : updater;
  entry.updatedAt = Date.now();
  notify(entry);
}

/**
 * Mark matching entries stale. Ones somebody is looking at are refetched now;
 * the rest keep their data and revalidate the next time they are shown.
 */
export function invalidateQueries(match: string | ((key: string) => boolean)): void {
  const test = typeof match === 'string' ? (key: string) => key === match || key.startsWith(`${match}:`) : match;
  for (const [key, entry] of entries) {
    if (!test(key)) continue;
    entry.updatedAt = 0;
    if (entry.listeners.size > 0 && entry.fetcher) void fetchQuery(key, entry.fetcher, true).catch(() => {});
  }
}

export function clearQueries(): void {
  entries.clear();
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  /** True until the first answer arrives — show a skeleton. */
  loading: boolean;
  /** True while a background revalidation is running over existing data. */
  refreshing: boolean;
  reload: () => Promise<void>;
}

const noop = () => () => {};

/**
 * Read a cached request. `key` is the identity of the request; pass null to
 * skip. The fetcher is read through a ref, so it does not need to be stable.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { staleTime?: number } = {},
): QueryState<T> {
  const staleTime = options.staleTime ?? 30_000;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!key) return noop();
      const entry = entryFor(key);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    [key],
  );

  const getSnapshot = () => (key ? entryFor(key).version : -1);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!key) return;
    const entry = entryFor(key);
    entry.fetcher = () => fetcherRef.current();
    const stale = entry.updatedAt === 0 || Date.now() - entry.updatedAt > staleTime;
    // Runs once per mount (or key change), so a failed request is retried when
    // its page is shown again but never retried in a loop.
    if (!entry.promise && stale) void fetchQuery(key, entry.fetcher).catch(() => {});
  }, [key, staleTime]);

  const reload = useCallback(async () => {
    if (!key) return;
    const entry = entryFor(key);
    await fetchQuery(key, entry.fetcher ?? (() => fetcherRef.current()), true).catch(() => {});
  }, [key]);

  if (!key) return { data: undefined, error: null, loading: false, refreshing: false, reload };

  const entry = entryFor(key);
  const hasData = entry.data !== undefined;
  return {
    data: entry.data as T | undefined,
    error: hasData ? null : (entry.error ?? null),
    loading: !hasData && !entry.error,
    refreshing: hasData && entry.promise !== undefined,
    reload,
  };
}
