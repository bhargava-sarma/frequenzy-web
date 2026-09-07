/** One playlist, with drag-free removal handled through the row menu. */

import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Artwork } from '../components/Artwork';
import { DownloadButton } from '../components/DownloadButton';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { useContextMenu } from '../components/ContextMenu';
import { EllipsisIcon, PlayIcon, ShuffleIcon } from '../components/Icons';
import { formatCount, formatDurationLong } from '../lib/format';
import { getPlaylist, updatePlaylist } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import type { Song } from '../lib/types';
import { usePlayer } from '../state/player';
import { useMediaMenu } from '../hooks/useMediaMenu';

export function PlaylistDetail() {
  const { id = '' } = useParams();
  const playlistId = decodeURIComponent(id);
  const { actions } = usePlayer();
  const { renamePlaylist, deletePlaylist, removeFromPlaylist, reloadPlaylists, playlists } = useLibrary();
  const { prompt } = useDialogs();
  const { playlistMenu } = useMediaMenu();
  const { openAt, menu } = useContextMenu();

  // Re-fetch when the playlist list changes, so edits show up straight away.
  const version = playlists.find((p) => p.id === playlistId)?.changed ?? '';
  const playlist = useAsync((signal) => getPlaylist(playlistId, signal), [playlistId, version]);

  // Reordering is optimistic: the server call replaces the whole track list, so
  // the UI must not wait for a round trip to look right.
  const [localOrder, setLocalOrder] = useState<Song[] | undefined>(undefined);
  const songs = localOrder ?? playlist.data?.entry ?? [];
  const context = { kind: 'Playlist', name: playlist.data?.name ?? '', id: playlistId };

  /**
   * Subsonic has no "move track" call, so a reorder is a rewrite: clear the
   * playlist and add the songs back in their new order.
   */
  const handleReorder = useCallback(
    async (from: number, to: number) => {
      const next = [...songs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setLocalOrder(next);
      try {
        await updatePlaylist(playlistId, {
          songIndexToRemove: songs.map((_, i) => i),
        });
        await updatePlaylist(playlistId, { songIdToAdd: next.map((song) => song.id) });
        reloadPlaylists();
      } catch {
        setLocalOrder(undefined); // put the server's order back
      }
    },
    [playlistId, reloadPlaylists, songs],
  );

  const handleRemove = useCallback(
    async (removeIndex: number) => {
      setLocalOrder(songs.filter((_, i) => i !== removeIndex));
      await removeFromPlaylist(playlistId, [removeIndex]).catch(() => setLocalOrder(undefined));
    },
    [playlistId, removeFromPlaylist, songs],
  );

  if (!playlist.loading && !playlist.data) {
    return (
      <Page title="Playlist">
        <div className="fz-empty"><div className="fz-empty__title">Playlist not found</div></div>
      </Page>
    );
  }

  const name = playlist.data?.name ?? 'Playlist';

  return (
    <Page title={name} showTitle={false}>
      <div className="fz-detail-head">
        <Artwork coverArt={playlist.data?.coverArt} name={name} size={600} className="fz-detail-head__art" />
        <div className="fz-detail-head__info">
          <h1 className="fz-detail-head__title">{name}</h1>
          <button
            type="button"
            style={{
              fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 520,
              textAlign: 'inherit',
            }}
            onClick={() =>
              prompt({
                title: 'Playlist Description',
                label: 'Description',
                initialValue: playlist.data?.comment ?? '',
                confirmLabel: 'Save',
                onConfirm: (value) =>
                  void updatePlaylist(playlistId, { comment: value }).then(() => {
                    reloadPlaylists();
                    playlist.reload();
                  }),
              })
            }
          >
            {playlist.data?.comment || 'Add a description…'}
          </button>
          <div className="fz-detail-head__meta">
            {[formatCount(playlist.data?.songCount ?? songs.length, 'song'), formatDurationLong(playlist.data?.duration)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="fz-detail-head__actions">
            <button
              type="button"
              className="fz-btn fz-btn--solid"
              disabled={songs.length === 0}
              onClick={() => actions.playQueue(songs, 0, context)}
            >
              <PlayIcon /> Play
            </button>
            <button
              type="button"
              className="fz-btn"
              disabled={songs.length === 0}
              onClick={() => actions.playQueue([...songs].sort(() => Math.random() - 0.5), 0, context)}
            >
              <ShuffleIcon /> Shuffle
            </button>
            <DownloadButton songs={songs} />
            <button
              type="button"
              className="fz-icon-btn"
              aria-label="More options"
              onClick={(event) =>
                openAt(
                  event.currentTarget,
                  playlistMenu({ id: playlistId, name }, songs, {
                    onRename: () =>
                      prompt({
                        title: 'Rename Playlist',
                        label: 'Name',
                        initialValue: name,
                        confirmLabel: 'Rename',
                        onConfirm: (value) => void renamePlaylist(playlistId, value).then(playlist.reload),
                      }),
                    onDelete: () => void deletePlaylist(playlistId),
                  }),
                )
              }
            >
              <EllipsisIcon />
            </button>
          </div>
        </div>
      </div>

      <TrackList
        songs={songs}
        context={context}
        playlist={{ id: playlistId }}
        onReorder={(from, to) => void handleReorder(from, to)}
        onRemove={(removeIndex) => void handleRemove(removeIndex)}
        emptyMessage="This playlist is empty — add songs from anywhere with the ⋯ menu."
      />
      {menu}
    </Page>
  );
}
