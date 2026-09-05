/** Single-field dialog used for creating and renaming playlists. */

import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';

interface PromptDialogProps {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function PromptDialog({ title, label, initialValue, confirmLabel, onConfirm, onClose }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="fz-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="fz-btn fz-btn--solid" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="fz-field">
        <label htmlFor="fz-prompt-input">{label}</label>
        <input
          id="fz-prompt-input"
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
      </div>
    </Dialog>
  );
}
