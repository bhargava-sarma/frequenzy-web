/**
 * Right-click / ellipsis menu, rendered into a portal on a glass panel.
 * Flips itself away from the viewport edges so it never opens off-screen.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | { id: string; separator: true } | { id: string; label: string; heading: true };

interface ContextMenuProps {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, entries, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y, origin: 'top left' });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    let originX = 'left';
    let originY = 'top';

    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, x - rect.width);
      originX = 'right';
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, y - rect.height);
      originY = 'bottom';
    }
    setPos({ left, top, origin: `${originY} ${originX}` });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Defer so the click that opened the menu does not immediately close it.
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', onPointerDown);
      window.addEventListener('contextmenu', onPointerDown);
    }, 0);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('contextmenu', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fz-menu fz-glass fz-glass--strong fz-glass--liquid"
      style={{ left: pos.left, top: pos.top, ['--origin' as string]: pos.origin }}
      role="menu"
    >
      <div className="fz-glass-refraction" />
      {entries.map((entry) => {
        if ('separator' in entry) return <div key={entry.id} className="fz-menu__sep" />;
        if ('heading' in entry) return <div key={entry.id} className="fz-menu__label">{entry.label}</div>;
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className={`fz-menu__item ${entry.danger ? 'fz-menu__item--danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
          >
            {entry.icon}
            <span className="fz-truncate">{entry.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

/** Hook that owns menu open state and its anchor point. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);

  const open = (event: { clientX: number; clientY: number; preventDefault: () => void }, entries: MenuEntry[]) => {
    event.preventDefault();
    setState({ x: event.clientX, y: event.clientY, entries });
  };

  const openAt = (element: HTMLElement, entries: MenuEntry[]) => {
    const rect = element.getBoundingClientRect();
    setState({ x: rect.left, y: rect.bottom + 4, entries });
  };

  const close = () => setState(null);

  const menu = state ? <ContextMenu x={state.x} y={state.y} entries={state.entries} onClose={close} /> : null;

  return { open, openAt, close, menu };
}
