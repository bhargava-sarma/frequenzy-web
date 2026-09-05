/**
 * Lyrics: fetch, parse, sync and romanize.
 *
 * Sources are tried in order of trust — whatever is attached to the file on the
 * server first, then LRCLIB for a time-synced sheet. Everything is cached per
 * song so scrubbing back and forth never re-fetches.
 */

import { getLyricsBySongId, type ServerLyrics } from './subsonic';
import { profileScripts, romanizeLines, type ScriptProfile } from './romanize';
import type { Song } from './types';

const LRCLIB_BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = 'Frequenzy v1.0.0 (https://github.com/frequenzy)';

export interface LyricWord {
  /** Seconds from the start of the track. */
  time: number;
  text: string;
}

export interface LyricLine {
  /** Seconds from the start of the track; null for unsynced sheets. */
  time: number | null;
  text: string;
  /** Romanized counterpart, filled in lazily. */
  romanized?: string;
  /** Word-level timings, when the source is an enhanced LRC. */
  words?: LyricWord[];
}

export type LyricsSource = 'server' | 'lrclib' | 'none';

export interface Lyrics {
  lines: LyricLine[];
  synced: boolean;
  source: LyricsSource;
  instrumental: boolean;
  /** Global timing offset in seconds, from an [offset:] tag. */
  offset: number;
  profile: ScriptProfile;
  /** True once `romanized` has been populated on every line. */
  romanized: boolean;
}

export const EMPTY_LYRICS: Lyrics = {
  lines: [],
  synced: false,
  source: 'none',
  instrumental: false,
  offset: 0,
  profile: { scripts: new Set(), primary: 'latin', needsRomanization: false },
  romanized: false,
};

/* --------------------------------------------------------------------- parse */

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const WORD_TIMESTAMP = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;
const METADATA = /^\[(ar|ti|al|au|by|re|ve|length|offset):\s*(.*?)\]$/i;

function toSeconds(minutes: string, rest: string): number {
  return parseInt(minutes, 10) * 60 + parseFloat(rest.replace(':', '.'));
}

/** Parse an LRC sheet, including the enhanced (word-timed) dialect. */
export function parseLrc(raw: string): { lines: LyricLine[]; offset: number; synced: boolean } {
  const out: LyricLine[] = [];
  let offset = 0;
  let sawTimestamp = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const meta = METADATA.exec(line);
    if (meta) {
      if (meta[1].toLowerCase() === 'offset') {
        const ms = parseInt(meta[2], 10);
        if (!Number.isNaN(ms)) offset = ms / 1000;
      }
      continue;
    }

    TIMESTAMP.lastIndex = 0;
    const stamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = TIMESTAMP.exec(line)) !== null) {
      // Timestamps only count while they are still a prefix of the line.
      if (match.index !== lastIndex) break;
      stamps.push(toSeconds(match[1], match[2]));
      lastIndex = TIMESTAMP.lastIndex;
    }

    const body = line.slice(lastIndex).trim();

    if (stamps.length === 0) {
      out.push({ time: null, text: line });
      continue;
    }
    sawTimestamp = true;

    // Enhanced LRC: <00:12.34> before each word.
    const words: LyricWord[] = [];
    WORD_TIMESTAMP.lastIndex = 0;
    let plain = body;
    if (WORD_TIMESTAMP.test(body)) {
      WORD_TIMESTAMP.lastIndex = 0;
      let cursor = 0;
      let pendingTime: number | null = null;
      let wordMatch: RegExpExecArray | null;
      while ((wordMatch = WORD_TIMESTAMP.exec(body)) !== null) {
        const text = body.slice(cursor, wordMatch.index);
        if (pendingTime !== null && text.trim()) words.push({ time: pendingTime, text });
        pendingTime = toSeconds(wordMatch[1], wordMatch[2]);
        cursor = WORD_TIMESTAMP.lastIndex;
      }
      const tail = body.slice(cursor);
      if (pendingTime !== null && tail.trim()) words.push({ time: pendingTime, text: tail });
      plain = body.replace(WORD_TIMESTAMP, '').trim();
    }

    for (const time of stamps) {
      out.push({ time, text: plain, words: words.length ? words : undefined });
    }
  }

  out.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return { lines: out, offset, synced: sawTimestamp };
}

/* ------------------------------------------------------------------- sources */

function fromServerLyrics(entries: ServerLyrics[]): Lyrics | null {
  if (entries.length === 0) return null;
  // Prefer a synced sheet if the server has one.
  const chosen = entries.find((e) => e.synced && e.line?.length) ?? entries.find((e) => e.line?.length);
  if (!chosen?.line?.length) return null;

  const synced = Boolean(chosen.synced) && chosen.line.some((l) => typeof l.start === 'number');
  const lines: LyricLine[] = chosen.line.map((l) => ({
    time: synced && typeof l.start === 'number' ? l.start / 1000 : null,
    text: l.value ?? '',
  }));

  return {
    lines,
    synced,
    source: 'server',
    instrumental: false,
    offset: (chosen.offset ?? 0) / 1000,
    profile: profileScripts(lines.map((l) => l.text).join('\n')),
    romanized: false,
  };
}

interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

async function lrclibFetch(path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${LRCLIB_BASE}${path}`, {
    signal,
    headers: { 'Lrclib-Client': CLIENT_HEADER },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB responded ${res.status}`);
  return res.json();
}

function fromLrclib(record: LrclibRecord): Lyrics | null {
  if (record.instrumental) {
    return { ...EMPTY_LYRICS, instrumental: true, source: 'lrclib', profile: profileScripts('') };
  }
  if (record.syncedLyrics) {
    const { lines, offset, synced } = parseLrc(record.syncedLyrics);
    if (lines.length) {
      return {
        lines,
        synced,
        source: 'lrclib',
        instrumental: false,
        offset,
        profile: profileScripts(lines.map((l) => l.text).join('\n')),
        romanized: false,
      };
    }
  }
  if (record.plainLyrics) {
    const lines = record.plainLyrics.split(/\r?\n/).map((text) => ({ time: null, text }));
    return {
      lines,
      synced: false,
      source: 'lrclib',
      instrumental: false,
      offset: 0,
      profile: profileScripts(record.plainLyrics),
      romanized: false,
    };
  }
  return null;
}

async function fetchFromLrclib(song: Song, signal?: AbortSignal): Promise<Lyrics | null> {
  const artist = song.artist ?? song.displayArtist ?? '';
  const track = song.title ?? '';
  if (!artist || !track) return null;

  const params = new URLSearchParams({
    artist_name: artist,
    track_name: track,
    album_name: song.album ?? '',
  });
  if (song.duration) params.set('duration', String(Math.round(song.duration)));

  // Exact match first — it is the only call that respects the duration hint.
  try {
    const exact = (await lrclibFetch(`/get?${params}`, signal)) as LrclibRecord | null;
    if (exact) {
      const parsed = fromLrclib(exact);
      if (parsed) return parsed;
    }
  } catch {
    /* fall through to search */
  }

  // Then a looser search, preferring a synced result close to our duration.
  try {
    const search = new URLSearchParams({ artist_name: artist, track_name: track });
    const results = (await lrclibFetch(`/search?${search}`, signal)) as LrclibRecord[] | null;
    if (Array.isArray(results) && results.length) {
      const scored = results
        .map((r) => ({
          record: r,
          score:
            (r.syncedLyrics ? 0 : 100) +
            (song.duration ? Math.abs((r.duration ?? 0) - song.duration) : 0) +
            (r.albumName === song.album ? -5 : 0),
        }))
        .sort((a, b) => a.score - b.score);
      for (const { record } of scored) {
        const parsed = fromLrclib(record);
        if (parsed) return parsed;
      }
    }
  } catch {
    /* nothing found */
  }

  return null;
}

/* --------------------------------------------------------------------- cache */

const cache = new Map<string, Lyrics>();

export function getCachedLyrics(songId: string): Lyrics | undefined {
  return cache.get(songId);
}

/** Fetch lyrics for a song, trying the server first and LRCLIB second. */
export async function fetchLyrics(song: Song, signal?: AbortSignal): Promise<Lyrics> {
  const cached = cache.get(song.id);
  if (cached) return cached;

  let result: Lyrics | null = null;

  try {
    const server = await getLyricsBySongId(song.id, signal);
    result = fromServerLyrics(server);
  } catch {
    /* server has no lyrics endpoint or no match */
  }

  // A plain sheet from the server is still worth upgrading to a synced one.
  if (!result || !result.synced) {
    const remote = await fetchFromLrclib(song, signal);
    if (remote && (remote.synced || !result)) result = remote;
  }

  const final = result ?? { ...EMPTY_LYRICS, profile: profileScripts('') };
  cache.set(song.id, final);
  return final;
}

/** Romanize a lyric sheet in place (returns a new object), memoized per song. */
export async function romanizeLyrics(songId: string, lyrics: Lyrics, tones: 'none' | 'symbol' = 'none'): Promise<Lyrics> {
  if (lyrics.romanized || !lyrics.profile.needsRomanization) return lyrics;
  const romanizedText = await romanizeLines(lyrics.lines.map((l) => l.text), { tones });
  const next: Lyrics = {
    ...lyrics,
    lines: lyrics.lines.map((line, i) => ({ ...line, romanized: romanizedText[i] })),
    romanized: true,
  };
  cache.set(songId, next);
  return next;
}

/**
 * Index of the line that should be highlighted at `time`, or -1 before the first
 * one. Binary search, because this runs on every animation frame.
 */
export function activeLineIndex(lines: LyricLine[], time: number, offset = 0): number {
  const t = time + offset;
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const lineTime = lines[mid].time;
    if (lineTime === null || lineTime <= t) {
      if (lineTime !== null) found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
