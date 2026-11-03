/**
 * Every server read the interface makes, named once.
 *
 * Pages read these through hooks; actions read the same entries imperatively,
 * so "play this album" from a card and the album page share one request and
 * one cached answer.
 */

import { fetchQuery, getQueryData, prefetchQuery, useQuery, type QueryState } from './query';
import * as api from './subsonic';
import type {
  Album, AlbumInfo, Artist, ArtistInfo, Genre, InternetRadioStation, Playlist, ScanStatus,
  SearchResult, ServerInfo, Song,
} from './types';

export const keys = {
  album: (id: string) => `album:${id}`,
  albumInfo: (id: string) => `albumInfo:${id}`,
  artist: (id: string) => `artist:${id}`,
  artistInfo: (id: string) => `artistInfo:${id}`,
  topSongs: (name: string) => `topSongs:${name}`,
  playlist: (id: string) => `playlist:${id}`,
  albumList: (type: string, extra: string) => `albumList:${type}:${extra}`,
  artists: () => 'artists',
  genres: () => 'genres',
  starred: () => 'starred',
  search: (query: string, scope: string) => `search:${scope}:${query}`,
  radio: () => 'radio',
  scan: () => 'scan',
  server: () => 'server',
  genreSongs: (genre: string) => `genreSongs:${genre}`,
};

const MINUTE = 60_000;

/* --------------------------------------------------------------- imperative */

export function loadAlbum(id: string): Promise<Album> {
  return fetchQueryFresh(keys.album(id), () => api.getAlbum(id));
}

export function loadPlaylist(id: string): Promise<Playlist> {
  return fetchQueryFresh(keys.playlist(id), () => api.getPlaylist(id));
}

export function loadArtist(id: string): Promise<Artist> {
  return fetchQueryFresh(keys.artist(id), () => api.getArtist(id));
}

export function prefetchAlbum(id: string): void {
  prefetchQuery(keys.album(id), () => api.getAlbum(id), 5 * MINUTE);
}

export function prefetchArtist(id: string): void {
  prefetchQuery(keys.artist(id), () => api.getArtist(id), 5 * MINUTE);
}

export function prefetchPlaylist(id: string): void {
  prefetchQuery(keys.playlist(id), () => api.getPlaylist(id), MINUTE);
}

/** Use a cached copy when there is one, otherwise ask. */
function fetchQueryFresh<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = getQueryData<T>(key);
  if (cached !== undefined) return Promise.resolve(cached);
  return fetchQuery(key, fn);
}

export async function loadAlbumSongs(id: string): Promise<Song[]> {
  const album = await loadAlbum(id);
  return album.song ?? [];
}

export async function loadPlaylistSongs(id: string): Promise<Song[]> {
  const playlist = await loadPlaylist(id);
  return playlist.entry ?? [];
}

/** Every track by an artist, album by album in release order. */
export async function loadArtistSongs(id: string): Promise<Song[]> {
  const artist = await loadArtist(id);
  const albums = [...(artist.album ?? [])].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  const loaded = await Promise.all(albums.map((album) => loadAlbum(album.id).catch(() => null)));
  return loaded.flatMap((album) => album?.song ?? []);
}

/* -------------------------------------------------------------------- hooks */

export function useAlbum(id: string | undefined): QueryState<Album> {
  return useQuery(id ? keys.album(id) : null, () => api.getAlbum(id!), { staleTime: 5 * MINUTE });
}

export function useAlbumInfo(id: string | undefined): QueryState<AlbumInfo> {
  return useQuery(id ? keys.albumInfo(id) : null, () => api.getAlbumInfo(id!).catch(() => ({})), { staleTime: 60 * MINUTE });
}

export function useArtist(id: string | undefined): QueryState<Artist> {
  return useQuery(id ? keys.artist(id) : null, () => api.getArtist(id!), { staleTime: 5 * MINUTE });
}

export function useArtistInfo(id: string | undefined): QueryState<ArtistInfo> {
  return useQuery(id ? keys.artistInfo(id) : null, () => api.getArtistInfo(id!).catch(() => ({})), {
    staleTime: 60 * MINUTE,
  });
}

export function useTopSongs(name: string | undefined, count = 20): QueryState<Song[]> {
  return useQuery(name ? keys.topSongs(name) : null, () => api.getTopSongs(name!, count).catch(() => []), {
    staleTime: 30 * MINUTE,
  });
}

export function usePlaylistData(id: string | undefined): QueryState<Playlist> {
  return useQuery(id ? keys.playlist(id) : null, () => api.getPlaylist(id!), { staleTime: MINUTE });
}

export function useAlbumList(
  type: api.AlbumListType,
  opts: { size?: number; offset?: number; genre?: string; fromYear?: number; toYear?: number } = {},
  staleTime = 2 * MINUTE,
): QueryState<Album[]> {
  const extra = `${opts.size ?? 50}:${opts.offset ?? 0}:${opts.genre ?? ''}:${opts.fromYear ?? ''}:${opts.toYear ?? ''}`;
  return useQuery(keys.albumList(type, extra), () => api.getAlbumList(type, opts), { staleTime });
}

export function useArtistIndex(): QueryState<{ name: string; artist: Artist[] }[]> {
  return useQuery(keys.artists(), () => api.getArtists(), { staleTime: 10 * MINUTE });
}

export function useGenres(): QueryState<Genre[]> {
  return useQuery(keys.genres(), () => api.getGenres(), { staleTime: 10 * MINUTE });
}

export function useStarredItems(): QueryState<SearchResult> {
  return useQuery(keys.starred(), () => api.getStarred(), { staleTime: MINUTE });
}

export function useSearch(query: string, opts: api.SearchOptions, scope = 'all'): QueryState<SearchResult> {
  const term = query.trim();
  return useQuery(term ? keys.search(term, scope) : null, () => api.search(term, opts), { staleTime: 2 * MINUTE });
}

export function useRadioStations(): QueryState<InternetRadioStation[]> {
  return useQuery(keys.radio(), () => api.getInternetRadioStations().catch(() => []), { staleTime: 10 * MINUTE });
}

export function useScanStatus(): QueryState<ScanStatus> {
  return useQuery(keys.scan(), () => api.getScanStatus(), { staleTime: 5_000 });
}

export function useServerInfo(): QueryState<ServerInfo> {
  return useQuery(keys.server(), () => api.ping(), { staleTime: 10 * MINUTE });
}

export function useGenreSongs(genre: string): QueryState<Song[]> {
  return useQuery(keys.genreSongs(genre), () => api.getSongsByGenre(genre, 500), { staleTime: 5 * MINUTE });
}
