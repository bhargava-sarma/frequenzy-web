/** Glass dialog shell: backdrop, escape handling, focus trap entry point. */

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Dialog({ title, onClose, children, actions }: DialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fz-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fz-dialog fz-glass fz-glass--strong fz-glass--liquid" role="dialog" aria-modal="true" aria-label={title}>
        <div className="fz-glass-refraction" />
        <div className="fz-dialog__title">{title}</div>
        <div className="fz-dialog__body">
          {children}
          {actions && <div className="fz-dialog__actions">{actions}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
