/**
 * Builds the standard context menu for a song, album, artist or playlist, so
 * right-clicking anything in Frequenzy offers the same verbs in the same order.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import type { MenuEntry } from '../components/ContextMenu';
import {
  AlbumIcon, ArtistIcon, CheckIcon, DownloadIcon, HeartIcon, InfoIcon, NextIcon,
  PlaylistIcon, PlusIcon, QueueIcon, ShareIcon, TrashIcon,
} from '../components/Icons';
import { downloadSong, isDownloaded, isSupported as downloadsSupported, removeDownload } from '../lib/downloads';
import { downloadUrl } from '../lib/subsonic';
import type { Album, Artist, Song } from '../lib/types';
import { useLibrary } from '../state/library';
import { usePlayer, type PlaybackContextInfo } from '../state/player';

export interface SongMenuOptions {
  /** Present when the song sits inside a playlist we can remove it from. */
  playlist?: { id: string; index: number };
  onRequestAddToPlaylist: (songs: Song[]) => void;
  onShowInfo?: (song: Song) => void;
  context?: PlaybackContextInfo;
}

export function useMediaMenu() {
  const navigate = useNavigate();
  const { actions } = usePlayer();
  const { isStarred, toggleStar, removeFromPlaylist } = useLibrary();

  const songMenu = useCallback(
    (song: Song, options: SongMenuOptions): MenuEntry[] => {
      const starred = isStarred('song', song.id);
      const entries: MenuEntry[] = [
        {
          id: 'play',
          label: 'Play',
          icon: <NextIcon />,
          onSelect: () => actions.playSong(song, options.context),
        },
        {
          id: 'next',
          label: 'Play Next',
          icon: <QueueIcon />,
          onSelect: () => actions.playNext([song]),
        },
        {
          id: 'later',
          label: 'Play Last',
          icon: <QueueIcon />,
          onSelect: () => actions.playLater([song]),
        },
        { id: 's1', separator: true },
        {
          id: 'love',
          label: starred ? 'Remove from Favourites' : 'Add to Favourites',
          icon: <HeartIcon filled={starred} />,
          onSelect: () => void toggleStar('song', song.id),
        },
        {
          id: 'playlist',
          label: 'Add to Playlist…',
          icon: <PlusIcon />,
          onSelect: () => options.onRequestAddToPlaylist([song]),
        },
      ];

      if (options.playlist) {
        entries.push({
          id: 'remove',
          label: 'Remove from Playlist',
          icon: <TrashIcon />,
          danger: true,
          onSelect: () => void removeFromPlaylist(options.playlist!.id, [options.playlist!.index]),
        });
      }

      entries.push({ id: 's2', separator: true });

      if (song.albumId) {
        entries.push({
          id: 'album',
          label: 'Go to Album',
          icon: <AlbumIcon />,
          onSelect: () => navigate(`/album/${encodeURIComponent(song.albumId!)}`),
        });
      }
      if (song.artistId) {
        entries.push({
          id: 'artist',
          label: 'Go to Artist',
          icon: <ArtistIcon />,
          onSelect: () => navigate(`/artist/${encodeURIComponent(song.artistId!)}`),
        });
      }

      entries.push({ id: 's3', separator: true });

      if (downloadsSupported()) {
        const offline = isDownloaded(song.id);
        entries.push({
          id: 'offline',
          label: offline ? 'Remove Download' : 'Make Available Offline',
          icon: offline ? <CheckIcon /> : <DownloadIcon />,
          onSelect: () => void (offline ? removeDownload(song.id) : downloadSong(song)),
        });
      }

      entries.push({
        id: 'download',
        label: 'Save Original File…',
        icon: <DownloadIcon />,
        onSelect: () => window.open(downloadUrl(song.id), '_blank'),
      });

      if (options.onShowInfo) {
        entries.push({
          id: 'info',
          label: 'Get Info',
          icon: <InfoIcon />,
          onSelect: () => options.onShowInfo!(song),
        });
      }

      return entries;
    },
    [actions, isStarred, navigate, removeFromPlaylist, toggleStar],
  );

  const albumMenu = useCallback(
    (album: Album, songs: Song[], onRequestAddToPlaylist: (songs: Song[]) => void): MenuEntry[] => {
      const starred = isStarred('album', album.id);
      const context: PlaybackContextInfo = { kind: 'Album', name: album.name, id: album.id };
      const entries: MenuEntry[] = [
        {
          id: 'play',
          label: 'Play',
          icon: <NextIcon />,
          onSelect: () => actions.playQueue(songs, 0, context),
          disabled: songs.length === 0,
        },
        {
          id: 'next',
          label: 'Play Next',
          icon: <QueueIcon />,
          onSelect: () => actions.playNext(songs),
          disabled: songs.length === 0,
        },
        {
          id: 'later',
          label: 'Play Last',
          icon: <QueueIcon />,
          onSelect: () => actions.playLater(songs),
          disabled: songs.length === 0,
        },
        { id: 's1', separator: true },
        {
          id: 'love',
          label: starred ? 'Remove from Favourites' : 'Add to Favourites',
          icon: <HeartIcon filled={starred} />,
          onSelect: () => void toggleStar('album', album.id),
        },
        {
          id: 'playlist',
          label: 'Add to Playlist…',
          icon: <PlusIcon />,
          onSelect: () => onRequestAddToPlaylist(songs),
          disabled: songs.length === 0,
        },
      ];

      if (album.artistId) {
        entries.push(
          { id: 's2', separator: true },
          {
            id: 'artist',
            label: 'Go to Artist',
            icon: <ArtistIcon />,
            onSelect: () => navigate(`/artist/${encodeURIComponent(album.artistId!)}`),
          },
        );
      }
      return entries;
    },
    [actions, isStarred, navigate, toggleStar],
  );

  const artistMenu = useCallback(
    (artist: Artist): MenuEntry[] => {
      const starred = isStarred('artist', artist.id);
      return [
        {
          id: 'open',
          label: 'Go to Artist',
          icon: <ArtistIcon />,
          onSelect: () => navigate(`/artist/${encodeURIComponent(artist.id)}`),
        },
        { id: 's1', separator: true },
        {
          id: 'love',
          label: starred ? 'Remove from Favourites' : 'Add to Favourites',
          icon: <HeartIcon filled={starred} />,
          onSelect: () => void toggleStar('artist', artist.id),
        },
      ];
    },
    [isStarred, navigate, toggleStar],
  );

  const playlistMenu = useCallback(
    (
      playlist: { id: string; name: string },
      songs: Song[],
      handlers: { onRename: () => void; onDelete: () => void },
    ): MenuEntry[] => {
      const context: PlaybackContextInfo = { kind: 'Playlist', name: playlist.name, id: playlist.id };
      return [
        {
          id: 'play',
          label: 'Play',
          icon: <NextIcon />,
          onSelect: () => actions.playQueue(songs, 0, context),
          disabled: songs.length === 0,
        },
        {
          id: 'next',
          label: 'Play Next',
          icon: <QueueIcon />,
          onSelect: () => actions.playNext(songs),
          disabled: songs.length === 0,
        },
        {
          id: 'later',
          label: 'Play Last',
          icon: <QueueIcon />,
          onSelect: () => actions.playLater(songs),
          disabled: songs.length === 0,
        },
        { id: 's1', separator: true },
        { id: 'rename', label: 'Rename…', icon: <PlaylistIcon />, onSelect: handlers.onRename },
        { id: 'delete', label: 'Delete Playlist', icon: <TrashIcon />, danger: true, onSelect: handlers.onDelete },
      ];
    },
    [actions],
  );

  return { songMenu, albumMenu, artistMenu, playlistMenu };
}
