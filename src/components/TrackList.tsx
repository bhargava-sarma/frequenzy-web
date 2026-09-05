/**
 * The song row, used by every list in the app.
 *
 * Rows show an index that turns into a play button on hover, an inline heart,
 * and an ellipsis for the full menu — plus the animated equaliser on whichever
 * track is currently playing.
 */

import { useCallback, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { useContextMenu } from './ContextMenu';
import { EllipsisIcon, HeartIcon, PlayIcon } from './Icons';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import type { Song } from '../lib/types';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer, type PlaybackContextInfo } from '../state/player';
import { useMediaMenu } from '../hooks/useMediaMenu';

interface TrackListProps {
  songs: Song[];
  context?: PlaybackContextInfo;
  /** Album views number tracks; playlists and search show artwork instead. */
  variant?: 'numbered' | 'artwork';
  showAlbum?: boolean;
  playlist?: { id: string };
  emptyMessage?: string;
}

export function TrackList({
  songs,
  context,
  variant = 'artwork',
  showAlbum = true,
  playlist,
  emptyMessage,
}: TrackListProps) {
  const { current, playing, actions } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist, showTrackInfo } = useDialogs();
  const { songMenu } = useMediaMenu();
  const { open, openAt, menu } = useContextMenu();
  const navigate = useNavigate();

  const columns =
    variant === 'numbered'
      ? showAlbum
        ? '28px 1fr minmax(0, 0.6fr) 54px 62px'
        : '28px 1fr 54px 62px'
      : showAlbum
        ? '1fr minmax(0, 0.6fr) 54px 62px'
        : '1fr 54px 62px';

  const buildMenu = useCallback(
    (song: Song, index: number) =>
      songMenu(song, {
        playlist: playlist ? { id: playlist.id, index } : undefined,
        onRequestAddToPlaylist: addToPlaylist,
        onShowInfo: showTrackInfo,
        context,
      }),
    [addToPlaylist, context, playlist, showTrackInfo, songMenu],
  );

  if (songs.length === 0) {
    return <div className="fz-empty"><div className="fz-empty__title">{emptyMessage ?? 'Nothing here yet'}</div></div>;
  }

  return (
    <div className="fz-tracks">
      {songs.map((song, index) => {
        const isCurrent = current?.id === song.id;
        const starred = isStarred('song', song.id);
        const badge = qualityBadge(song);

        return (
          <div
            key={`${song.id}-${index}`}
            className={`fz-track ${isCurrent ? 'is-current' : ''}`}
            style={{ ['--track-cols' as string]: columns }}
            onDoubleClick={() => actions.playQueue(songs, index, context)}
            onContextMenu={(event) => open(event, buildMenu(song, index))}
          >
            {variant === 'numbered' && (
              <div className="fz-track__index">
                {isCurrent && playing ? (
                  <span className={`fz-eq ${playing ? '' : 'is-paused'}`}><span /><span /><span /></span>
                ) : (
                  <>
                    <span className="fz-track__index-number">{song.track ?? index + 1}</span>
                    <button
                      type="button"
                      className="fz-track__index-play"
                      aria-label={`Play ${song.title}`}
                      onClick={() => actions.playQueue(songs, index, context)}
                    >
                      <PlayIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="fz-track__main">
              {variant === 'artwork' && (
                <Artwork coverArt={song.coverArt} name={song.title} size={80} className="fz-track__art">
                  <button
                    type="button"
                    className="fz-play-overlay"
                    style={{ inset: 0, width: '100%', height: '100%', borderRadius: 'inherit', border: 'none' }}
                    aria-label={`Play ${song.title}`}
                    onClick={() => actions.playQueue(songs, index, context)}
                  >
                    {isCurrent && playing ? (
                      <span className="fz-eq"><span /><span /><span /></span>
                    ) : (
                      <PlayIcon />
                    )}
                  </button>
                </Artwork>
              )}
              <div className="fz-track__text">
                <span className="fz-track__title fz-truncate">{song.title}</span>
                <span className="fz-track__sub fz-truncate">
                  {songArtist(song)}
                  {badge?.lossless && (
                    <span className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : 'fz-badge--lossless'}`} style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                      {badge.hiRes ? 'Hi-Res' : 'Lossless'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {showAlbum && (
              <button
                type="button"
                className="fz-track__meta fz-truncate"
                style={{ textAlign: 'left' }}
                onClick={() => song.albumId && navigate(`/album/${encodeURIComponent(song.albumId)}`)}
              >
                {song.album}
              </button>
            )}

            <div className="fz-track__meta">{formatTime(song.duration)}</div>

            <div className="fz-track__actions">
              <button
                type="button"
                className={`fz-icon-btn fz-track__star ${starred ? 'is-on' : ''}`}
                aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
                aria-pressed={starred}
                onClick={() => void toggleStar('song', song.id)}
              >
                <HeartIcon filled={starred} />
              </button>
              <button
                type="button"
                className="fz-icon-btn"
                aria-label="More options"
                onClick={(event: MouseEvent<HTMLButtonElement>) => openAt(event.currentTarget, buildMenu(song, index))}
              >
                <EllipsisIcon />
              </button>
            </div>
          </div>
        );
      })}
      {menu}
    </div>
  );
}
