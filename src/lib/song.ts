/** Helpers for working with lists of songs. */

import type { Song } from './types';

/** The fields worth keeping when a song is written to storage. */
const KEEP: (keyof Song)[] = [
  'id', 'title', 'album', 'albumId', 'artist', 'artistId', 'coverArt', 'duration', 'track',
  'discNumber', 'year', 'genre', 'suffix', 'contentType', 'bitRate', 'bitDepth', 'samplingRate',
  'channelCount', 'size', 'replayGain', 'displayArtist', 'isRadio', 'streamUrl', 'userRating',
  'playCount', 'bpm',
];

/**
 * A song stripped to what playback and display need. Paths, comments, genre
 * arrays and MusicBrainz ids roughly double what a queue costs in storage, and
 * the details view fetches the full record when it is opened anyway.
 */
export function compactSong(song: Song): Song {
  const out: Record<string, unknown> = {};
  for (const key of KEEP) {
    const value = song[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out as unknown as Song;
}

/** Fisher–Yates over a copy. `Array.sort(() => Math.random() - 0.5)` is biased. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomIndex(length: number): number {
  return length > 0 ? Math.floor(Math.random() * length) : 0;
}

/** Keep the first of each id, in order. */
export function uniqueSongs(songs: readonly Song[]): Song[] {
  const seen = new Set<string>();
  const out: Song[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    out.push(song);
  }
  return out;
}

export function totalDuration(songs: readonly Song[]): number {
  return songs.reduce((sum, song) => sum + (song.duration ?? 0), 0);
}

export function albumRoute(id: string | undefined): string | null {
  return id ? `/album/${encodeURIComponent(id)}` : null;
}

export function artistRoute(id: string | undefined): string | null {
  return id ? `/artist/${encodeURIComponent(id)}` : null;
}

/** Artwork id for an artist. Navidrome names artist images `ar-<id>`. */
export function artistCover(artist: { id: string; coverArt?: string }): string {
  return artist.coverArt || `ar-${artist.id}`;
}
