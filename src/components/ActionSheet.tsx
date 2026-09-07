/**
 * The touch counterpart to the right-click menu: a sheet that rises from the
 * bottom, headed by whatever you long-pressed so you can see what you are
 * acting on. It consumes the same `MenuEntry[]` as the desktop menu.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { MenuEntry } from './ContextMenu';

export interface ActionSheetHeader {
  title: string;
  subtitle?: string;
  artwork?: ReactNode;
}

interface ActionSheetProps {
  entries: MenuEntry[];
  header?: ActionSheetHeader;
  onClose: () => void;
}

export function ActionSheet({ entries, header, onClose }: ActionSheetProps) {
  const [closing, setClosing] = useState(false);

  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 220);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Bound once; `dismiss` only touches local state and the prop.
  }, []);

  return createPortal(
    <div
      className="fz-actionsheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className={`fz-actionsheet fz-pane ${closing ? 'is-closing' : ''}`} role="menu">
        {header && (
          <div className="fz-actionsheet__header">
            {header.artwork}
            <div style={{ minWidth: 0 }}>
              <div className="fz-actionsheet__title fz-truncate">{header.title}</div>
              {header.subtitle && <div className="fz-actionsheet__sub fz-truncate">{header.subtitle}</div>}
            </div>
          </div>
        )}

        <div className="fz-actionsheet__items">
          {entries.map((entry) => {
            if ('separator' in entry) return <div key={entry.id} className="fz-actionsheet__sep" />;
            if ('heading' in entry) {
              return (
                <div key={entry.id} className="fz-menu__label" style={{ padding: '10px 16px 4px' }}>
                  {entry.label}
                </div>
              );
            }
            return (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                className={`fz-actionsheet__item ${entry.danger ? 'fz-actionsheet__item--danger' : ''}`}
                style={entry.disabled ? { opacity: 0.4 } : undefined}
                onClick={() => {
                  entry.onSelect();
                  dismiss();
                }}
              >
                {entry.icon}
                <span className="fz-truncate">{entry.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className={`fz-actionsheet__cancel fz-pane ${closing ? 'is-closing' : ''}`}
        onClick={dismiss}
      >
        <span style={{ position: 'relative', zIndex: 3 }}>Cancel</span>
      </button>
    </div>,
    document.body,
  );
}
