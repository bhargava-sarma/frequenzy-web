/**
 * The standard menus for a song, album, artist, playlist and queue entry, so
 * right-clicking anything offers the same verbs in the same order — on desktop
 * as a menu under the pointer, on a phone as a sheet.
 */

import {
  AddToQueueIcon, AlbumIcon, ArtistIcon, CheckIcon, CopyIcon, DownloadIcon, ExportIcon, HeartIcon,
  InfoIcon, LinkIcon, PencilIcon, PinIcon, PlayIcon, PlayNextIcon, PlaylistIcon, PlusIcon, RadioIcon,
  RefreshIcon, SelectIcon, ShuffleIcon, SortIcon, StarIcon, TrashIcon, GlobeIcon,
} from '../components/Icons';
import { isDownloaded, isSupported as downloadsSupported } from '../lib/downloads';
import { albumArtist, songArtist } from '../lib/format';
import { loadAlbumSongs, loadArtistSongs, loadPlaylistSongs } from '../lib/queries';
import { artistCover } from '../lib/song';
import type { Album, Artist, Playlist, Song } from '../lib/types';
import * as act from './actions';
import { library, libraryStore } from './library';
import { togglePin, isPinned } from './pins';
import { player, type PlaybackContextInfo } from './player';
import { ui, type MenuEntry, type MenuItem } from './ui';

const sep = (id: string): MenuEntry => ({ id, separator: true });

/** "add to playlist ▸" with every playlist inline, plus a new one. */
function playlistSubmenu(load: () => Promise<Song[]>): MenuItem {
  return {
    id: 'playlist',
    label: 'add to playlist',
    icon: <PlusIcon />,
    submenu: () => {
      const playlists = libraryStore.get().playlists;
      const entries: MenuEntry[] = [
        {
          id: 'new',
          label: 'new playlist…',
          icon: <PlusIcon />,
          onSelect: () => void load().then((songs) => act.promptNewPlaylist(songs)),
        },
      ];
      if (playlists.length) entries.push(sep('s'));
      for (const playlist of playlists) {
        entries.push({
          id: `pl-${playlist.id}`,
          label: playlist.name,
          icon: <PlaylistIcon />,
          onSelect: () => void load().then((songs) => act.addToPlaylist(playlist, songs)),
        });
      }
      return entries;
    },
  };
}

function ratingSubmenu(song: Song): MenuItem {
  const current = library.rating(song);
  return {
    id: 'rate',
    label: current ? `rating · ${'★'.repeat(current)}` : 'rate',
    icon: <StarIcon />,
    submenu: () => [
      ...[5, 4, 3, 2, 1].map((value) => ({
        id: `r${value}`,
        label: `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`,
        checked: current === value,
        onSelect: () => void act.rateSong(song, value),
      })),
      sep('s'),
      { id: 'r0', label: 'clear rating', disabled: current === 0, onSelect: () => void act.rateSong(song, 0) },
    ],
  };
}

export interface SongMenuOptions {
  /** The list the song is in, so "play" plays from here rather than alone. */
  list?: Song[];
  index?: number;
  context?: PlaybackContextInfo;
  /** Present when the song sits in a playlist it can be removed from. */
  playlist?: { id: string; index: number; onRemove?: () => void };
  /** Present when the song is a queue entry. */
  queueKey?: string;
  /** Lets a list enter multi-select from the menu (touch has no ⌘-click). */
  onSelect?: () => void;
}

export function songMenu(song: Song, opts: SongMenuOptions = {}): MenuEntry[] {
  const starred = library.isStarred('song', song.id);
  const current = player.store.get().current?.id === song.id;
  const entries: MenuEntry[] = [];

  if (!current || opts.queueKey) {
    entries.push({
      id: 'play',
      label: 'play',
      icon: <PlayIcon />,
      onSelect: () => {
        if (opts.queueKey) player.jumpToKey(opts.queueKey);
        else if (opts.list && opts.index !== undefined) act.playSongs(opts.list, opts.index, opts.context);
        else act.playSongs([song], 0, opts.context);
      },
    });
  }
  if (opts.queueKey) {
    entries.push({ id: 'next', label: 'play next', icon: <PlayNextIcon />, onSelect: () => player.moveToNext(opts.queueKey!) });
  } else {
    entries.push(
      { id: 'next', label: 'play next', icon: <PlayNextIcon />, hint: '', onSelect: () => act.playNext([song]) },
      { id: 'later', label: 'add to queue', icon: <AddToQueueIcon />, onSelect: () => act.addToQueue([song]) },
    );
  }
  if (!song.isRadio) {
    entries.push({
      id: 'radio',
      label: 'start station',
      icon: <RadioIcon />,
      onSelect: () => void act.startRadio({ kind: 'song', id: song.id, name: song.title, genre: song.genre, song }),
    });
  }

  if (song.isRadio) {
    if (opts.queueKey) {
      entries.push(sep('s1'), { id: 'dequeue', label: 'remove from queue', icon: <TrashIcon />, onSelect: () => act.removeFromQueue([opts.queueKey!]) });
    }
    return entries;
  }

  entries.push(
    sep('s1'),
    {
      id: 'love',
      label: starred ? 'remove from favourites' : 'add to favourites',
      icon: <HeartIcon filled={starred} />,
      onSelect: () => void act.toggleFavourite('song', song.id),
    },
    ratingSubmenu(song),
    playlistSubmenu(async () => [song]),
  );

  if (opts.playlist) {
    const { id, index, onRemove } = opts.playlist;
    entries.push({
      id: 'unlist',
      label: 'remove from playlist',
      icon: <TrashIcon />,
      danger: true,
      onSelect: () => {
        if (onRemove) onRemove();
        else void library.removeFromPlaylist(id, [index]).then(() => ui.toast('removed from playlist'));
      },
    });
  }
  if (opts.queueKey) {
    entries.push({
      id: 'dequeue',
      label: 'remove from queue',
      icon: <TrashIcon />,
      danger: true,
      onSelect: () => act.removeFromQueue([opts.queueKey!]),
    });
  }

  entries.push(sep('s2'));
  if (song.albumId) entries.push({ id: 'album', label: 'go to album', icon: <AlbumIcon />, onSelect: () => act.goToAlbum(song) });
  if (song.artistId) entries.push({ id: 'artist', label: 'go to artist', icon: <ArtistIcon />, onSelect: () => act.goToArtist(song) });

  entries.push(sep('s3'));
  if (downloadsSupported()) {
    const offline = isDownloaded(song.id);
    entries.push({
      id: 'offline',
      label: offline ? 'remove download' : 'download',
      icon: offline ? <CheckIcon /> : <DownloadIcon />,
      onSelect: () => (offline ? void act.removeDownloadsFor([song]) : act.download([song])),
    });
  }
  entries.push(
    { id: 'save', label: 'save original file', icon: <ExportIcon />, onSelect: () => act.saveOriginal(song) },
    { id: 'copy', label: 'copy title & artist', icon: <CopyIcon />, onSelect: () => void act.copySongInfo(song) },
  );
  if (opts.onSelect) entries.push({ id: 'select', label: 'select', icon: <SelectIcon />, onSelect: opts.onSelect });
  entries.push({ id: 'info', label: 'get info', icon: <InfoIcon />, hint: 'I', onSelect: () => act.showInfo(song) });
  return entries;
}

export function albumMenu(album: Album): MenuEntry[] {
  const starred = library.isStarred('album', album.id);
  const pinned = isPinned('album', album.id);
  const load = () => loadAlbumSongs(album.id);
  const entries: MenuEntry[] = [
    { id: 'play', label: 'play', icon: <PlayIcon />, onSelect: () => void act.playAlbum(album) },
    { id: 'shuffle', label: 'shuffle', icon: <ShuffleIcon />, onSelect: () => void act.playAlbum(album, { shuffle: true }) },
    { id: 'next', label: 'play next', icon: <PlayNextIcon />, onSelect: () => void act.queueAlbum(album, 'next') },
    { id: 'later', label: 'add to queue', icon: <AddToQueueIcon />, onSelect: () => void act.queueAlbum(album, 'last') },
    {
      id: 'radio',
      label: 'start station',
      icon: <RadioIcon />,
      onSelect: () => void act.startRadio({ kind: 'album', id: album.id, name: album.name, genre: album.genre }),
    },
    sep('s1'),
    {
      id: 'love',
      label: starred ? 'remove from favourites' : 'add to favourites',
      icon: <HeartIcon filled={starred} />,
      onSelect: () => void act.toggleFavourite('album', album.id),
    },
    playlistSubmenu(load),
  ];
  if (downloadsSupported()) {
    entries.push({ id: 'download', label: 'download album', icon: <DownloadIcon />, onSelect: () => void act.downloadAlbum(album) });
  }
  entries.push(sep('s2'));
  if (album.artistId) {
    entries.push({ id: 'artist', label: 'go to artist', icon: <ArtistIcon />, onSelect: () => act.goToArtist(album) });
  }
  entries.push(
    {
      id: 'pin',
      label: pinned ? 'unpin' : 'pin to sidebar',
      icon: <PinIcon />,
      onSelect: () => {
        const on = togglePin({ type: 'album', id: album.id, name: album.name, coverArt: album.coverArt });
        ui.toast(on ? `pinned ${album.name}` : `unpinned ${album.name}`);
      },
    },
    { id: 'link', label: 'copy link', icon: <LinkIcon />, onSelect: () => void act.copyLink(`/album/${encodeURIComponent(album.id)}`) },
  );
  return entries;
}

export function artistMenu(artist: Artist): MenuEntry[] {
  const starred = library.isStarred('artist', artist.id);
  const pinned = isPinned('artist', artist.id);
  return [
    { id: 'play', label: 'play all', icon: <PlayIcon />, onSelect: () => void act.playArtist(artist) },
    { id: 'shuffle', label: 'shuffle', icon: <ShuffleIcon />, onSelect: () => void act.playArtist(artist, { shuffle: true }) },
    {
      id: 'radio',
      label: 'start station',
      icon: <RadioIcon />,
      onSelect: () => void act.startRadio({ kind: 'artist', id: artist.id, name: artist.name }),
    },
    { id: 'next', label: 'play next', icon: <PlayNextIcon />, onSelect: () => void act.queueArtist(artist, 'next') },
    { id: 'later', label: 'add to queue', icon: <AddToQueueIcon />, onSelect: () => void act.queueArtist(artist, 'last') },
    sep('s1'),
    {
      id: 'love',
      label: starred ? 'remove from favourites' : 'add to favourites',
      icon: <HeartIcon filled={starred} />,
      onSelect: () => void act.toggleFavourite('artist', artist.id),
    },
    playlistSubmenu(() => loadArtistSongs(artist.id)),
    sep('s2'),
    { id: 'open', label: 'go to artist', icon: <ArtistIcon />, onSelect: () => act.goToArtist(artist, true) },
    {
      id: 'pin',
      label: pinned ? 'unpin' : 'pin to sidebar',
      icon: <PinIcon />,
      onSelect: () => {
        const on = togglePin({ type: 'artist', id: artist.id, name: artist.name, coverArt: artistCover(artist) });
        ui.toast(on ? `pinned ${artist.name}` : `unpinned ${artist.name}`);
      },
    },
    { id: 'link', label: 'copy link', icon: <LinkIcon />, onSelect: () => void act.copyLink(`/artist/${encodeURIComponent(artist.id)}`) },
  ];
}

export function playlistMenu(playlist: Playlist): MenuEntry[] {
  const pinned = isPinned('playlist', playlist.id);
  const entries: MenuEntry[] = [
    { id: 'play', label: 'play', icon: <PlayIcon />, onSelect: () => void act.playPlaylist(playlist) },
    { id: 'shuffle', label: 'shuffle', icon: <ShuffleIcon />, onSelect: () => void act.playPlaylist(playlist, { shuffle: true }) },
    { id: 'next', label: 'play next', icon: <PlayNextIcon />, onSelect: () => void act.queuePlaylist(playlist, 'next') },
    { id: 'later', label: 'add to queue', icon: <AddToQueueIcon />, onSelect: () => void act.queuePlaylist(playlist, 'last') },
    sep('s1'),
    { id: 'rename', label: 'rename…', icon: <PencilIcon />, onSelect: () => act.renamePlaylist(playlist) },
    { id: 'describe', label: 'edit description…', icon: <PencilIcon />, onSelect: () => act.editPlaylistDescription(playlist) },
    {
      id: 'public',
      label: playlist.public ? 'make private' : 'make public',
      icon: <GlobeIcon />,
      onSelect: () => void act.togglePlaylistPublic(playlist),
    },
    {
      id: 'sort',
      label: 'sort',
      icon: <SortIcon />,
      submenu: () =>
        (
          [
            ['title', 'by title'],
            ['artist', 'by artist'],
            ['album', 'by album'],
            ['year', 'by year'],
            ['duration', 'by length'],
            ['reverse', 'reverse order'],
            ['shuffle', 'shuffle order'],
          ] as [act.PlaylistSort, string][]
        ).map(([by, label]) => ({ id: by, label, onSelect: () => void act.sortPlaylist(playlist, by) })),
    },
    { id: 'dedupe', label: 'remove duplicates', icon: <RefreshIcon />, onSelect: () => void act.removeDuplicates(playlist) },
    { id: 'duplicate', label: 'duplicate', icon: <CopyIcon />, onSelect: () => void act.duplicatePlaylist(playlist) },
    { id: 'export', label: 'export as m3u', icon: <ExportIcon />, onSelect: () => void act.exportPlaylist(playlist) },
  ];
  if (downloadsSupported()) {
    entries.push({ id: 'download', label: 'download', icon: <DownloadIcon />, onSelect: () => void act.downloadPlaylist(playlist) });
  }
  entries.push(
    sep('s2'),
    {
      id: 'pin',
      label: pinned ? 'unpin' : 'pin to sidebar',
      icon: <PinIcon />,
      onSelect: () => {
        const on = togglePin({ type: 'playlist', id: playlist.id, name: playlist.name, coverArt: playlist.coverArt });
        ui.toast(on ? `pinned ${playlist.name}` : `unpinned ${playlist.name}`);
      },
    },
    { id: 'link', label: 'copy link', icon: <LinkIcon />, onSelect: () => void act.copyLink(`/playlist/${encodeURIComponent(playlist.id)}`) },
    sep('s3'),
    { id: 'delete', label: 'delete playlist…', icon: <TrashIcon />, danger: true, onSelect: () => act.deletePlaylist(playlist) },
  );
  return entries;
}

/** A batch of selected songs. */
export function selectionMenu(songs: Song[], opts: { onRemove?: () => void } = {}): MenuEntry[] {
  const allStarred = songs.every((s) => library.isStarred('song', s.id));
  const entries: MenuEntry[] = [
    { id: 'play', label: 'play', icon: <PlayIcon />, onSelect: () => act.playSongs(songs, 0) },
    { id: 'shuffle', label: 'shuffle', icon: <ShuffleIcon />, onSelect: () => act.playSongs(songs, 0, undefined, { shuffle: true }) },
    { id: 'next', label: 'play next', icon: <PlayNextIcon />, onSelect: () => act.playNext(songs) },
    { id: 'later', label: 'add to queue', icon: <AddToQueueIcon />, onSelect: () => act.addToQueue(songs) },
    sep('s1'),
    {
      id: 'love',
      label: allStarred ? 'remove from favourites' : 'add to favourites',
      icon: <HeartIcon filled={allStarred} />,
      onSelect: () => void act.setFavourites('song', songs.map((s) => s.id), !allStarred),
    },
    playlistSubmenu(async () => songs),
  ];
  if (downloadsSupported()) entries.push({ id: 'download', label: 'download', icon: <DownloadIcon />, onSelect: () => act.download(songs) });
  if (opts.onRemove) entries.push(sep('s2'), { id: 'remove', label: 'remove', icon: <TrashIcon />, danger: true, onSelect: opts.onRemove });
  return entries;
}

export function songHeader(song: Song) {
  return { title: song.title, subtitle: songArtist(song), coverArt: song.coverArt };
}

export function albumHeader(album: Album) {
  return { title: album.name, subtitle: albumArtist(album), coverArt: album.coverArt };
}

export function artistHeader(artist: Artist) {
  return { title: artist.name, subtitle: 'artist', coverArt: artistCover(artist), round: true };
}

export function playlistHeader(playlist: Playlist) {
  return { title: playlist.name, subtitle: `${playlist.songCount ?? 0} songs`, coverArt: playlist.coverArt };
}

export { ui };
export { loadPlaylistSongs };
