/**
 * Drag and drop on the desktop: songs, albums, artists and playlists can be
 * dragged onto a playlist in the sidebar, onto the queue, or onto the pinned
 * list. `dataTransfer` only carries strings, so the real payload waits here.
 */

import type { DragEvent } from 'react';

import { loadAlbumSongs, loadArtistSongs, loadPlaylistSongs } from './queries';
import type { Album, Artist, Playlist, Song } from './types';

export type DragPayload =
  | { kind: 'songs'; songs: Song[] }
  | { kind: 'album'; album: Album }
  | { kind: 'artist'; artist: Artist }
  | { kind: 'playlist'; playlist: Playlist };

let payload: DragPayload | null = null;
let ghost: HTMLElement | null = null;

const TYPE = 'application/x-frequenzy';

export function labelOf(p: DragPayload): string {
  switch (p.kind) {
    case 'songs':
      return p.songs.length === 1 ? p.songs[0].title : `${p.songs.length} songs`;
    case 'album':
      return p.album.name;
    case 'artist':
      return p.artist.name;
    default:
      return p.playlist.name;
  }
}

export function startDrag(event: DragEvent, next: DragPayload): void {
  payload = next;
  const label = labelOf(next);
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(TYPE, next.kind);
  event.dataTransfer.setData('text/plain', label);
  // A small label in the screen's style instead of a ghost of the whole row.
  ghost?.remove();
  ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = label;
  document.body.appendChild(ghost);
  event.dataTransfer.setDragImage(ghost, 12, 14);
  setTimeout(() => {
    ghost?.remove();
    ghost = null;
  }, 0);
}

export function endDrag(): void {
  payload = null;
}

export function currentDrag(): DragPayload | null {
  return payload;
}

/** True when the drag in progress is ours (not a file from the desktop). */
export function isOurDrag(event: DragEvent): boolean {
  return payload !== null && Array.from(event.dataTransfer.types).includes(TYPE);
}

export async function songsOf(p: DragPayload): Promise<Song[]> {
  switch (p.kind) {
    case 'songs':
      return p.songs;
    case 'album':
      return loadAlbumSongs(p.album.id);
    case 'artist':
      return loadArtistSongs(p.artist.id);
    default:
      return loadPlaylistSongs(p.playlist.id);
  }
}
