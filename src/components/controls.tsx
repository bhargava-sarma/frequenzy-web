/**
 * Control primitives with behaviour: the fader, the knob, function keys with
 * LEDs, switches, segmented selectors, the marquee and the star rating.
 * Purely visual pieces (keys, tags, labels) are plain class names.
 */

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent,
  type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode,
} from 'react';

import { StarIcon } from './Icons';

/* ------------------------------------------------------------------ switch */

export function Switch({
  on, onChange, label, disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`switch ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

/* --------------------------------------------------------------- segmented */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  value, options, onChange, label, mono, small,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`seg ${mono ? 'seg--mono' : ''} ${small ? 'seg--sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          className={option.value === value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- function key */

/** A small key with its name printed under it and an LED for its state. */
export function FKey({
  icon, label, on, onClick, title, disabled, led = true, blink, ariaLabel, className = '',
}: {
  icon: ReactNode;
  label: string;
  on?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  title?: string;
  disabled?: boolean;
  led?: boolean;
  blink?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`fkey ${on ? 'is-on' : ''} ${className}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={on === undefined ? undefined : on}
      aria-label={ariaLabel ?? title ?? label}
    >
      <span className="fkey__cap">
        {icon}
        {led && <span className={`led ${on ? 'is-on' : ''} ${on && blink ? 'is-blinking' : ''}`} />}
      </span>
      <span className="fkey__label">{label}</span>
    </button>
  );
}

/* ----------------------------------------------------------------- slider */

interface SliderProps {
  value: number;
  max: number;
  min?: number;
  /** Keyboard step. */
  step?: number;
  buffered?: number;
  /** Called while dragging when `live`, otherwise once on release. */
  onChange: (value: number) => void;
  onDraggingChange?: (dragging: boolean) => void;
  live?: boolean;
  label: string;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  /** Lets the fill glide between clock ticks rather than stepping. */
  playing?: boolean;
  accent?: boolean;
  large?: boolean;
  tooltip?: boolean;
  loop?: { a: number; b: number | null } | null;
}

export function Slider({
  value, max, min = 0, step, buffered = 0, onChange, onDraggingChange, live = false, label, format,
  disabled, className = '', playing, accent, large, tooltip, loop,
}: SliderProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = drag !== null;
  const range = max - min;
  const shown = drag ?? value;
  const fraction = range > 0 ? Math.min(1, Math.max(0, (shown - min) / range)) : 0;
  const bufferFraction = range > 0 ? Math.min(1, Math.max(0, (buffered - min) / range)) : 0;
  const keyStep = step ?? (range > 120 ? 5 : range / 20);

  const valueAt = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el || range <= 0) return min;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return min + ratio * range;
    },
    [min, range],
  );

  const latest = useRef({ onChange, onDraggingChange, live });
  latest.current = { onChange, onDraggingChange, live };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || range <= 0 || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = valueAt(event.clientX);
    setDrag(next);
    latest.current.onDraggingChange?.(true);
    if (live) onChange(next);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag !== null) {
      const next = valueAt(event.clientX);
      setDrag(next);
      if (latest.current.live) latest.current.onChange(next);
    } else if (tooltip && event.pointerType === 'mouse') {
      setHover(valueAt(event.clientX));
    }
  };

  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (drag === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const next = commit ? valueAt(event.clientX) : drag;
    setDrag(null);
    latest.current.onDraggingChange?.(false);
    latest.current.onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value + keyStep;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value - keyStep;
    else if (event.key === 'PageUp') next = value + keyStep * 5;
    else if (event.key === 'PageDown') next = value - keyStep * 5;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(Math.min(max, Math.max(min, next)));
  };

  const tipValue = drag ?? hover;
  const tipFraction = tipValue !== null && range > 0 ? (tipValue - min) / range : 0;

  return (
    <div
      ref={ref}
      className={`slider ${accent ? 'slider--accent' : ''} ${large ? 'slider--lg' : ''} ${dragging ? 'is-dragging' : ''} ${
        playing ? 'is-playing' : ''
      } ${disabled ? 'is-disabled' : ''} ${className}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown * 100) / 100}
      aria-valuetext={format ? format(shown) : undefined}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, false)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
    >
      <div className="slider__track">
        {loop && range > 0 && loop.b !== null && (
          <div
            className="slider__range"
            style={{ left: `${((loop.a - min) / range) * 100}%`, width: `${((loop.b - loop.a) / range) * 100}%` }}
          />
        )}
        {bufferFraction > 0 && <div className="slider__buffer" style={{ transform: `scaleX(${bufferFraction})` }} />}
        <div className="slider__fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
      {loop && range > 0 && <span className="slider__mark" style={{ left: `${((loop.a - min) / range) * 100}%` }} />}
      {loop && loop.b !== null && range > 0 && (
        <span className="slider__mark" style={{ left: `${((loop.b - min) / range) * 100}%` }} />
      )}
      <div className="slider__thumb" style={{ left: `${fraction * 100}%` }} />
      {tooltip && format && tipValue !== null && (
        <div className="slider__tip" style={{ left: `${Math.min(1, Math.max(0, tipFraction)) * 100}%` }}>
          {format(tipValue)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- knob */

const KNOB_SWEEP = 270;

/**
 * A rotary encoder. Drag up or right to turn it up; the wheel and the arrow
 * keys work too, Shift makes every gesture finer, and a double-click mutes.
 */
export function Knob({
  value, onChange, label, muted, onToggleMute, title,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  muted?: boolean;
  onToggleMute?: () => void;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; x: number; start: number } | null>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  // Wheel needs a non-passive listener to stop the page scrolling under it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY !== 0 ? -event.deltaY : event.deltaX;
      const unit = event.deltaMode === 1 ? 0.02 : 0.0012;
      const step = Math.max(-0.08, Math.min(0.08, delta * unit * (event.shiftKey ? 0.25 : 1)));
      latest.current.onChange(Math.min(1, Math.max(0, latest.current.value + step)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { y: event.clientY, x: event.clientX, start: value };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const travel = event.shiftKey ? 600 : 160;
    const delta = (d.y - event.clientY + (event.clientX - d.x) * 0.6) / travel;
    onChange(Math.min(1, Math.max(0, d.start + delta)));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const fine = event.shiftKey ? 0.01 : 0.04;
    let next: number | null = null;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = value + fine;
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = value - fine;
    else if (event.key === 'PageUp') next = value + 0.1;
    else if (event.key === 'PageDown') next = value - 0.1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(Math.min(1, Math.max(0, next)));
  };

  const shown = muted ? 0 : value;
  const angle = -KNOB_SWEEP / 2 + shown * KNOB_SWEEP;
  const arc = (KNOB_SWEEP / 360) * 100;

  return (
    <div
      ref={ref}
      className={`knob ${muted ? 'is-muted' : ''}`}
      role="slider"
      tabIndex={0}
      title={title}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={muted ? 'muted' : `${Math.round(value * 100)}%`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onToggleMute}
      onKeyDown={onKeyDown}
    >
      <div className="knob__dial">
        <svg className="knob__ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle className="knob__track" cx="22" cy="22" r="19.5" pathLength={100} strokeDasharray={`${arc} 100`} transform="rotate(135 22 22)" />
          <circle
            className="knob__fill"
            cx="22"
            cy="22"
            r="19.5"
            pathLength={100}
            strokeDasharray={`${Math.max(0.001, (muted ? value : shown) * arc)} 100`}
            transform="rotate(135 22 22)"
          />
        </svg>
        <div className="knob__cap">
          <span className="knob__notch" style={{ transform: `rotate(${angle}deg)` }} />
        </div>
      </div>
      <span className="knob__label">
        {label}
        <span className="knob__value">{muted ? 'off' : Math.round(value * 100)}</span>
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- marquee */

/** Text that scrolls when it does not fit, like a hardware display. */
export function Marquee({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const overflow = i.scrollWidth - o.clientWidth;
      setShift(overflow > 6 ? overflow : 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={outer} className={`marquee ${shift ? 'is-overflowing' : ''} ${className}`} style={style}>
      <span
        ref={inner}
        className={shift ? 'is-moving' : ''}
        style={
          shift
            ? ({ '--marquee-shift': `${-shift - 2}px`, animationDuration: `${Math.max(7, shift / 22 + 5)}s` } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ stars */

export function Stars({ value, onChange, size }: { value: number; onChange: (value: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className={n <= shown ? 'is-on' : ''}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n === value ? 0 : n)}
          style={size ? { width: size + 6, height: size + 6 } : undefined}
        >
          <StarIcon filled={n <= shown} style={size ? { width: size, height: size } : undefined} />
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- spinner */

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`spinner ${large ? 'spinner--lg' : ''}`} role="status" aria-label="Loading" />;
}

export function Eq({ paused }: { paused?: boolean }) {
  return (
    <span className={`eq ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
