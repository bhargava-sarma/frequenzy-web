/**
 * The dialog shell: a panel over a scrim, a printed title bar, a body and a
 * row of keys. Focus moves in on open, stays inside while it is open, and goes
 * back to where it was when it closes. On a phone it rises from the bottom.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { CloseIcon } from '../Icons';

interface DialogProps {
  title: string;
  label?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  /** Element to focus first, by selector; defaults to the first field or key. */
  initialFocus?: string;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ title, label, onClose, children, actions, wide, initialFocus }: DialogProps) {
  const panel = useRef<HTMLDivElement | null>(null);
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    // A field if there is one; otherwise the panel, so no key wears a focus
    // ring it did not earn.
    const first =
      (initialFocus && el?.querySelector<HTMLElement>(initialFocus)) || el?.querySelector<HTMLElement>('input, textarea, select') || el;
    first?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        latest.current();
        return;
      }
      if (event.key !== 'Tab' || !el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (document.activeElement === el || !el.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastNode : firstNode).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
    // Mount only: focus handling must not re-run on every parent render.
  }, []);

  return createPortal(
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) latest.current();
      }}
    >
      <div ref={panel} className={`dialog ${wide ? 'dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="dialog__bar">
          {label && <span className="label">{label}</span>}
          <h2 className="dialog__title">{title}</h2>
          <button type="button" className="ibtn ibtn--sm dialog__close" aria-label="Close" onClick={() => latest.current()}>
            <CloseIcon />
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {actions && <div className="dialog__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
