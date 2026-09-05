/**
 * Library-wide shared state: playlists and what is favourited.
 *
 * Favourites need to be globally consistent — hearting a song in the queue has
 * to light up the same song in the album view — so the set of starred ids lives
 * here rather than in each list.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import * as api from '../lib/subsonic';
import { connection } from '../lib/connection';
import type { Playlist, Song } from '../lib/types';

interface LibraryContextValue {
  playlists: Playlist[];
  playlistsLoading: boolean;
  reloadPlaylists: () => void;
  starredSongs: Set<string>;
  starredAlbums: Set<string>;
  starredArtists: Set<string>;
  isStarred: (kind: 'song' | 'album' | 'artist', id: string) => boolean;
  toggleStar: (kind: 'song' | 'album' | 'artist', id: string) => Promise<void>;
  createPlaylist: (name: string, songIds?: string[]) => Promise<Playlist | null>;
  addToPlaylist: (playlistId: string, songs: Song[]) => Promise<void>;
  removeFromPlaylist: (playlistId: string, indices: number[]) => Promise<void>;
  renamePlaylist: (playlistId: string, name: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [starredSongs, setStarredSongs] = useState<Set<string>>(new Set());
  const [starredAlbums, setStarredAlbums] = useState<Set<string>>(new Set());
  const [starredArtists, setStarredArtists] = useState<Set<string>>(new Set());
  const [nonce, setNonce] = useState(0);

  const reloadPlaylists = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setPlaylistsLoading(true);
    api
      .getPlaylists()
      .then((result) => {
        if (alive) setPlaylists(result);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setPlaylistsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled, nonce]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api
      .getStarred()
      .then((result) => {
        if (!alive) return;
        setStarredSongs(new Set(result.song.map((s) => s.id)));
        setStarredAlbums(new Set(result.album.map((a) => a.id)));
        setStarredArtists(new Set(result.artist.map((a) => a.id)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, nonce]);

  // Favourites can change from another client, so refresh when we come back
  // online or move to a different server — but not on every routine re-probe,
  // which would refetch the whole library every few minutes for nothing.
  const lastConnection = useRef<{ status: string; id: string | null }>({ status: 'idle', id: null });
  useEffect(() => {
    if (!enabled) return;
    return connection.subscribe((state) => {
      const previous = lastConnection.current;
      const reconnected = state.status === 'online' && previous.status !== 'online';
      const movedServer = state.status === 'online' && previous.id !== null && previous.id !== state.candidateId;
      if (state.status !== 'resolving') {
        lastConnection.current = { status: state.status, id: state.candidateId };
      }
      if (reconnected || movedServer) setNonce((n) => n + 1);
    });
  }, [enabled]);

  const setterFor = useCallback((kind: 'song' | 'album' | 'artist') => {
    return kind === 'song' ? setStarredSongs : kind === 'album' ? setStarredAlbums : setStarredArtists;
  }, []);

  const currentSet = useCallback(
    (kind: 'song' | 'album' | 'artist') =>
      kind === 'song' ? starredSongs : kind === 'album' ? starredAlbums : starredArtists,
    [starredAlbums, starredArtists, starredSongs],
  );

  const isStarred = useCallback(
    (kind: 'song' | 'album' | 'artist', id: string) => currentSet(kind).has(id),
    [currentSet],
  );

  const toggleStar = useCallback(
    async (kind: 'song' | 'album' | 'artist', id: string) => {
      const setter = setterFor(kind);
      const wasStarred = currentSet(kind).has(id);

      // Optimistic: the heart animates immediately, and we roll back on failure.
      setter((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.delete(id);
        else next.add(id);
        return next;
      });

      const params = kind === 'song' ? { id } : kind === 'album' ? { albumId: id } : { artistId: id };
      try {
        if (wasStarred) await api.unstar(params);
        else await api.star(params);
      } catch {
        setter((prev) => {
          const next = new Set(prev);
          if (wasStarred) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    },
    [currentSet, setterFor],
  );

  const createPlaylist = useCallback(
    async (name: string, songIds: string[] = []) => {
      const created = await api.createPlaylist(name, songIds);
      reloadPlaylists();
      return created;
    },
    [reloadPlaylists],
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, songs: Song[]) => {
      await api.updatePlaylist(playlistId, { songIdToAdd: songs.map((s) => s.id) });
      reloadPlaylists();
    },
    [reloadPlaylists],
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, indices: number[]) => {
      await api.updatePlaylist(playlistId, { songIndexToRemove: indices });
      reloadPlaylists();
    },
    [reloadPlaylists],
  );

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string) => {
      await api.updatePlaylist(playlistId, { name });
      reloadPlaylists();
    },
    [reloadPlaylists],
  );

  const deletePlaylistById = useCallback(
    async (playlistId: string) => {
      await api.deletePlaylist(playlistId);
      reloadPlaylists();
    },
    [reloadPlaylists],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      playlists,
      playlistsLoading,
      reloadPlaylists,
      starredSongs,
      starredAlbums,
      starredArtists,
      isStarred,
      toggleStar,
      createPlaylist,
      addToPlaylist,
      removeFromPlaylist,
      renamePlaylist,
      deletePlaylist: deletePlaylistById,
    }),
    [
      addToPlaylist, createPlaylist, deletePlaylistById, isStarred, playlists,
      playlistsLoading, reloadPlaylists, removeFromPlaylist, renamePlaylist,
      starredAlbums, starredArtists, starredSongs, toggleStar,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
