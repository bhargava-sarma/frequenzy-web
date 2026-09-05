/**
 * Global keyboard shortcuts, matching the ones Apple Music uses where they exist.
 * Typing in a field never triggers them.
 */

import { useEffect } from 'react';
import { usePlayer } from '../state/player';

interface Options {
  onToggleFullPlayer: () => void;
  onFocusSearch: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts({ onToggleFullPlayer, onFocusSearch }: Options) {
  const { actions, volume } = usePlayer();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          actions.toggle();
          break;
        case 'ArrowRight':
          if (meta) {
            event.preventDefault();
            actions.next();
          } else if (event.shiftKey) {
            event.preventDefault();
            actions.seekBy(10);
          }
          break;
        case 'ArrowLeft':
          if (meta) {
            event.preventDefault();
            actions.previous();
          } else if (event.shiftKey) {
            event.preventDefault();
            actions.seekBy(-10);
          }
          break;
        case 'ArrowUp':
          if (meta) {
            event.preventDefault();
            actions.setVolume(Math.min(1, volume + 0.05));
          }
          break;
        case 'ArrowDown':
          if (meta) {
            event.preventDefault();
            actions.setVolume(Math.max(0, volume - 0.05));
          }
          break;
        case 'm':
        case 'M':
          if (!meta) actions.toggleMute();
          break;
        case 's':
        case 'S':
          if (!meta) actions.toggleShuffle();
          break;
        case 'r':
        case 'R':
          if (!meta) actions.cycleRepeat();
          break;
        case 'f':
        case 'F':
          if (!meta) onToggleFullPlayer();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions, onFocusSearch, onToggleFullPlayer, volume]);
}
