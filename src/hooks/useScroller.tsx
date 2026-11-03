/**
 * The one scrolling surface every page lives in, and what hangs off it:
 * scroll restoration on Back, windowed rendering for long lists, and
 * pull-to-refresh.
 *
 * One scroller for the whole app (rather than one per page) is what makes
 * restoring a position possible at all — the element survives navigation, so
 * there is something to put the position back into.
 */

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
  type RefObject,
} from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

interface ScrollerValue {
  /**
   * The element itself, held in state by the shell. A ref would not do:
   * on the first commit a page's layout effects run before the shell's own
   * ref is attached, so they would see null and never subscribe.
   */
  element: HTMLElement | null;
  registerRefresh: (fn: (() => Promise<unknown> | void) | null) => void;
}

const ScrollerContext = createContext<ScrollerValue>({ element: null, registerRefresh: () => {} });

export function ScrollerProvider({
  element, children, onRefreshChange,
}: {
  element: HTMLElement | null;
  children: ReactNode;
  onRefreshChange: (fn: (() => Promise<unknown> | void) | null) => void;
}) {
  const value = useMemo(() => ({ element, registerRefresh: onRefreshChange }), [element, onRefreshChange]);
  return <ScrollerContext.Provider value={value}>{children}</ScrollerContext.Provider>;
}

/** The app's scrolling element, once it exists. */
export function useScroller(): HTMLElement | null {
  return useContext(ScrollerContext).element;
}

/** Let the current page answer a pull-to-refresh. */
export function useRefresh(fn: (() => Promise<unknown> | void) | undefined): void {
  const { registerRefresh } = useContext(ScrollerContext);
  const latest = useRef(fn);
  latest.current = fn;
  const enabled = Boolean(fn);
  useEffect(() => {
    if (!enabled) return;
    registerRefresh(() => latest.current?.());
    return () => registerRefresh(null);
  }, [enabled, registerRefresh]);
}

/* ------------------------------------------------------- scroll restoration */

const positions = new Map<string, number>();
const MAX_POSITIONS = 200;

export function useScrollRestoration(ref: RefObject<HTMLElement | null>): void {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKey = useRef(location.key);

  // Record continuously, under whichever page is showing *now* — reading the
  // key from a ref means a scroll event caused by the next page clamping the
  // height is never filed under the previous one.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        positions.set(currentKey.current, el.scrollTop);
        if (positions.size > MAX_POSITIONS) {
          const oldest = positions.keys().next().value;
          if (oldest !== undefined) positions.delete(oldest);
        }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);

  useLayoutEffect(() => {
    currentKey.current = location.key;
    const el = ref.current;
    if (!el) return;
    const target = navigationType === 'POP' ? (positions.get(location.key) ?? 0) : 0;
    el.scrollTop = target;
    if (target <= 0 || typeof ResizeObserver === 'undefined') return;

    // The page may still be filling in; keep putting the position back as it
    // grows, briefly, unless the listener takes over.
    const started = performance.now();
    const content = el.firstElementChild ?? el;
    const observer = new ResizeObserver(() => {
      if (performance.now() - started > 2500) {
        observer.disconnect();
        return;
      }
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    });
    observer.observe(content);
    const stop = () => observer.disconnect();
    el.addEventListener('wheel', stop, { passive: true, once: true });
    el.addEventListener('touchstart', stop, { passive: true, once: true });
    el.addEventListener('keydown', stop, { once: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('keydown', stop);
    };
  }, [location.key, navigationType, ref]);
}

/* ------------------------------------------------------- windowed rendering */

export interface VirtualRange {
  start: number;
  end: number;
}

/**
 * Which rows of a fixed-height list are near the viewport. Only those are
 * rendered; the list keeps its full height so the scrollbar stays honest.
 */
export function useVirtualRows(
  count: number,
  rowHeight: number,
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  overscan = 10,
  scrollerRef?: RefObject<HTMLElement | null>,
): VirtualRange {
  const main = useScroller();
  const [range, setRange] = useState<VirtualRange>(() => ({ start: 0, end: enabled ? Math.min(count, 60) : count }));

  useLayoutEffect(() => {
    if (!enabled) {
      setRange((prev) => (prev.start === 0 && prev.end === count ? prev : { start: 0, end: count }));
      return;
    }
    const el = scrollerRef ? scrollerRef.current : main;
    const box = containerRef.current;
    if (!el || !box) return;
    let frame = 0;
    const compute = () => {
      frame = 0;
      const offset = box.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      const viewTop = el.scrollTop - offset;
      const viewBottom = viewTop + el.clientHeight;
      const start = Math.max(0, Math.floor(viewTop / rowHeight) - overscan);
      const end = Math.min(count, Math.max(start, Math.ceil(viewBottom / rowHeight) + overscan));
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    compute();
    el.addEventListener('scroll', schedule, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', schedule);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, count, enabled, main, overscan, rowHeight, scrollerRef]);

  return range;
}

/** Scroll the app back to the top — for tapping the current tab again. */
export function useScrollToTop() {
  const scroller = useScroller();
  return useCallback(() => {
    scroller?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scroller]);
}
