/** Confirmation that something happened — and a way to take it back. */

import { createPortal } from 'react-dom';

import { CloseIcon } from '../Icons';
import { ui, useUI } from '../../state/ui';

export function ToastHost() {
  const toasts = useUI((s) => s.toasts);
  return createPortal(
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === 'error' ? 'toast--error' : ''}`} role="status">
          <span className={`led is-on ${toast.tone === 'error' ? 'led--red' : ''}`} />
          <span className="toast__msg">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                ui.dismissToast(toast.id);
                toast.action!.run();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => ui.dismissToast(toast.id)}>
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
