/**
 * Draggable progress / volume slider.
 *
 * Dragging is pointer-capture based so the gesture survives leaving the
 * element, and the displayed value follows the finger rather than the audio
 * element until the drag ends — otherwise the knob fights the user.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrubberProps {
  value: number;
  max: number;
  buffered?: number;
  onChange: (value: number) => void;
  onDragChange?: (dragging: boolean) => void;
  ariaLabel: string;
  className?: string;
}

export function Scrubber({ value, max, buffered = 0, onChange, onDragChange, ariaLabel, className = '' }: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const shown = dragging ? dragValue : value;
  const percent = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;
  const bufferedPercent = max > 0 ? Math.min(100, (buffered / max) * 100) : 0;

  const valueFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || max <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * max;
    },
    [max],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => setDragValue(valueFromEvent(event.clientX));
    const up = (event: PointerEvent) => {
      onChange(valueFromEvent(event.clientX));
      setDragging(false);
      onDragChange?.(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, onChange, onDragChange, valueFromEvent]);

  return (
    <div
      className={`fz-scrub ${dragging ? 'is-dragging' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown)}
      onPointerDown={(event) => {
        event.preventDefault();
        setDragValue(valueFromEvent(event.clientX));
        setDragging(true);
        onDragChange?.(true);
      }}
      onKeyDown={(event) => {
        const step = max > 60 ? 5 : max / 20;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(Math.min(max, value + step));
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(Math.max(0, value - step));
        }
      }}
    >
      <div className="fz-scrub__track" ref={trackRef}>
        {buffered > 0 && <div className="fz-scrub__buffered" style={{ width: `${bufferedPercent}%` }} />}
        <div className="fz-scrub__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="fz-scrub__knob" style={{ left: `${percent}%` }} />
    </div>
  );
}
