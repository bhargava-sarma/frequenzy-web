/** Small formatting helpers shared across the interface. */

import type { Song } from './types';

export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1 hour 24 minutes" — the long form Apple Music uses under album titles. */
export function formatDurationLong(seconds: number | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ') || 'under a minute';
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatCount(n: number | undefined, singular: string, plural = `${singular}s`): string {
  if (!n) return `0 ${plural}`;
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

export interface QualityBadge {
  label: string;
  detail: string;
  /** Lossless formats get the emphasised treatment. */
  lossless: boolean;
  hiRes: boolean;
}

const LOSSLESS = new Set(['flac', 'alac', 'wav', 'aiff', 'aif', 'ape', 'wv', 'dsf', 'dff', 'shn']);

/** The badge shown next to a track — this app exists to keep it saying "Lossless". */
export function qualityBadge(song: Song | null | undefined): QualityBadge | null {
  if (!song) return null;
  const suffix = (song.suffix ?? song.contentType?.split('/').pop() ?? '').toLowerCase();
  if (!suffix) return null;

  const lossless = LOSSLESS.has(suffix);
  const rate = song.samplingRate ? song.samplingRate / 1000 : null;
  const depth = song.bitDepth ?? null;
  const hiRes = lossless && ((rate !== null && rate > 48) || (depth !== null && depth > 16));

  const detailParts: string[] = [];
  if (depth) detailParts.push(`${depth}-bit`);
  if (rate) detailParts.push(`${rate % 1 === 0 ? rate : rate.toFixed(1)} kHz`);
  if (!lossless && song.bitRate) detailParts.push(`${song.bitRate} kbps`);

  return {
    label: hiRes ? 'Hi-Res Lossless' : lossless ? 'Lossless' : suffix.toUpperCase(),
    detail: detailParts.join(' · ') || suffix.toUpperCase(),
    lossless,
    hiRes,
  };
}

export function songArtist(song: Song | null | undefined): string {
  if (!song) return '';
  return song.displayArtist ?? song.artist ?? song.artists?.map((a) => a.name).join(', ') ?? 'Unknown Artist';
}

export function albumArtist(album: { displayArtist?: string; artist?: string } | null | undefined): string {
  if (!album) return '';
  return album.displayArtist ?? album.artist ?? 'Unknown Artist';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Stable pseudo-random number from a string, for placeholder gradients. */
export function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}
