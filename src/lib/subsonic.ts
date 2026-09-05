/**
 * Subsonic / OpenSubsonic API client for Navidrome.
 *
 * Two things matter here beyond the usual CRUD:
 *  1. Streams are always requested raw — `format=raw` tells Navidrome to hand back
 *     the original file bytes, so a 24/96 FLAC arrives as a 24/96 FLAC.
 *  2. Every request goes through the connection manager, so a request issued the
 *     moment you walk out the front door fails over to Tailscale and retries once.
 */

import { connection } from './connection';
import { md5, randomSalt } from './md5';
import type {
  Album,
  Artist,
  ArtistInfo,
  Genre,
  Playlist,
  ScanStatus,
  SearchResult,
  Song,
} from './types';

export const CLIENT_NAME = 'frequenzy';
export const API_VERSION = '1.16.1';

const AUTH_KEY = 'frequenzy.auth.v1';

export interface Credentials {
  username: string;
  salt: string;
  token: string;
}

export class SubsonicApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'SubsonicApiError';
    this.code = code;
  }
}

export class NetworkUnreachableError extends Error {
  constructor(message = 'Could not reach any Frequenzy server.') {
    super(message);
    this.name = 'NetworkUnreachableError';
  }
}

let credentials: Credentials | null = loadCredentials();

function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.username && parsed?.salt && parsed?.token) return parsed as Credentials;
    return null;
  } catch {
    return null;
  }
}

export function getCredentials(): Credentials | null {
  return credentials;
}

export function isAuthenticated(): boolean {
  return credentials !== null;
}

/** Derives the salted token so the plaintext password is never persisted. */
export function deriveCredentials(username: string, password: string): Credentials {
  const salt = randomSalt();
  return { username, salt, token: md5(password + salt) };
}

export function setCredentials(creds: Credentials | null): void {
  credentials = creds;
  try {
    if (creds) localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function authParams(): Record<string, string> {
  if (!credentials) return { c: CLIENT_NAME, v: API_VERSION, f: 'json' };
  return {
    u: credentials.username,
    t: credentials.token,
    s: credentials.salt,
    v: API_VERSION,
    c: CLIENT_NAME,
    f: 'json',
  };
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v !== undefined && v !== null) search.append(key, String(v));
    } else {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

/** Absolute URL for an API endpoint, including credentials. Sync — needs a resolved base. */
export function urlFor(endpoint: string, params: Record<string, unknown> = {}): string {
  const base = connection.baseUrl ?? '';
  return `${base}/rest/${endpoint}?${buildQuery({ ...authParams(), ...params })}`;
}

interface SubsonicEnvelope<T> {
  'subsonic-response': T & {
    status: 'ok' | 'failed';
    version: string;
    type?: string;
    serverVersion?: string;
    openSubsonic?: boolean;
    error?: { code: number; message: string };
  };
}

async function rawRequest<T>(
  base: string,
  endpoint: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${base}/rest/${endpoint}?${buildQuery({ ...authParams(), ...params })}`;
  const res = await fetch(url, { signal, cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new SubsonicApiError(0, `HTTP ${res.status} from ${endpoint}`);
  const json = (await res.json()) as SubsonicEnvelope<T>;
  const body = json['subsonic-response'];
  if (!body) throw new SubsonicApiError(0, `Malformed response from ${endpoint}`);
  if (body.status === 'failed' && body.error) {
    throw new SubsonicApiError(body.error.code, body.error.message);
  }
  return body as unknown as T;
}

export async function request<T>(
  endpoint: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  const base = await connection.ensure();
  try {
    return await rawRequest<T>(base, endpoint, params, signal);
  } catch (err) {
    if (err instanceof SubsonicApiError) throw err;
    if (signal?.aborted) throw err;
    // Transport-level failure: the network probably moved. Re-race and try once more.
    const next = await connection.handleNetworkFailure();
    if (!next) throw new NetworkUnreachableError();
    return rawRequest<T>(next, endpoint, params, signal);
  }
}

/* ------------------------------------------------------------------ media URLs */

export interface StreamOptions {
  /** Navidrome hands back the untouched source file when this is on. */
  raw?: boolean;
  /** Kept for completeness; ignored while `raw` is on. */
  maxBitRate?: number;
  format?: string;
}

/**
 * Stream URL. `format=raw` + `maxBitRate=0` is the pair Navidrome reads as
 * "do not transcode" — the response is the original FLAC, bit for bit.
 */
export function streamUrl(id: string, opts: StreamOptions = {}): string {
  const { raw = true, maxBitRate, format } = opts;
  return urlFor('stream.view', {
    id,
    format: raw ? 'raw' : format,
    maxBitRate: raw ? 0 : maxBitRate,
    estimateContentLength: false,
  });
}

/** Bypasses the transcoding pipeline entirely; used by the download action. */
export function downloadUrl(id: string): string {
  return urlFor('download.view', { id });
}

export function coverArtUrl(coverArt: string | undefined, size?: number): string {
  if (!coverArt) return '';
  return urlFor('getCoverArt.view', { id: coverArt, size });
}

/* --------------------------------------------------------------------- system */

export async function ping(): Promise<{ serverVersion?: string; type?: string; openSubsonic?: boolean }> {
  return request('ping.view');
}

export async function verifyCredentials(creds: Credentials): Promise<boolean> {
  const base = await connection.ensure();
  const previous = credentials;
  credentials = creds;
  try {
    await rawRequest(base, 'ping.view', {});
    return true;
  } catch (err) {
    credentials = previous;
    if (err instanceof SubsonicApiError) return false;
    throw err;
  }
}

export async function getScanStatus(): Promise<ScanStatus> {
  const res = await request<{ scanStatus: ScanStatus }>('getScanStatus.view');
  return res.scanStatus;
}

export async function startScan(fullScan = false): Promise<ScanStatus> {
  const res = await request<{ scanStatus: ScanStatus }>('startScan.view', { fullScan });
  return res.scanStatus;
}

/* --------------------------------------------------------------------- browse */

export type AlbumListType =
  | 'random'
  | 'newest'
  | 'highest'
  | 'frequent'
  | 'recent'
  | 'alphabeticalByName'
  | 'alphabeticalByArtist'
  | 'starred'
  | 'byYear'
  | 'byGenre';

export async function getAlbumList(
  type: AlbumListType,
  opts: { size?: number; offset?: number; genre?: string; fromYear?: number; toYear?: number } = {},
  signal?: AbortSignal,
): Promise<Album[]> {
  const res = await request<{ albumList2?: { album?: Album[] } }>(
    'getAlbumList2.view',
    { type, size: opts.size ?? 50, offset: opts.offset ?? 0, genre: opts.genre, fromYear: opts.fromYear, toYear: opts.toYear },
    signal,
  );
  return res.albumList2?.album ?? [];
}

export async function getAlbum(id: string, signal?: AbortSignal): Promise<Album> {
  const res = await request<{ album: Album }>('getAlbum.view', { id }, signal);
  return res.album;
}

export async function getArtists(signal?: AbortSignal): Promise<{ name: string; artist: Artist[] }[]> {
  const res = await request<{ artists?: { index?: { name: string; artist?: Artist[] }[] } }>(
    'getArtists.view',
    {},
    signal,
  );
  return (res.artists?.index ?? []).map((i) => ({ name: i.name, artist: i.artist ?? [] }));
}

export async function getArtist(id: string, signal?: AbortSignal): Promise<Artist> {
  const res = await request<{ artist: Artist }>('getArtist.view', { id }, signal);
  return res.artist;
}

export async function getArtistInfo(id: string, signal?: AbortSignal): Promise<ArtistInfo> {
  const res = await request<{ artistInfo2?: ArtistInfo }>(
    'getArtistInfo2.view',
    { id, count: 12 },
    signal,
  );
  return res.artistInfo2 ?? {};
}

export async function getTopSongs(artist: string, count = 20, signal?: AbortSignal): Promise<Song[]> {
  const res = await request<{ topSongs?: { song?: Song[] } }>('getTopSongs.view', { artist, count }, signal);
  return res.topSongs?.song ?? [];
}

export async function getSimilarSongs(id: string, count = 50, signal?: AbortSignal): Promise<Song[]> {
  const res = await request<{ similarSongs2?: { song?: Song[] } }>(
    'getSimilarSongs2.view',
    { id, count },
    signal,
  );
  return res.similarSongs2?.song ?? [];
}

export async function getSong(id: string, signal?: AbortSignal): Promise<Song> {
  const res = await request<{ song: Song }>('getSong.view', { id }, signal);
  return res.song;
}

export async function getRandomSongs(
  opts: { size?: number; genre?: string; fromYear?: number; toYear?: number } = {},
  signal?: AbortSignal,
): Promise<Song[]> {
  const res = await request<{ randomSongs?: { song?: Song[] } }>(
    'getRandomSongs.view',
    { size: opts.size ?? 100, genre: opts.genre, fromYear: opts.fromYear, toYear: opts.toYear },
    signal,
  );
  return res.randomSongs?.song ?? [];
}

export async function getSongsByGenre(genre: string, count = 200, offset = 0, signal?: AbortSignal): Promise<Song[]> {
  const res = await request<{ songsByGenre?: { song?: Song[] } }>(
    'getSongsByGenre.view',
    { genre, count, offset },
    signal,
  );
  return res.songsByGenre?.song ?? [];
}

export async function getGenres(signal?: AbortSignal): Promise<Genre[]> {
  const res = await request<{ genres?: { genre?: Genre[] } }>('getGenres.view', {}, signal);
  return res.genres?.genre ?? [];
}

export async function getStarred(signal?: AbortSignal): Promise<SearchResult> {
  const res = await request<{ starred2?: { artist?: Artist[]; album?: Album[]; song?: Song[] } }>(
    'getStarred2.view',
    {},
    signal,
  );
  return {
    artist: res.starred2?.artist ?? [],
    album: res.starred2?.album ?? [],
    song: res.starred2?.song ?? [],
  };
}

export async function search(
  query: string,
  opts: { artistCount?: number; albumCount?: number; songCount?: number; artistOffset?: number; albumOffset?: number; songOffset?: number } = {},
  signal?: AbortSignal,
): Promise<SearchResult> {
  const res = await request<{ searchResult3?: { artist?: Artist[]; album?: Album[]; song?: Song[] } }>(
    'search3.view',
    {
      query,
      artistCount: opts.artistCount ?? 12,
      albumCount: opts.albumCount ?? 24,
      songCount: opts.songCount ?? 40,
      artistOffset: opts.artistOffset ?? 0,
      albumOffset: opts.albumOffset ?? 0,
      songOffset: opts.songOffset ?? 0,
    },
    signal,
  );
  return {
    artist: res.searchResult3?.artist ?? [],
    album: res.searchResult3?.album ?? [],
    song: res.searchResult3?.song ?? [],
  };
}

/* ------------------------------------------------------------------ playlists */

export async function getPlaylists(signal?: AbortSignal): Promise<Playlist[]> {
  const res = await request<{ playlists?: { playlist?: Playlist[] } }>('getPlaylists.view', {}, signal);
  return res.playlists?.playlist ?? [];
}

export async function getPlaylist(id: string, signal?: AbortSignal): Promise<Playlist> {
  const res = await request<{ playlist: Playlist }>('getPlaylist.view', { id }, signal);
  return res.playlist;
}

export async function createPlaylist(name: string, songIds: string[] = []): Promise<Playlist | null> {
  const res = await request<{ playlist?: Playlist }>('createPlaylist.view', { name, songId: songIds });
  return res.playlist ?? null;
}

export async function updatePlaylist(
  playlistId: string,
  opts: {
    name?: string;
    comment?: string;
    public?: boolean;
    songIdToAdd?: string[];
    songIndexToRemove?: number[];
  },
): Promise<void> {
  await request('updatePlaylist.view', {
    playlistId,
    name: opts.name,
    comment: opts.comment,
    public: opts.public,
    songIdToAdd: opts.songIdToAdd,
    songIndexToRemove: opts.songIndexToRemove,
  });
}

export async function deletePlaylist(id: string): Promise<void> {
  await request('deletePlaylist.view', { id });
}

/* ------------------------------------------------------- ratings & scrobbling */

export async function star(opts: { id?: string; albumId?: string; artistId?: string }): Promise<void> {
  await request('star.view', opts);
}

export async function unstar(opts: { id?: string; albumId?: string; artistId?: string }): Promise<void> {
  await request('unstar.view', opts);
}

export async function setRating(id: string, rating: number): Promise<void> {
  await request('setRating.view', { id, rating });
}

export async function scrobble(id: string, submission: boolean, time?: number): Promise<void> {
  await request('scrobble.view', { id, submission, time: time ?? Date.now() });
}

/* ---------------------------------------------------------------------- lyrics */

export interface ServerLyricLine {
  start?: number;
  value: string;
}

export interface ServerLyrics {
  lang?: string;
  synced?: boolean;
  displayArtist?: string;
  displayTitle?: string;
  offset?: number;
  line?: ServerLyricLine[];
}

/** OpenSubsonic extension; Navidrome serves embedded and .lrc sidecar lyrics here. */
export async function getLyricsBySongId(id: string, signal?: AbortSignal): Promise<ServerLyrics[]> {
  const res = await request<{ lyricsList?: { structuredLyrics?: ServerLyrics[] } }>(
    'getLyricsBySongId.view',
    { id },
    signal,
  );
  return res.lyricsList?.structuredLyrics ?? [];
}
