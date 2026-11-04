/**
 * Library-wide shared state: playlists, favourites and ratings.
 *
 * Favourites need to be globally consistent — hearting a song in the queue has
 * to light up the same song in the album view — so the starred ids live here.
 * Each heart subscribes to its own id, so toggling one re-renders one heart.
 */

import * as api from '../lib/subsonic';
import { connection } from '../lib/connection';
import { invalidateQueries } from '../lib/query';
import { createStore, useStore } from '../lib/store';
import type { Playlist, Song } from '../lib/types';

export type StarKind = 'song' | 'album' | 'artist';

interface LibraryState {
  playlists: Playlist[];
  playlistsLoaded: boolean;
  starred: Record<StarKind, Set<string>>;
  /** Ratings changed in this session, layered over whatever the server sent. */
  ratings: Record<string, number>;
}

export const libraryStore = createStore<LibraryState>({
  playlists: [],
  playlistsLoaded: false,
  starred: { song: new Set(), album: new Set(), artist: new Set() },
  ratings: {},
});

function setStarredSet(kind: StarKind, ids: string[], on: boolean): void {
  libraryStore.set((state) => {
    const next = new Set(state.starred[kind]);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return { starred: { ...state.starred, [kind]: next } };
  });
}

function starParams(kind: StarKind, ids: string[]) {
  return kind === 'song' ? { id: ids } : kind === 'album' ? { albumId: ids } : { artistId: ids };
}

let playlistsRequest = 0;

export const library = {
  async loadPlaylists(): Promise<void> {
    const id = ++playlistsRequest;
    try {
      const playlists = await api.getPlaylists();
      if (id === playlistsRequest) libraryStore.set({ playlists, playlistsLoaded: true });
    } catch {
      if (id === playlistsRequest) libraryStore.set({ playlistsLoaded: true });
    }
  },

  async loadStarred(): Promise<void> {
    try {
      const result = await api.getStarred();
      libraryStore.set({
        starred: {
          song: new Set(result.song.map((s) => s.id)),
          album: new Set(result.album.map((a) => a.id)),
          artist: new Set(result.artist.map((a) => a.id)),
        },
      });
    } catch {
      /* offline; keep what we had */
    }
  },

  refresh(): void {
    void library.loadPlaylists();
    void library.loadStarred();
  },

  isStarred(kind: StarKind, id: string): boolean {
    return libraryStore.get().starred[kind].has(id);
  },

  /** Optimistic: the heart changes immediately and rolls back if the server refuses. */
  async setStarred(kind: StarKind, ids: string[], on: boolean): Promise<void> {
    if (ids.length === 0) return;
    const before = new Set(libraryStore.get().starred[kind]);
    setStarredSet(kind, ids, on);
    try {
      if (on) await api.star(starParams(kind, ids));
      else await api.unstar(starParams(kind, ids));
      invalidateQueries('starred');
    } catch (error) {
      libraryStore.set((state) => ({ starred: { ...state.starred, [kind]: before } }));
      throw error;
    }
  },

  async toggleStar(kind: StarKind, id: string): Promise<boolean> {
    const next = !library.isStarred(kind, id);
    await library.setStarred(kind, [id], next);
    return next;
  },

  rating(song: Song): number {
    return libraryStore.get().ratings[song.id] ?? song.userRating ?? 0;
  },

  async setRating(songId: string, rating: number): Promise<void> {
    const before = libraryStore.get().ratings[songId];
    libraryStore.set((state) => ({ ratings: { ...state.ratings, [songId]: rating } }));
    try {
      await api.setRating(songId, rating);
    } catch (error) {
      libraryStore.set((state) => {
        const ratings = { ...state.ratings };
        if (before === undefined) delete ratings[songId];
        else ratings[songId] = before;
        return { ratings };
      });
      throw error;
    }
  },

  async createPlaylist(name: string, songIds: string[] = []): Promise<Playlist | null> {
    const created = await api.createPlaylist(name, songIds);
    await library.loadPlaylists();
    invalidateQueries('playlists');
    return created;
  },

  async addToPlaylist(playlistId: string, songs: Song[]): Promise<void> {
    if (songs.length === 0) return;
    await api.updatePlaylist(playlistId, { songIdToAdd: songs.map((s) => s.id) });
    invalidateQueries(`playlist:${playlistId}`);
    await library.loadPlaylists();
  },

  async removeFromPlaylist(playlistId: string, indices: number[]): Promise<void> {
    if (indices.length === 0) return;
    await api.updatePlaylist(playlistId, { songIndexToRemove: indices });
    invalidateQueries(`playlist:${playlistId}`);
    await library.loadPlaylists();
  },

  async replacePlaylistSongs(playlistId: string, songIds: string[]): Promise<void> {
    await api.replacePlaylistSongs(playlistId, songIds);
    invalidateQueries(`playlist:${playlistId}`);
    await library.loadPlaylists();
  },

  async updatePlaylist(playlistId: string, patch: { name?: string; comment?: string; public?: boolean }): Promise<void> {
    await api.updatePlaylist(playlistId, patch);
    invalidateQueries(`playlist:${playlistId}`);
    await library.loadPlaylists();
  },

  async deletePlaylist(playlistId: string): Promise<void> {
    await api.deletePlaylist(playlistId);
    libraryStore.set((state) => ({ playlists: state.playlists.filter((p) => p.id !== playlistId) }));
    invalidateQueries(`playlist:${playlistId}`);
    await library.loadPlaylists();
  },
};

/* ---------------------------------------------------------------- bindings */

export function useIsStarred(kind: StarKind, id: string | undefined): boolean {
  return useStore(libraryStore, (s) => (id ? s.starred[kind].has(id) : false));
}

export function usePlaylists(): Playlist[] {
  return useStore(libraryStore, (s) => s.playlists);
}

export function usePlaylistsLoaded(): boolean {
  return useStore(libraryStore, (s) => s.playlistsLoaded);
}

export function useRating(song: Song | null | undefined): number {
  return useStore(libraryStore, (s) => (song ? (s.ratings[song.id] ?? song.userRating ?? 0) : 0));
}

/* ------------------------------------------------------------ keep it fresh */

let started = false;

/**
 * Favourites can change from another client, so refresh when we come back
 * online or move to a different server — but not on every routine re-probe,
 * which would refetch the whole library every few minutes for nothing.
 */
export function startLibrary(): void {
  if (started) return;
  started = true;
  library.refresh();
  let previous: { status: string; id: string | null } = { status: connection.state.status, id: connection.state.candidateId };
  connection.subscribe((state) => {
    const reconnected = state.status === 'online' && previous.status !== 'online' && previous.status !== 'idle';
    const moved = state.status === 'online' && previous.id !== null && previous.id !== state.candidateId;
    if (state.status !== 'resolving') previous = { status: state.status, id: state.candidateId };
    if (reconnected || moved) library.refresh();
  });
}

export function resetLibrary(): void {
  libraryStore.set({
    playlists: [],
    playlistsLoaded: false,
    starred: { song: new Set(), album: new Set(), artist: new Set() },
    ratings: {},
  });
}
