/** Binds the global shortcut table. Typing in a field never triggers it. */

import { useEffect } from 'react';

import { handleShortcut } from '../state/shortcuts';
import { useIsCompact } from './useLayout';

export function useKeyboardShortcuts(): void {
  const compact = useIsCompact();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (handleShortcut(event, { compact })) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);
}
