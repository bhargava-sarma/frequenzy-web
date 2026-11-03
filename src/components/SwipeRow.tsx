/**
 * A row you can act on by swiping.
 *
 * Swiping left pulls a drawer out of the right edge, swiping right pulls one
 * out of the left. Dragging well past the drawer commits its first action
 * without lifting a finger — the row says so by lighting that action up —
 * so whatever a list wants a flick to mean has to be listed first.
 */

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';

import { useSwipe } from '../hooks/useGestures';

export interface SwipeAction {
  id: string;
  label: string;
  icon: ReactNode;
  tone: 'blue' | 'green' | 'orange' | 'yellow' | 'red' | 'grey';
  onSelect: () => void;
}

const ACTION_WIDTH = 74;

interface SwipeRowProps {
  children: ReactNode;
  /** Revealed by swiping left; the first is the full-swipe action. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping right; the first is the full-swipe action. */
  rightActions?: SwipeAction[];
  open: 'left' | 'right' | null;
  onOpenChange: (open: 'left' | 'right' | null) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SwipeRow({
  children, leftActions = [], rightActions = [], open, onOpenChange, disabled, className = '', style,
}: SwipeRowProps) {
  const leftWidth = leftActions.length * ACTION_WIDTH;
  const rightWidth = rightActions.length * ACTION_WIDTH;
  const swipe = useSwipe({
    leftWidth,
    rightWidth,
    open,
    onOpenChange,
    disabled: disabled || (leftWidth === 0 && rightWidth === 0),
    onFullSwipeLeft: leftActions[0]?.onSelect,
    onFullSwipeRight: rightActions[0]?.onSelect,
  });

  // The drawer stays up while the row slides home, then goes away; the row is
  // only painted solid while a drawer sits behind it.
  const side = swipe.offset < 0 ? 'left' : swipe.offset > 0 ? 'right' : null;
  const [trail, setTrail] = useState<'left' | 'right' | null>(null);
  useEffect(() => {
    if (side) {
      setTrail(side);
      return;
    }
    const timer = window.setTimeout(() => setTrail(null), 280);
    return () => window.clearTimeout(timer);
  }, [side]);
  const shown = side ?? trail;

  const drawer = (actions: SwipeAction[], which: 'left' | 'right') => {
    const visible = shown === which;
    const armed = swipe.armed === which;
    return (
      <div
        className={`swipe__drawer swipe__drawer--${which} ${armed ? 'is-armed' : ''}`}
        aria-hidden={!visible}
        style={{ visibility: visible ? 'visible' : 'hidden' }}
      >
        {actions.map((action, i) => (
          <button
            key={action.id}
            type="button"
            tabIndex={visible ? 0 : -1}
            className={`swipe__action swipe__action--${action.tone} ${armed && i === 0 ? 'is-lead' : ''}`}
            style={{ width: ACTION_WIDTH }}
            onClick={() => {
              action.onSelect();
              swipe.close();
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={`swipe ${className}`} style={style}>
      {leftActions.length > 0 && drawer(leftActions, 'left')}
      {rightActions.length > 0 && drawer(rightActions, 'right')}
      <div
        className={`swipe__content ${swipe.dragging ? '' : 'is-settling'} ${shown ? 'is-moved' : ''}`}
        style={{ transform: swipe.offset ? `translate3d(${swipe.offset}px, 0, 0)` : undefined }}
        {...swipe.handlers}
        onClickCapture={(event) => {
          // An open row, or one that has just been swiped, swallows the tap.
          if (swipe.offset !== 0 || swipe.consumeClick()) {
            event.stopPropagation();
            event.preventDefault();
            swipe.close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
