/**
 * The pieces of the screen: elapsed and remaining time, the scrubber, the
 * format readout and the row of status flags.
 *
 * Each one subscribes to exactly what it draws. The clock ticks four times a
 * second; only the components that print the time re-render when it does.
 */

import { memo, useEffect, useState } from 'react';

import { Slider } from '../controls';
import { useConnection } from '../../hooks/useConnection';
import { formatTime, qualityBadge } from '../../lib/format';
import type { Song } from '../../lib/types';
import { player, usePlayer, useProgress, type SourceInfo } from '../../state/player';

export const Elapsed = memo(function Elapsed({ className = '' }: { className?: string }) {
  const time = useProgress((p) => p.time);
  const radio = usePlayer((s) => s.current?.isRadio ?? false);
  const loaded = usePlayer((s) => s.current !== null);
  return <span className={`tnum ${className}`}>{!loaded ? '' : radio ? 'live' : formatTime(time)}</span>;
});

export const Remaining = memo(function Remaining({ className = '' }: { className?: string }) {
  const time = useProgress((p) => p.time);
  const duration = usePlayer((s) => s.duration);
  const radio = usePlayer((s) => s.current?.isRadio ?? false);
  const rate = usePlayer((s) => s.rate);
  const loaded = usePlayer((s) => s.current !== null);
  if (!loaded) return <span className={`tnum ${className}`} />;
  if (radio) return <span className={`tnum ${className}`}>∞</span>;
  // At 1.5× the remaining *wall* time is what the listener cares about.
  const left = Math.max(0, duration - time) / (rate || 1);
  return <span className={`tnum ${className}`}>-{formatTime(left)}</span>;
});

export const Duration = memo(function Duration({ className = '' }: { className?: string }) {
  const duration = usePlayer((s) => s.duration);
  return <span className={`tnum ${className}`}>{formatTime(duration)}</span>;
});

export function Scrubber({ large, className = '' }: { large?: boolean; className?: string }) {
  const time = useProgress((p) => p.time);
  const buffered = useProgress((p) => p.buffered);
  const duration = usePlayer((s) => s.duration);
  const moving = usePlayer((s) => s.playing && !s.buffering);
  const loop = usePlayer((s) => s.loop);
  const radio = usePlayer((s) => s.current?.isRadio ?? false);
  const hasCurrent = usePlayer((s) => s.current !== null);
  return (
    <Slider
      className={`scrubber ${className}`}
      value={radio ? 0 : time}
      max={radio ? 0 : duration}
      buffered={buffered}
      onChange={(value) => player.seek(value)}
      label="Seek"
      format={formatTime}
      disabled={!hasCurrent || radio || duration <= 0}
      playing={moving}
      loop={loop}
      accent
      large={large}
      tooltip
    />
  );
}

/* ---------------------------------------------------------------- format */

function khz(rate: number): string {
  const value = rate / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** "FLAC 24/96", "MP3 320", "OPUS 192 · transcoded", "LIVE". */
export function formatLabel(song: Song | null, source: SourceInfo | null): string {
  if (!song) return '';
  if (song.isRadio) return 'live radio';
  if (source && source.kind === 'stream' && source.quality !== 'original') {
    return `${(source.format ?? 'mp3').toUpperCase()} ${source.quality}`;
  }
  const badge = qualityBadge(song);
  const codec = (song.suffix ?? song.contentType?.split('/').pop() ?? '').toUpperCase();
  let label = codec;
  if (badge?.lossless && song.samplingRate) {
    label = `${codec} ${song.bitDepth ? `${song.bitDepth}/` : ''}${khz(song.samplingRate)}`;
  } else if (song.bitRate) {
    label = `${codec} ${song.bitRate}`;
  }
  return source?.kind === 'offline' ? `${label} · offline` : label;
}

export function FormatReadout({ className = '' }: { className?: string }) {
  const song = usePlayer((s) => s.current);
  const source = usePlayer((s) => s.source);
  const label = formatLabel(song, source);
  const badge = qualityBadge(song);
  if (!label) return null;
  return (
    <span className={`readout ${badge?.hiRes ? 'is-hires' : ''} ${className}`} title={badge?.detail}>
      {label}
    </span>
  );
}

/* ----------------------------------------------------------------- flags */

function sleepLeft(endsAt: number): string {
  const seconds = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  return formatTime(seconds);
}

/** The status row: what is switched on, printed the way a display would. */
export function StatusFlags({ className = '' }: { className?: string }) {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const autoplay = usePlayer((s) => s.autoplay);
  const loop = usePlayer((s) => s.loop);
  const sleep = usePlayer((s) => s.sleep);
  const rate = usePlayer((s) => s.rate);
  const [, tick] = useState(0);

  useEffect(() => {
    if (sleep?.mode !== 'countdown') return;
    const handle = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(handle);
  }, [sleep]);

  const flags: { id: string; text: string; on: boolean }[] = [
    { id: 'shuf', text: 'shuf', on: shuffle },
    { id: 'rpt', text: repeat === 'one' ? 'rpt1' : 'rpt', on: repeat !== 'off' },
    { id: 'auto', text: 'auto', on: autoplay },
  ];
  if (loop) flags.push({ id: 'loop', text: loop.b === null ? 'a–' : 'a–b', on: true });
  if (sleep) flags.push({ id: 'sleep', text: sleep.mode === 'endOfTrack' ? 'zz eot' : `zz ${sleepLeft(sleep.endsAt)}`, on: true });
  if (rate !== 1) flags.push({ id: 'rate', text: `${rate.toFixed(2)}×`, on: true });

  return (
    <span className={`flags ${className}`}>
      {flags.map((flag) => (
        <span key={flag.id} className={`flag ${flag.on ? 'is-on' : ''}`}>
          {flag.text}
        </span>
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- clock */

export function Clock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(handle);
  }, []);
  return (
    <span className={`tnum ${className}`}>
      {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
    </span>
  );
}

/** What the screen says when nothing is loaded. */
export function IdleLine() {
  const connection = useConnection();
  const text =
    connection.status === 'online'
      ? `ready · ${connection.label ?? 'server'}`
      : connection.status === 'offline'
        ? 'no server · offline'
        : 'searching for server';
  return <span>{text}</span>;
}
