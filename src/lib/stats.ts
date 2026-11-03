/**
 * The listening log.
 *
 * Subsonic keeps a play *count* per song and nothing else — no timestamps, no
 * listening time, no order. This keeps a compact log of every real listen on
 * this device (a play counts after thirty seconds, or half of a short track)
 * so the Stats page can answer "what have I actually been listening to" by
 * week, month, year, hour of day and day of the week.
 *
 * Storage is deliberately compact: events are tuples and song details are
 * stored once per song, so twenty thousand listens fit comfortably in
 * localStorage.
 */

import type { Song } from './types';

const EVENTS_KEY = 'frequenzy.plays.v1';
const META_KEY = 'frequenzy.playmeta.v1';
const MAX_EVENTS = 20_000;

/** [songId, epoch seconds, seconds listened] */
type PlayEvent = [string, number, number];

export interface SongMeta {
  /** title */ t: string;
  /** artist */ a: string;
  /** artist id */ ai?: string;
  /** album */ al?: string;
  /** album id */ ali?: string;
  /** cover art */ c?: string;
  /** duration */ d?: number;
  /** genre */ g?: string;
}

let events: PlayEvent[] = loadEvents() ?? [];
let meta: Record<string, SongMeta> = loadMeta() ?? {};
const listeners = new Set<() => void>();
let version = 0;

/**
 * Listens logged or extended here since the last write. Another tab may have
 * written in the meantime, so a write folds what is stored together with these
 * rather than overwriting it — two open tabs never erase each other's plays.
 */
let pending = new Set<PlayEvent>();
let dirty = false;

/** The stored log, or null when storage cannot be read at all. */
function loadEvents(): PlayEvent[] | null {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number')
      : [];
  } catch {
    return null;
  }
}

function loadMeta(): Record<string, SongMeta> | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

/** Fold the stored log (possibly written by another tab) together with ours. */
function mergeStored(): void {
  const stored = loadEvents();
  if (!stored) return; // storage is unreadable: what is in memory is all there is
  if (pending.size) {
    const at = new Map<string, number>();
    stored.forEach((event, i) => at.set(`${event[0]}@${event[1]}`, i));
    for (const event of pending) {
      const i = at.get(`${event[0]}@${event[1]}`);
      if (i === undefined) stored.push(event);
      else stored[i] = event;
    }
    stored.sort((a, b) => a[1] - b[1]);
  }
  events = stored.length > MAX_EVENTS ? stored.slice(stored.length - MAX_EVENTS) : stored;
  meta = { ...(loadMeta() ?? {}), ...meta };
  pruneMeta();
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(): void {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(persistNow, 4000);
}

export function persistStats(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistNow();
}

function persistNow(): void {
  persistTimer = undefined;
  if (!dirty) return;
  dirty = false;
  mergeStored();
  pending = new Set();
  write();
}

function write(): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Out of room: drop the oldest quarter and try once more.
    events = events.slice(Math.floor(events.length / 4));
    pruneMeta();
    try {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* stats are a nicety */
    }
  }
}

function pruneMeta(): void {
  const used = new Set(events.map((e) => e[0]));
  for (const id of Object.keys(meta)) if (!used.has(id)) delete meta[id];
}

function emit(): void {
  version += 1;
  for (const fn of [...listeners]) fn();
}

export function subscribeStats(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function statsVersion(): number {
  return version;
}

function metaFor(song: Song): SongMeta {
  return {
    t: song.title,
    a: song.displayArtist ?? song.artist ?? '',
    ai: song.artistId,
    al: song.album,
    ali: song.albumId,
    c: song.coverArt,
    d: song.duration ? Math.round(song.duration) : undefined,
    g: song.genre,
  };
}

export interface PlayHandle {
  event: PlayEvent;
}

/** Record that a song has been listened to. Returns a handle for adding time. */
export function logPlay(song: Song, seconds: number): PlayHandle {
  meta[song.id] = metaFor(song);
  const event: PlayEvent = [song.id, Math.floor(Date.now() / 1000), Math.round(seconds)];
  events.push(event);
  pending.add(event);
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
    pruneMeta();
  }
  schedulePersist();
  emit();
  return { event };
}

/** Keep the listened time on a logged play current as the track carries on. */
export function updatePlay(handle: PlayHandle, seconds: number): void {
  const rounded = Math.round(seconds);
  if (handle.event[2] === rounded) return;
  handle.event[2] = rounded;
  pending.add(handle.event);
  schedulePersist();
}

export function clearStats(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = undefined;
  events = [];
  meta = {};
  pending = new Set();
  dirty = false;
  write();
  emit();
}

export function exportStats(): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), events, meta }, null, 0);
}

export function playCount(): number {
  return events.length;
}

/* ---------------------------------------------------------------- summaries */

export type StatsRange = '7d' | '30d' | '365d' | 'all';

const RANGE_DAYS: Record<StatsRange, number | null> = { '7d': 7, '30d': 30, '365d': 365, all: null };

export interface RankedSong {
  id: string;
  meta: SongMeta;
  plays: number;
  seconds: number;
}

export interface RankedArtist {
  name: string;
  id?: string;
  coverArt?: string;
  plays: number;
  seconds: number;
}

export interface RankedAlbum {
  id: string;
  name: string;
  artist: string;
  coverArt?: string;
  plays: number;
  seconds: number;
}

export interface StatsSummary {
  plays: number;
  seconds: number;
  uniqueSongs: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  topSongs: RankedSong[];
  topArtists: RankedArtist[];
  topAlbums: RankedAlbum[];
  topGenres: { name: string; plays: number }[];
  /** Seconds listened per hour of the day, local time. */
  byHour: number[];
  /** Seconds listened per weekday, Monday first. */
  byWeekday: number[];
  /** Seconds listened per calendar day, keyed YYYY-MM-DD, for the heatmap. */
  byDay: Record<string, number>;
  /** Consecutive days, ending today or yesterday, with at least one listen. */
  streak: number;
  firstAt: number | null;
}

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function summarize(range: StatsRange, limit = 10): StatsSummary {
  const days = RANGE_DAYS[range];
  const since = days === null ? 0 : Date.now() / 1000 - days * 86400;

  const songs = new Map<string, RankedSong>();
  const artists = new Map<string, RankedArtist>();
  const albums = new Map<string, RankedAlbum>();
  const genres = new Map<string, number>();
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const byDay: Record<string, number> = {};
  let plays = 0;
  let seconds = 0;
  let firstAt: number | null = null;

  for (const [id, at, listened] of events) {
    // The heatmap always shows the last eighteen weeks, whatever the range.
    const date = new Date(at * 1000);
    const key = dayKey(date);
    byDay[key] = (byDay[key] ?? 0) + Math.max(listened, 1);
    if (at < since) continue;

    const info = meta[id];
    if (!info) continue;
    plays += 1;
    seconds += listened;
    if (firstAt === null || at < firstAt) firstAt = at;

    byHour[date.getHours()] += listened;
    byWeekday[(date.getDay() + 6) % 7] += listened;

    const song = songs.get(id) ?? { id, meta: info, plays: 0, seconds: 0 };
    song.plays += 1;
    song.seconds += listened;
    songs.set(id, song);

    const artistKey = info.ai ?? info.a;
    if (artistKey) {
      const artist = artists.get(artistKey) ?? { name: info.a, id: info.ai, coverArt: info.ai ? `ar-${info.ai}` : undefined, plays: 0, seconds: 0 };
      artist.plays += 1;
      artist.seconds += listened;
      artists.set(artistKey, artist);
    }

    if (info.ali) {
      const album = albums.get(info.ali) ?? { id: info.ali, name: info.al ?? '', artist: info.a, coverArt: info.c, plays: 0, seconds: 0 };
      album.plays += 1;
      album.seconds += listened;
      albums.set(info.ali, album);
    }

    if (info.g) genres.set(info.g, (genres.get(info.g) ?? 0) + 1);
  }

  const rank = <T extends { plays: number; seconds: number }>(list: Iterable<T>) =>
    [...list].sort((a, b) => b.plays - a.plays || b.seconds - a.seconds).slice(0, limit);

  return {
    plays,
    seconds,
    uniqueSongs: songs.size,
    uniqueArtists: artists.size,
    uniqueAlbums: albums.size,
    topSongs: rank(songs.values()),
    topArtists: rank(artists.values()),
    topAlbums: rank(albums.values()),
    topGenres: [...genres.entries()]
      .map(([name, count]) => ({ name, plays: count }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 8),
    byHour,
    byWeekday,
    byDay,
    streak: streakFrom(byDay),
    firstAt,
  };
}

function streakFrom(byDay: Record<string, number>): number {
  const cursor = new Date();
  // A streak is still alive if the last listen was yesterday.
  if (!byDay[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (byDay[dayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The songs played most in the last `days` days, for "on repeat" shelves. */
export function onRepeat(days = 30, limit = 12): RankedSong[] {
  const since = Date.now() / 1000 - days * 86400;
  const counts = new Map<string, RankedSong>();
  for (const [id, at, listened] of events) {
    if (at < since || !meta[id]) continue;
    const entry = counts.get(id) ?? { id, meta: meta[id], plays: 0, seconds: 0 };
    entry.plays += 1;
    entry.seconds += listened;
    counts.set(id, entry);
  }
  return [...counts.values()]
    .filter((entry) => entry.plays >= 2)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

/** Turn a logged song back into something the player can queue. */
export function songFromMeta(id: string, info: SongMeta): Song {
  return {
    id,
    title: info.t,
    artist: info.a,
    artistId: info.ai,
    album: info.al,
    albumId: info.ali,
    coverArt: info.c,
    duration: info.d,
    genre: info.g,
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistStats);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistStats();
  });
  // Another tab wrote its listens: take them in, keeping ours not yet written.
  window.addEventListener('storage', (event) => {
    if (event.key !== EVENTS_KEY && event.key !== null) return;
    mergeStored();
    emit();
  });
}
