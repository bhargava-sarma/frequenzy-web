/**
 * Touch gestures.
 *
 * The hard part of all three of these is deciding, early and correctly, whether
 * the finger means to scroll the list or to act on a row. We resolve the axis
 * once per gesture and then commit to it, and we lean on `touch-action` so the
 * browser keeps owning the axis we did not claim.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Movement, in px, before we decide which way a gesture is going. */
const AXIS_LOCK = 10;
/** How much more horizontal than vertical a swipe must be to count as a swipe. */
const AXIS_BIAS = 1.3;

/** Resistance past the natural end of a drag, so it feels attached to something. */
function rubberband(distance: number, limit: number): number {
  if (distance <= limit) return distance;
  const overshoot = distance - limit;
  return limit + overshoot * 0.32;
}

/* ------------------------------------------------------------- swipe actions */

export interface SwipeActionsOptions {
  /** Width of the drawer revealed by swiping left (actions on the right edge). */
  leftWidth?: number;
  /** Width of the drawer revealed by swiping right (actions on the left edge). */
  rightWidth?: number;
  /** Fired when the row is dragged far enough to commit without lifting a finger. */
  onFullSwipeLeft?: () => void;
  onFullSwipeRight?: () => void;
  /** Controlled open state, so a list can keep only one row open at a time. */
  open?: 'left' | 'right' | null;
  /* Note: this is genuinely controlled — the hook never keeps its own idea of
     which drawer is showing, so the list stays the single source of truth. */
  onOpenChange?: (open: 'left' | 'right' | null) => void;
  disabled?: boolean;
}

export interface SwipeActionsResult {
  offset: number;
  dragging: boolean;
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  close: () => void;
  /** True when the last gesture was a swipe, so the click that follows is ignored. */
  consumedClick: () => boolean;
}

export function useSwipeActions(options: SwipeActionsOptions = {}): SwipeActionsResult {
  const {
    leftWidth = 0,
    rightWidth = 0,
    onFullSwipeLeft,
    onFullSwipeRight,
    open = null,
    onOpenChange,
    disabled = false,
  } = options;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const start = useRef({ x: 0, y: 0, time: 0, base: 0 });
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided');
  const swiped = useRef(false);

  // Follow the controlled open state whenever we are not mid-drag.
  useEffect(() => {
    if (dragging) return;
    setOffset(open === 'left' ? -leftWidth : open === 'right' ? rightWidth : 0);
  }, [dragging, leftWidth, open, rightWidth]);

  const settle = useCallback(
    (next: number, velocity: number) => {
      const width = next < 0 ? leftWidth : rightWidth;
      const fullThreshold = Math.max(120, width * 2.2);
      const flick = Math.abs(velocity) > 0.5;

      if (next < 0 && leftWidth > 0) {
        if (Math.abs(next) > fullThreshold && onFullSwipeLeft) {
          onFullSwipeLeft();
          onOpenChange?.(null);
          setOffset(0);
          return;
        }
        const shouldOpen = Math.abs(next) > leftWidth * 0.5 || (flick && velocity < 0);
        onOpenChange?.(shouldOpen ? 'left' : null);
        setOffset(shouldOpen ? -leftWidth : 0);
        return;
      }

      if (next > 0 && rightWidth > 0) {
        if (next > fullThreshold && onFullSwipeRight) {
          onFullSwipeRight();
          onOpenChange?.(null);
          setOffset(0);
          return;
        }
        const shouldOpen = next > rightWidth * 0.5 || (flick && velocity > 0);
        onOpenChange?.(shouldOpen ? 'right' : null);
        setOffset(shouldOpen ? rightWidth : 0);
        return;
      }

      onOpenChange?.(null);
      setOffset(0);
    },
    [leftWidth, onFullSwipeLeft, onFullSwipeRight, onOpenChange, rightWidth],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === 'mouse') return;
      start.current = { x: event.clientX, y: event.clientY, time: performance.now(), base: offset };
      axis.current = 'undecided';
      swiped.current = false;
    },
    [disabled, offset],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === 'mouse' || start.current.time === 0) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;

      if (axis.current === 'undecided') {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        // The list owns vertical; we only take over when the intent is clearly sideways.
        axis.current = Math.abs(dx) > Math.abs(dy) * AXIS_BIAS ? 'horizontal' : 'vertical';
        if (axis.current === 'horizontal') {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }
      }
      if (axis.current !== 'horizontal') return;

      swiped.current = true;
      const raw = start.current.base + dx;
      // Only allow directions that actually have actions behind them.
      const limited =
        raw < 0
          ? leftWidth > 0
            ? -rubberband(-raw, leftWidth)
            : 0
          : rightWidth > 0
            ? rubberband(raw, rightWidth)
            : 0;
      setOffset(limited);
    },
    [disabled, leftWidth, rightWidth],
  );

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (start.current.time === 0) return;
      const wasHorizontal = axis.current === 'horizontal';
      const elapsed = Math.max(1, performance.now() - start.current.time);
      const velocity = (event.clientX - start.current.x) / elapsed;
      start.current.time = 0;
      axis.current = 'undecided';
      if (!wasHorizontal) return;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      settle(offset, velocity);
    },
    [offset, settle],
  );

  const close = useCallback(() => {
    onOpenChange?.(null);
    setOffset(0);
  }, [onOpenChange]);

  const consumedClick = useCallback(() => {
    const value = swiped.current;
    swiped.current = false;
    return value;
  }, []);

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
    close,
    consumedClick,
  };
}

/* ----------------------------------------------------------------- long press */

export interface LongPressOptions {
  delay?: number;
  onLongPress: (point: { x: number; y: number }) => void;
}

export function useLongPress({ delay = 450, onLongPress }: LongPressOptions) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const fired = useRef(false);

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
        fired.current = true;
        // A short buzz is the whole reason a long press feels like a long press.
        navigator.vibrate?.(12);
        onLongPress({ x: origin.current.x, y: origin.current.y });
      }, delay);
    },
    [cancel, delay, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!timer.current) return;
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel();
    },
    [cancel],
  );

  const didFire = useCallback(() => {
    const value = fired.current;
    fired.current = false;
    return value;
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel },
    didFire,
  };
}

/* ------------------------------------------------------------ pull to refresh */

export function usePullToRefresh(onRefresh: () => void | Promise<void>, disabled = false) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef({ y: 0, active: false });
  const MAX = 90;
  const TRIGGER = 62;

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled || refreshing || event.pointerType === 'mouse') return;
      const el = event.currentTarget;
      if (el.scrollTop > 0) return;
      start.current = { y: event.clientY, active: true };
    },
    [disabled, refreshing],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!start.current.active) return;
    const dy = event.clientY - start.current.y;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    setPull(rubberband(dy * 0.55, MAX));
  }, []);

  const finish = useCallback(async () => {
    if (!start.current.active) return;
    start.current.active = false;
    if (pull >= TRIGGER) {
      setRefreshing(true);
      setPull(TRIGGER);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [onRefresh, pull]);

  return {
    pull,
    refreshing,
    ready: pull >= TRIGGER,
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}

/* --------------------------------------------------------------- reordering */

export interface DragReorderOptions {
  onReorder: (from: number, to: number) => void;
  disabled?: boolean;
}

export interface DragReorderState {
  from: number;
  to: number;
  /** Pixels the lifted row has travelled from its origin. */
  delta: number;
}

/**
 * Drag-to-reorder that works with a finger as well as a mouse.
 *
 * HTML5 drag-and-drop does not fire on touch at all, so this measures the list's
 * children once at drag start and then works purely from pointer coordinates.
 */
export function useDragReorder({ onReorder, disabled }: DragReorderOptions) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<DragReorderState | null>(null);
  const rects = useRef<{ top: number; height: number }[]>([]);
  const startY = useRef(0);
  const fromIndex = useRef(-1);

  const begin = useCallback(
    (event: ReactPointerEvent<HTMLElement>, index: number) => {
      if (disabled) return;
      const container = containerRef.current;
      if (!container) return;

      const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-reorder-item]'));
      rects.current = rows.map((row) => {
        const rect = row.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      });
      startY.current = event.clientY;
      fromIndex.current = index;
      event.currentTarget.setPointerCapture(event.pointerId);
      setState({ from: index, to: index, delta: 0 });
      navigator.vibrate?.(8);
    },
    [disabled],
  );

  const move = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (fromIndex.current < 0) return;
    const delta = event.clientY - startY.current;
    const y = event.clientY;

    // The drop slot is whichever row's midpoint the pointer has passed.
    let target = fromIndex.current;
    for (let i = 0; i < rects.current.length; i++) {
      const rect = rects.current[i];
      if (y > rect.top && y < rect.top + rect.height) {
        target = i;
        break;
      }
      if (i === 0 && y <= rect.top) target = 0;
      if (i === rects.current.length - 1 && y >= rect.top + rect.height) target = i;
    }
    setState({ from: fromIndex.current, to: target, delta });
  }, []);

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (fromIndex.current < 0) return;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const current = state;
      fromIndex.current = -1;
      setState(null);
      if (current && current.from !== current.to) onReorder(current.from, current.to);
    },
    [onReorder, state],
  );

  return {
    containerRef,
    state,
    /** Spread onto the grip that starts the drag. */
    handleProps: (index: number) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        begin(event, index);
      },
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
      style: { touchAction: 'none' as const },
    }),
  };
}
