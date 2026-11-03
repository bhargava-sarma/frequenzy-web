/**
 * What the listener can do, as plain functions.
 *
 * Buttons, menus, swipe actions, keyboard shortcuts and the command palette
 * all call these, so "play next" means the same thing — and says the same
 * thing back, with the same undo — wherever it was asked for.
 */

import { copyText, saveFile } from '../lib/clipboard';
import { downloadSongs, isDownloaded, removeDownloads } from '../lib/downloads';
import { songArtist } from '../lib/format';
import { navigate } from '../lib/nav';
import { invalidateQueries } from '../lib/query';
import { loadAlbumSongs, loadArtistSongs, loadPlaylistSongs } from '../lib/queries';
import { shuffled, uniqueSongs } from '../lib/song';
import * as api from '../lib/subsonic';
import type { Album, Artist, Playlist, Song } from '../lib/types';
import { library, type StarKind } from './library';
import { player, type PlaybackContextInfo } from './player';
import { ui } from './ui';

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

/** “Title” for one song, "12 songs" for several. */
export function describe(songs: Song[]): string {
  return songs.length === 1 ? `“${songs[0].title}”` : plural(songs.length, 'song');
}

function fail(message: string) {
  return () => {
    ui.error(message);
  };
}

export function albumContext(album: { id: string; name: string }): PlaybackContextInfo {
  return { kind: 'Album', name: album.name, id: album.id, route: `/album/${encodeURIComponent(album.id)}` };
}

export function playlistContext(playlist: { id: string; name: string }): PlaybackContextInfo {
  return { kind: 'Playlist', name: playlist.name, id: playlist.id, route: `/playlist/${encodeURIComponent(playlist.id)}` };
}

export function artistContext(artist: { id: string; name: string }): PlaybackContextInfo {
  return { kind: 'Artist', name: artist.name, id: artist.id, route: `/artist/${encodeURIComponent(artist.id)}` };
}

/* --------------------------------------------------------------------- play */

export function playSongs(songs: Song[], index = 0, context?: PlaybackContextInfo, opts: { shuffle?: boolean } = {}): void {
  if (songs.length === 0) {
    ui.toast('nothing to play');
    return;
  }
  player.playQueue(songs, index, context, opts);
}

export async function playAlbum(album: { id: string; name: string }, opts: { shuffle?: boolean } = {}): Promise<void> {
  try {
    const songs = await loadAlbumSongs(album.id);
    playSongs(songs, 0, albumContext(album), { shuffle: opts.shuffle ?? false });
  } catch {
    ui.error(`couldn't load “${album.name}”`);
  }
}

export async function playArtist(artist: { id: string; name: string }, opts: { shuffle?: boolean } = {}): Promise<void> {
  try {
    const songs = await loadArtistSongs(artist.id);
    playSongs(songs, 0, artistContext(artist), { shuffle: opts.shuffle ?? false });
  } catch {
    ui.error(`couldn't load ${artist.name}`);
  }
}

export async function playPlaylist(playlist: { id: string; name: string }, opts: { shuffle?: boolean } = {}): Promise<void> {
  try {
    const songs = await loadPlaylistSongs(playlist.id);
    playSongs(songs, 0, playlistContext(playlist), { shuffle: opts.shuffle ?? false });
  } catch {
    ui.error(`couldn't load “${playlist.name}”`);
  }
}

/* -------------------------------------------------------------------- queue */

export function playNext(songs: Song[]): void {
  if (songs.length === 0) return;
  const before = player.snapshot();
  player.playNext(songs);
  if (before.queue.length > 0) {
    ui.toast(`playing next — ${describe(songs)}`, { action: { label: 'undo', run: () => player.restore(before) } });
  }
}

export function addToQueue(songs: Song[]): void {
  if (songs.length === 0) return;
  const before = player.snapshot();
  player.addToQueue(songs);
  if (before.queue.length > 0) {
    ui.toast(`added to queue — ${describe(songs)}`, { action: { label: 'undo', run: () => player.restore(before) } });
  }
}

export async function queueAlbum(album: { id: string; name: string }, where: 'next' | 'last'): Promise<void> {
  try {
    const songs = await loadAlbumSongs(album.id);
    if (where === 'next') playNext(songs);
    else addToQueue(songs);
  } catch {
    ui.error(`couldn't load “${album.name}”`);
  }
}

export async function queuePlaylist(playlist: { id: string; name: string }, where: 'next' | 'last'): Promise<void> {
  try {
    const songs = await loadPlaylistSongs(playlist.id);
    if (where === 'next') playNext(songs);
    else addToQueue(songs);
  } catch {
    ui.error(`couldn't load “${playlist.name}”`);
  }
}

export async function queueArtist(artist: { id: string; name: string }, where: 'next' | 'last'): Promise<void> {
  try {
    const songs = await loadArtistSongs(artist.id);
    if (where === 'next') playNext(songs);
    else addToQueue(songs);
  } catch {
    ui.error(`couldn't load ${artist.name}`);
  }
}

export function removeFromQueue(keys: string[]): void {
  if (keys.length === 0) return;
  const before = player.snapshot();
  player.removeKeys(keys);
  ui.toast(keys.length === 1 ? 'removed from queue' : `removed ${plural(keys.length, 'song')}`, {
    action: { label: 'undo', run: () => player.restore(before) },
  });
}

export function clearUpcoming(): void {
  const before = player.snapshot();
  if (before.index + 1 >= before.queue.length) return;
  player.clearUpcoming();
  ui.toast('cleared up next', { action: { label: 'undo', run: () => player.restore(before) } });
}

export function clearPlayed(): void {
  const before = player.snapshot();
  if (before.index <= 0) return;
  player.clearPlayed();
  ui.toast('cleared history', { action: { label: 'undo', run: () => player.restore(before) } });
}

export function stopAndClear(): void {
  const before = player.snapshot();
  if (before.queue.length === 0) return;
  player.pause();
  player.clearAll();
  ui.toast('queue cleared', { action: { label: 'undo', run: () => player.restore({ ...before, playing: false }) } });
}

export function shuffleUpcoming(): void {
  const before = player.snapshot();
  player.shuffleUpcoming();
  ui.toast('shuffled up next', { action: { label: 'undo', run: () => player.restore(before) } });
}

export function saveQueueAsPlaylist(): void {
  const songs = player.store.get().queue.map((entry) => entry.song).filter((song) => !song.isRadio);
  if (songs.length === 0) {
    ui.toast('the queue is empty');
    return;
  }
  promptNewPlaylist(songs, 'queue — ' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
}

/* ------------------------------------------------------------- favourites */

export async function toggleFavourite(kind: StarKind, id: string): Promise<void> {
  try {
    const on = await library.toggleStar(kind, id);
    ui.toast(on ? 'saved to favourites' : 'removed from favourites');
  } catch {
    ui.error("couldn't update favourites");
  }
}

export async function setFavourites(kind: StarKind, ids: string[], on: boolean): Promise<void> {
  try {
    await library.setStarred(kind, ids, on);
    ui.toast(on ? `saved ${plural(ids.length, kind)} to favourites` : `removed ${plural(ids.length, kind)}`);
  } catch {
    ui.error("couldn't update favourites");
  }
}

export async function rateSong(song: Song, rating: number): Promise<void> {
  try {
    await library.setRating(song.id, rating);
  } catch {
    ui.error("couldn't save the rating");
  }
}

/* -------------------------------------------------------------- playlists */

export function choosePlaylist(songs: Song[]): void {
  if (songs.length === 0) return;
  ui.openDialog({ type: 'addToPlaylist', songs });
}

export async function addToPlaylist(playlist: Playlist, songs: Song[]): Promise<void> {
  if (songs.length === 0) return;
  try {
    await library.addToPlaylist(playlist.id, songs);
    ui.toast(`added ${describe(songs)} to ${playlist.name}`, {
      action: { label: 'undo', run: () => void undoAppend(playlist, songs) },
    });
  } catch {
    ui.error(`couldn't add to ${playlist.name}`);
  }
}

/**
 * Take back an append. Indices are worked out from the playlist as it is
 * now, and only removed if the tail really is the songs we added — never a
 * guess from a count that may be stale.
 */
async function undoAppend(playlist: Playlist, songs: Song[]): Promise<void> {
  try {
    const fresh = await api.getPlaylist(playlist.id);
    const entries = fresh.entry ?? [];
    const start = entries.length - songs.length;
    const matches = start >= 0 && songs.every((song, i) => entries[start + i]?.id === song.id);
    if (!matches) {
      ui.toast('the playlist changed — nothing undone');
      return;
    }
    await library.removeFromPlaylist(playlist.id, songs.map((_, i) => start + i));
    ui.toast('undone');
  } catch {
    ui.error("couldn't undo");
  }
}

export function promptNewPlaylist(songs: Song[] = [], suggestion = ''): void {
  ui.openDialog({
    type: 'prompt',
    title: 'new playlist',
    label: 'name',
    initialValue: suggestion,
    placeholder: 'untitled playlist',
    confirmLabel: 'create',
    onConfirm: (name) => {
      void library
        .createPlaylist(name, songs.map((s) => s.id))
        .then((created) => {
          ui.toast(songs.length ? `created ${name} with ${describe(songs)}` : `created ${name}`, {
            action: created ? { label: 'open', run: () => navigate(`/playlist/${encodeURIComponent(created.id)}`) } : undefined,
          });
        })
        .catch(fail(`couldn't create ${name}`));
    },
  });
}

export function renamePlaylist(playlist: { id: string; name: string }): void {
  ui.openDialog({
    type: 'prompt',
    title: 'rename playlist',
    label: 'name',
    initialValue: playlist.name,
    confirmLabel: 'rename',
    onConfirm: (name) => {
      if (name === playlist.name) return;
      void library
        .updatePlaylist(playlist.id, { name })
        .then(() => ui.toast(`renamed to ${name}`))
        .catch(fail("couldn't rename the playlist"));
    },
  });
}

export function editPlaylistDescription(playlist: { id: string; comment?: string }): void {
  ui.openDialog({
    type: 'prompt',
    title: 'description',
    label: 'description',
    initialValue: playlist.comment ?? '',
    placeholder: 'what is this playlist for?',
    multiline: true,
    confirmLabel: 'save',
    onConfirm: (comment) => {
      void library
        .updatePlaylist(playlist.id, { comment })
        .then(() => ui.toast('description saved'))
        .catch(fail("couldn't save the description"));
    },
  });
}

export async function togglePlaylistPublic(playlist: Playlist): Promise<void> {
  try {
    await library.updatePlaylist(playlist.id, { public: !playlist.public });
    ui.toast(playlist.public ? 'playlist is now private' : 'playlist is now public');
  } catch {
    ui.error("couldn't change sharing");
  }
}

export function deletePlaylist(playlist: { id: string; name: string }): void {
  ui.openDialog({
    type: 'confirm',
    title: 'delete playlist',
    message: `“${playlist.name}” will be deleted from the server. The songs stay in your library.`,
    confirmLabel: 'delete',
    danger: true,
    onConfirm: () => {
      void library
        .deletePlaylist(playlist.id)
        .then(() => {
          ui.toast(`deleted ${playlist.name}`);
          if (location.pathname.startsWith(`/playlist/${encodeURIComponent(playlist.id)}`)) {
            navigate('/library/playlists', { replace: true });
          }
        })
        .catch(fail("couldn't delete the playlist"));
    },
  });
}

export async function duplicatePlaylist(playlist: { id: string; name: string }): Promise<void> {
  try {
    const songs = await loadPlaylistSongs(playlist.id);
    const name = `${playlist.name} copy`;
    const created = await library.createPlaylist(name, songs.map((s) => s.id));
    ui.toast(`created ${name}`, {
      action: created ? { label: 'open', run: () => navigate(`/playlist/${encodeURIComponent(created.id)}`) } : undefined,
    });
  } catch {
    ui.error("couldn't duplicate the playlist");
  }
}

export async function removeDuplicates(playlist: { id: string; name: string }): Promise<void> {
  try {
    invalidateQueries(`playlist:${playlist.id}`);
    const songs = (await api.getPlaylist(playlist.id)).entry ?? [];
    const unique = uniqueSongs(songs);
    const removed = songs.length - unique.length;
    if (removed === 0) {
      ui.toast('no duplicates found');
      return;
    }
    await library.replacePlaylistSongs(playlist.id, songs.length, unique.map((s) => s.id));
    ui.toast(`removed ${plural(removed, 'duplicate')}`);
  } catch {
    ui.error("couldn't tidy the playlist");
  }
}

export type PlaylistSort = 'title' | 'artist' | 'album' | 'year' | 'duration' | 'shuffle' | 'reverse';

export async function sortPlaylist(playlist: { id: string; name: string }, by: PlaylistSort): Promise<void> {
  try {
    const songs = (await api.getPlaylist(playlist.id)).entry ?? [];
    if (songs.length < 2) return;
    const text = (get: (s: Song) => string | undefined) => (a: Song, b: Song) =>
      (get(a) ?? '').localeCompare(get(b) ?? '', undefined, { sensitivity: 'base', numeric: true });
    let sorted: Song[];
    switch (by) {
      case 'title': sorted = [...songs].sort(text((s) => s.title)); break;
      case 'artist': sorted = [...songs].sort(text((s) => songArtist(s))); break;
      case 'album': sorted = [...songs].sort((a, b) => text((s) => s.album)(a, b) || (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.track ?? 0) - (b.track ?? 0)); break;
      case 'year': sorted = [...songs].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)); break;
      case 'duration': sorted = [...songs].sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0)); break;
      case 'reverse': sorted = [...songs].reverse(); break;
      default: sorted = shuffled(songs);
    }
    await library.replacePlaylistSongs(playlist.id, songs.length, sorted.map((s) => s.id));
    ui.toast(by === 'shuffle' ? 'shuffled the playlist' : by === 'reverse' ? 'reversed the playlist' : `sorted by ${by}`);
  } catch {
    ui.error("couldn't sort the playlist");
  }
}

/** An extended M3U of library paths — playable by most desktop players. */
export async function exportPlaylist(playlist: { id: string; name: string }): Promise<void> {
  try {
    const songs = await loadPlaylistSongs(playlist.id);
    const lines = ['#EXTM3U', `#PLAYLIST:${playlist.name}`];
    for (const song of songs) {
      lines.push(`#EXTINF:${Math.round(song.duration ?? -1)},${songArtist(song)} - ${song.title}`);
      lines.push(song.path ?? `${songArtist(song)} - ${song.title}`);
    }
    saveFile(`${playlist.name.replace(/[\\/:*?"<>|]+/g, '_')}.m3u8`, lines.join('\n'), 'audio/x-mpegurl');
  } catch {
    ui.error("couldn't export the playlist");
  }
}

/* ------------------------------------------------------------------ radio */

export interface RadioSeed {
  kind: 'song' | 'album' | 'artist';
  id: string;
  name: string;
  genre?: string;
  song?: Song;
}

/** A station seeded from anything: similar songs, padded out by genre. */
export async function startRadio(seed: RadioSeed): Promise<void> {
  ui.toast(`tuning in — ${seed.name}`);
  try {
    let songs =
      seed.kind === 'artist'
        ? await api.getSimilarSongs2(seed.id, 80).catch(() => [] as Song[])
        : await api.getSimilarSongs(seed.id, 80).catch(() => [] as Song[]);
    if (songs.length < 10) {
      const padding = await api.getRandomSongs({ size: 60, genre: seed.genre }).catch(() => [] as Song[]);
      songs = uniqueSongs([...songs, ...padding]);
    }
    if (seed.song) songs = uniqueSongs([seed.song, ...songs]);
    if (songs.length === 0) {
      ui.toast('nothing similar found');
      return;
    }
    const ordered = seed.song ? [songs[0], ...shuffled(songs.slice(1))] : shuffled(songs);
    player.playQueue(ordered, 0, { kind: 'Station', name: `${seed.name} radio` }, { shuffle: false });
  } catch {
    ui.error("couldn't start the station");
  }
}

export async function shuffleLibrary(): Promise<void> {
  try {
    const songs = await api.getRandomSongs({ size: 300 });
    playSongs(songs, 0, { kind: 'Station', name: 'everything' }, { shuffle: false });
  } catch {
    ui.error("couldn't reach the library");
  }
}

export async function openRandomAlbum(): Promise<void> {
  try {
    const [album] = await api.getAlbumList('random', { size: 1 });
    if (album) navigate(`/album/${encodeURIComponent(album.id)}`);
    else ui.toast('the library is empty');
  } catch {
    ui.error("couldn't reach the library");
  }
}

export async function playRandomAlbum(): Promise<void> {
  try {
    const [album] = await api.getAlbumList('random', { size: 1 });
    if (album) await playAlbum(album);
    else ui.toast('the library is empty');
  } catch {
    ui.error("couldn't reach the library");
  }
}

/* --------------------------------------------------------------- offline */

export function download(songs: Song[]): void {
  const queued = downloadSongs(songs);
  if (queued === 0) ui.toast(songs.every((s) => isDownloaded(s.id)) ? 'already downloaded' : 'already downloading');
  else ui.toast(`downloading ${plural(queued, 'song')}`, { action: { label: 'view', run: () => navigate('/library/downloads') } });
}

export async function removeDownloadsFor(songs: Song[]): Promise<void> {
  const ids = songs.filter((s) => isDownloaded(s.id)).map((s) => s.id);
  if (ids.length === 0) return;
  await removeDownloads(ids);
  ui.toast(`removed ${plural(ids.length, 'download')}`);
}

export async function downloadAlbum(album: { id: string; name: string }): Promise<void> {
  try {
    download(await loadAlbumSongs(album.id));
  } catch {
    ui.error(`couldn't load “${album.name}”`);
  }
}

export async function downloadPlaylist(playlist: { id: string; name: string }): Promise<void> {
  try {
    download(await loadPlaylistSongs(playlist.id));
  } catch {
    ui.error(`couldn't load “${playlist.name}”`);
  }
}

/* --------------------------------------------------------------- sharing */

export async function copyLink(path: string): Promise<void> {
  const ok = await copyText(`${location.origin}${path}`);
  if (ok) ui.toast('link copied');
  else ui.error("couldn't copy");
}

export async function copySongInfo(song: Song): Promise<void> {
  const ok = await copyText(`${songArtist(song)} — ${song.title}${song.album ? ` (${song.album})` : ''}`);
  if (ok) ui.toast('copied');
  else ui.error("couldn't copy");
}

export function saveOriginal(song: Song): void {
  window.open(api.downloadUrl(song.id), '_blank', 'noopener');
}

/* ------------------------------------------------------------- navigation */

export function goToAlbum(item: { albumId?: string; id?: string }, isAlbum = false): void {
  const id = isAlbum ? item.id : item.albumId;
  if (id) navigate(`/album/${encodeURIComponent(id)}`);
}

export function goToArtist(item: { artistId?: string; id?: string }, isArtist = false): void {
  const id = isArtist ? item.id : item.artistId;
  if (id) navigate(`/artist/${encodeURIComponent(id)}`);
}

export function showInfo(song: Song): void {
  ui.openDialog({ type: 'trackInfo', song });
}

export type { Album, Artist };
