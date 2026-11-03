/**
 * A list that loads a page at a time as you scroll toward its end.
 *
 * Pages are kept per key in memory, so leaving and coming back shows what was
 * already loaded (and scroll restoration has something to restore into).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { useScroller } from './useScroller';

interface PagedState<T> {
  items: T[];
  done: boolean;
  error: boolean;
}

const memory = new Map<string, PagedState<unknown>>();

export interface Paged<T> {
  items: T[];
  loading: boolean;
  done: boolean;
  error: boolean;
  /** Attach to an element near the end of the list. */
  sentinel: RefObject<HTMLDivElement>;
  reload: () => Promise<void>;
  loadMore: () => void;
}

export function usePaged<T>(key: string | null, fetchPage: (offset: number) => Promise<T[]>, pageSize: number): Paged<T> {
  const cached = key ? (memory.get(key) as PagedState<T> | undefined) : undefined;
  const [state, setState] = useState<PagedState<T>>(cached ?? { items: [], done: false, error: false });
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const latestKey = useRef(key);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useScroller();

  const loadMore = useCallback(() => {
    const k = latestKey.current;
    if (!k || busy.current) return;
    const current = (memory.get(k) as PagedState<T> | undefined) ?? { items: [], done: false, error: false };
    if (current.done) return;
    busy.current = true;
    setLoading(true);
    const offset = current.items.length;
    const gen = generation.current;
    fetchRef
      .current(offset)
      .then((page) => {
        if (latestKey.current !== k || gen !== generation.current) return;
        const next: PagedState<T> = {
          items: [...current.items, ...page],
          done: page.length < pageSize,
          error: false,
        };
        memory.set(k, next as PagedState<unknown>);
        setState(next);
      })
      .catch(() => {
        if (latestKey.current !== k || gen !== generation.current) return;
        const next = { ...current, error: true };
        memory.set(k, next as PagedState<unknown>);
        setState(next);
      })
      .finally(() => {
        if (gen !== generation.current) return;
        busy.current = false;
        if (latestKey.current === k) setLoading(false);
      });
  }, [pageSize]);

  // A new key starts from whatever is remembered for it, or from nothing.
  useEffect(() => {
    latestKey.current = key;
    generation.current += 1;
    busy.current = false;
    setLoading(false);
    const remembered = key ? (memory.get(key) as PagedState<T> | undefined) : undefined;
    setState(remembered ?? { items: [], done: false, error: false });
    if (key && !remembered) loadMore();
  }, [key, loadMore]);

  // Ask for the next page when the sentinel comes within a screen of view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !scroller || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: scroller, rootMargin: '0px 0px 900px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, scroller, state.items.length, state.done]);

  const reload = useCallback(async () => {
    const k = latestKey.current;
    if (!k) return;
    memory.delete(k);
    generation.current += 1;
    setState({ items: [], done: false, error: false });
    busy.current = false;
    loadMore();
  }, [loadMore]);

  return {
    items: state.items,
    loading: loading || (state.items.length === 0 && !state.done && !state.error),
    done: state.done,
    error: state.error,
    sentinel,
    reload,
    loadMore,
  };
}

/** Forget every paged list, e.g. after signing out. */
export function clearPaged(): void {
  memory.clear();
}
