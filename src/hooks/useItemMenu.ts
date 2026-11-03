/**
 * Right-click on a mouse, long-press on a finger — one menu either way.
 *
 * Android fires `contextmenu` for a long press as well, a beat after our own
 * timer, so a long press that already opened the menu swallows it.
 */

import { useCallback, useRef, type MouseEvent } from 'react';

import { useLongPress } from './useGestures';
import { ui, type MenuEntry, type MenuHeader } from '../state/ui';

export function useItemMenu(build: () => { entries: MenuEntry[]; header?: MenuHeader }) {
  const latest = useRef(build);
  latest.current = build;
  const lastLongPress = useRef(0);

  const longPress = useLongPress((point) => {
    lastLongPress.current = Date.now();
    const { entries, header } = latest.current();
    ui.openMenu(entries, point, header);
  });

  const onContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    if (Date.now() - lastLongPress.current < 900) return;
    const { entries, header } = latest.current();
    ui.openMenu(entries, { x: event.clientX, y: event.clientY }, header);
  }, []);

  const openFrom = useCallback((element: Element) => {
    const { entries, header } = latest.current();
    ui.openMenu(entries, element, header);
  }, []);

  return { handlers: { ...longPress.handlers, onContextMenu }, consumeClick: longPress.consumeClick, openFrom };
}
