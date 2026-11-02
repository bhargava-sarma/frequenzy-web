/**
 * Touch gestures.
 *
 * The hard part of all of these is deciding, early and correctly, whether the
 * finger means to scroll the list or to act on a row. The axis is resolved
 * once per gesture and then committed to, and `touch-action` keeps the
 * browser in charge of the axis we did not claim.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { haptic } from '../state/ui';

/** Movement, in px, before we decide which way a gesture is going. */
const AXIS_LOCK = 10;
/** How much more horizontal than vertical a swipe must be to count as a swipe. */
const AXIS_BIAS = 1.25;

/** Resistance past the natural end of a drag, so it feels attached to something. */
export function rubberband(distance: number, limit: number): number {
  if (distance <= limit) return distance;
  return limit + (distance - limit) * 0.3;
}

/* ------------------------------------------------------------- swipe actions */

export interface SwipeOptions {
  /** Width of the drawer revealed by swiping left (actions on the right edge). */
  leftWidth: number;
  /** Width of the drawer revealed by swiping right (actions on the left edge). */
  rightWidth: number;
  onFullSwipeLeft?: () => void;
  onFullSwipeRight?: () => void;
  open: 'left' | 'right' | null;
  onOpenChange: (open: 'left' | 'right' | null) => void;
  disabled?: boolean;
}

export function useSwipe({
  leftWidth, rightWidth, onFullSwipeLeft, onFullSwipeRight, open, onOpenChange, disabled,
}: SwipeOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState<'left' | 'right' | null>(null);
  const armedRef = useRef<'left' | 'right' | null>(null);
  const start = useRef({ x: 0, y: 0, time: 0, base: 0, width: 0, active: false });
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const swiped = useRef(false);
  const offsetRef = useRef(0);
  offsetRef.current = offset;

  useEffect(() => {
    if (dragging) return;
    setOffset(open === 'left' ? -leftWidth : open === 'right' ? rightWidth : 0);
  }, [dragging, leftWidth, open, rightWidth]);

  const threshold = (width: number, rowWidth: number) => Math.min(rowWidth * 0.62, Math.max(150, width + 100));

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === 'mouse') return;
      start.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        base: offsetRef.current,
        width: event.currentTarget.offsetWidth,
        active: true,
      };
      axis.current = 'none';
      swiped.current = false;
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s.active) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (axis.current === 'none') {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        axis.current = Math.abs(dx) > Math.abs(dy) * AXIS_BIAS ? 'x' : 'y';
        if (axis.current === 'x') {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
      }
      if (axis.current !== 'x') return;
      swiped.current = true;
      const raw = s.base + dx;
      const next =
        raw < 0
          ? leftWidth > 0
            ? -rubberband(-raw, leftWidth)
            : 0
          : rightWidth > 0
            ? rubberband(raw, rightWidth)
            : 0;
      setOffset(next);
      const travel = Math.abs(dx);
      const nextArmed =
        dx < 0 && onFullSwipeLeft && travel > threshold(leftWidth, s.width)
          ? 'left'
          : dx > 0 && onFullSwipeRight && travel > threshold(rightWidth, s.width)
            ? 'right'
            : null;
      if (armedRef.current !== nextArmed) {
        if (nextArmed) haptic(6);
        armedRef.current = nextArmed;
        setArmed(nextArmed);
      }
    },
    [leftWidth, onFullSwipeLeft, onFullSwipeRight, rightWidth],
  );

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s.active) return;
      s.active = false;
      const wasX = axis.current === 'x';
      axis.current = 'none';
      if (!wasX) return;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setDragging(false);
      const dx = event.clientX - s.x;
      const velocity = dx / Math.max(1, performance.now() - s.time);
      const current = offsetRef.current;
      armedRef.current = null;
      setArmed(null);

      if (current < 0 && leftWidth > 0) {
        if (onFullSwipeLeft && Math.abs(dx) > threshold(leftWidth, s.width)) {
          onFullSwipeLeft();
          onOpenChange(null);
          setOffset(0);
          return;
        }
        const shouldOpen = -current > leftWidth * 0.5 || velocity < -0.5;
        onOpenChange(shouldOpen ? 'left' : null);
        setOffset(shouldOpen ? -leftWidth : 0);
        return;
      }
      if (current > 0 && rightWidth > 0) {
        if (onFullSwipeRight && dx > threshold(rightWidth, s.width)) {
          onFullSwipeRight();
          onOpenChange(null);
          setOffset(0);
          return;
        }
        const shouldOpen = current > rightWidth * 0.5 || velocity > 0.5;
        onOpenChange(shouldOpen ? 'right' : null);
        setOffset(shouldOpen ? rightWidth : 0);
        return;
      }
      onOpenChange(null);
      setOffset(0);
    },
    [leftWidth, onFullSwipeLeft, onFullSwipeRight, onOpenChange, rightWidth],
  );

  const close = useCallback(() => {
    onOpenChange(null);
    setOffset(0);
  }, [onOpenChange]);

  /** True once after a swipe, so the click that follows can be ignored. */
  const consumeClick = useCallback(() => {
    const value = swiped.current;
    swiped.current = false;
    return value;
  }, []);

  return {
    offset,
    dragging,
    armed,
    close,
    consumeClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}

/* ----------------------------------------------------------------- long press */

export function useLongPress(onLongPress: (point: { x: number; y: number }) => void, delay = 420) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse') return; // right-click covers this on desktop
      origin.current = { x: event.clientX, y: event.clientY };
      fired.current = false;
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        haptic(12);
        latest.current({ ...origin.current });
      }, delay);
    },
    [cancel, delay],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!timer.current) return;
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 9) cancel();
    },
    [cancel],
  );

  /** True once after a long press fired, so the click that follows is ignored. */
  const consumeClick = useCallback(() => {
    const value = fired.current;
    fired.current = false;
    return value;
  }, []);

  return { handlers: { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel }, consumeClick };
}

/* ------------------------------------------------------------ pull to refresh */

const PULL_MAX = 96;
const PULL_TRIGGER = 64;

/**
 * Pull down at the top of the scroller to refresh.
 *
 * Built on touch events rather than pointer events on purpose: the browser
 * cancels a pointer stream as soon as it decides the gesture is a scroll, so
 * a pointer-based pull only ever worked when nothing scrolled — which is
 * never, on iOS, with its rubber-band overscroll.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  handler: RefObject<(() => Promise<unknown> | void) | null>,
  enabled: boolean,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startY = 0;
    let startX = 0;
    let tracking = false;
    let pulling = false;
    let distance = 0;

    const onStart = (event: TouchEvent) => {
      tracking = !busy.current && event.touches.length === 1 && el.scrollTop <= 0 && Boolean(handler.current);
      pulling = false;
      distance = 0;
      if (tracking) {
        startY = event.touches[0].clientY;
        startX = event.touches[0].clientX;
      }
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;
      if (!pulling) {
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          tracking = false;
          return;
        }
        if (dy < 8) return;
        if (el.scrollTop > 0) {
          tracking = false;
          return;
        }
        pulling = true;
      }
      event.preventDefault();
      distance = rubberband(Math.max(0, dy - 8) * 0.55, PULL_MAX);
      setPull(distance);
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!pulling) return;
      pulling = false;
      if (distance >= PULL_TRIGGER && handler.current) {
        busy.current = true;
        setRefreshing(true);
        setPull(PULL_TRIGGER * 0.8);
        haptic(10);
        Promise.resolve(handler.current())
          .catch(() => {})
          .finally(() => {
            busy.current = false;
            setRefreshing(false);
            setPull(0);
          });
      } else {
        setPull(0);
      }
      distance = 0;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, handler, ref]);

  return { pull, refreshing, ready: pull >= PULL_TRIGGER };
}

/* --------------------------------------------------------------- reordering */

export interface ReorderState {
  from: number;
  to: number;
  /** Pixels the lifted row has travelled. */
  offset: number;
}

/**
 * Drag-to-reorder for fixed-height rows, with a finger or a mouse.
 *
 * HTML5 drag-and-drop does not fire on touch at all, so this works purely
 * from pointer coordinates — and because every row is the same height, the
 * drop slot is arithmetic rather than a hit test, which also means it works
 * in a windowed list where most rows are not in the DOM. Holding near the
 * top or bottom edge scrolls.
 */
export function useReorder({
  count, rowHeight, onReorder, scroller, enabled = true,
}: {
  count: number;
  rowHeight: number;
  onReorder: (from: number, to: number) => void;
  scroller: RefObject<HTMLElement | null>;
  enabled?: boolean;
}) {
  const [state, setState] = useState<ReorderState | null>(null);
  const stateRef = useRef<ReorderState | null>(null);
  const drag = useRef<{ from: number; startY: number; y: number; scrollStart: number; frame: number } | null>(null);
  const latest = useRef({ onReorder, count, rowHeight });
  latest.current = { onReorder, count, rowHeight };

  const update = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const el = scroller.current;
    const scrollDelta = el ? el.scrollTop - d.scrollStart : 0;
    const offset = d.y - d.startY + scrollDelta;
    const { count: n, rowHeight: h } = latest.current;
    const to = Math.min(n - 1, Math.max(0, Math.round(d.from + offset / h)));
    const next = { from: d.from, to, offset };
    stateRef.current = next;
    setState(next);
  }, [scroller]);

  const tick = useCallback(() => {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const edge = 56;
    let speed = 0;
    if (d.y < rect.top + edge) speed = -Math.ceil(((rect.top + edge - d.y) / edge) * 14);
    else if (d.y > rect.bottom - edge) speed = Math.ceil(((d.y - (rect.bottom - edge)) / edge) * 14);
    if (speed !== 0) {
      el.scrollTop += speed;
      update();
    }
    d.frame = requestAnimationFrame(tick);
  }, [scroller, update]);

  const end = useCallback((commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    drag.current = null;
    const final = stateRef.current;
    stateRef.current = null;
    setState(null);
    if (commit && final && final.from !== final.to) latest.current.onReorder(final.from, final.to);
  }, []);

  useEffect(() => () => {
    if (drag.current) cancelAnimationFrame(drag.current.frame);
  }, []);

  const handleProps = (index: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        from: index,
        startY: event.clientY,
        y: event.clientY,
        scrollStart: scroller.current?.scrollTop ?? 0,
        frame: 0,
      };
      stateRef.current = { from: index, to: index, offset: 0 };
      setState(stateRef.current);
      haptic(8);
      drag.current.frame = requestAnimationFrame(tick);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      if (!drag.current) return;
      drag.current.y = event.clientY;
      update();
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      end(true);
    },
    onPointerCancel: () => end(false),
    onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    style: { touchAction: 'none' as const, cursor: 'grab' },
  });

  /** Where each row should be drawn while a drag is in progress. */
  const shiftFor = (index: number): number => {
    if (!state) return 0;
    const { from, to, offset } = state;
    if (index === from) return offset;
    if (from < to && index > from && index <= to) return -rowHeight;
    if (from > to && index >= to && index < from) return rowHeight;
    return 0;
  };

  return { state, handleProps, shiftFor };
}
