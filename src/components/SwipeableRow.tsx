/**
 * A list row you can act on by swiping.
 *
 * Swiping left pulls a drawer out of the right edge (Play Next / Play Last);
 * swiping right pulls one out of the left (Favourite). Dragging well past the
 * drawer commits its first action without lifting a finger, which is the
 * shortcut iOS teaches everywhere.
 */

import { type CSSProperties, type ReactNode } from 'react';

import { useSwipeActions } from '../hooks/useGestures';

export interface SwipeAction {
  id: string;
  label: string;
  icon: ReactNode;
  /** Maps to one of the `.fz-swipe-action--*` colour classes. */
  tone: 'next' | 'last' | 'love' | 'playlist' | 'remove';
  onSelect: () => void;
}

const ACTION_WIDTH = 76;

interface SwipeableRowProps {
  children: ReactNode;
  /** Revealed by swiping left; the first one is the full-swipe action. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping right; the first one is the full-swipe action. */
  rightActions?: SwipeAction[];
  /** Which drawer is open, hoisted so a list keeps only one row open at a time. */
  open: 'left' | 'right' | null;
  onOpenChange: (open: 'left' | 'right' | null) => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  open,
  onOpenChange,
  disabled,
  className = '',
  style,
}: SwipeableRowProps) {
  const leftWidth = leftActions.length * ACTION_WIDTH;
  const rightWidth = rightActions.length * ACTION_WIDTH;

  const swipe = useSwipeActions({
    leftWidth,
    rightWidth,
    disabled: disabled || (leftWidth === 0 && rightWidth === 0),
    open,
    onOpenChange,
    onFullSwipeLeft: leftActions[0]
      ? () => {
          navigator.vibrate?.(10);
          leftActions[0].onSelect();
        }
      : undefined,
    onFullSwipeRight: rightActions[0]
      ? () => {
          navigator.vibrate?.(10);
          rightActions[0].onSelect();
        }
      : undefined,
  });

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => (
    <div className={`fz-swipe__actions fz-swipe__actions--${side}`} aria-hidden={swipe.offset === 0}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`fz-swipe-action fz-swipe-action--${action.tone}`}
          tabIndex={swipe.offset === 0 ? -1 : 0}
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

  return (
    <div className={`fz-swipe ${className}`} style={style}>
      {leftActions.length > 0 && renderActions(leftActions, 'left')}
      {rightActions.length > 0 && renderActions(rightActions, 'right')}

      <div
        className={`fz-swipe__content ${swipe.dragging ? '' : 'is-settling'}`}
        style={{ transform: `translate3d(${swipe.offset}px, 0, 0)` }}
        {...swipe.handlers}
        onClickCapture={(event) => {
          // A row that is open, or has just been swiped, swallows the tap.
          if (swipe.offset !== 0 || swipe.consumedClick()) {
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
