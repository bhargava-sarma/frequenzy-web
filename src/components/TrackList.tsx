/**
 * The song row, used by every list in the app.
 *
 * It adapts to the device rather than pretending they are the same: on desktop
 * rows reveal actions on hover and support click/shift/cmd selection with a
 * batch toolbar; on touch they are swiped sideways for Play Next and Favourite,
 * and long-pressed for the full menu.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { useContextMenu } from './ContextMenu';
import {
  CheckIcon, CloseIcon, EllipsisIcon, GripIcon, HeartIcon, PlayIcon, PlusIcon,
  QueueIcon, TrashIcon,
} from './Icons';
import { SwipeableRow, type SwipeAction } from './SwipeableRow';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import type { Song } from '../lib/types';
import { useDragReorder, useLongPress } from '../hooks/useGestures';
import { useIsCompact, useIsTouch } from '../hooks/useLayout';
import { useMediaMenu } from '../hooks/useMediaMenu';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer, type PlaybackContextInfo } from '../state/player';

interface TrackListProps {
  songs: Song[];
  context?: PlaybackContextInfo;
  /** Album views number tracks; playlists and search show artwork instead. */
  variant?: 'numbered' | 'artwork';
  showAlbum?: boolean;
  playlist?: { id: string };
  emptyMessage?: string;
  /** Enables the drag grips that reorder a playlist. */
  onReorder?: (from: number, to: number) => void;
  /** Playlists offer a "remove from this playlist" swipe; other lists do not. */
  onRemove?: (index: number) => void;
}

export function TrackList({
  songs,
  context,
  variant = 'artwork',
  showAlbum = true,
  playlist,
  emptyMessage,
  onReorder,
  onRemove,
}: TrackListProps) {
  const { current, playing, actions } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist, showTrackInfo } = useDialogs();
  const { songMenu } = useMediaMenu();
  const { open, openAt, openAtPoint, menu } = useContextMenu();
  const navigate = useNavigate();
  const compact = useIsCompact();
  const touch = useIsTouch();

  const [selection, setSelection] = useState<Set<number>>(() => new Set());
  const [openSwipe, setOpenSwipe] = useState<{ index: number; side: 'left' | 'right' } | null>(null);
  const anchor = useRef<number | null>(null);

  const reorder = useDragReorder({ onReorder: onReorder ?? (() => {}), disabled: !onReorder });

  // Selection is scoped to the list as rendered; a new list means a fresh start.
  useEffect(() => {
    setSelection(new Set());
    anchor.current = null;
  }, [songs]);

  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(new Set());
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(new Set(songs.map((_, i) => i)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection.size, songs]);

  const selectedSongs = useMemo(
    () => [...selection].sort((a, b) => a - b).map((i) => songs[i]).filter(Boolean),
    [selection, songs],
  );

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

  const handleRowClick = (event: MouseEvent, index: number) => {
    if (compact) {
      actions.playQueue(songs, index, context);
      return;
    }
    if (event.shiftKey && anchor.current !== null) {
      const [from, to] = [anchor.current, index].sort((a, b) => a - b);
      const next = new Set(selection);
      for (let i = from; i <= to; i++) next.add(i);
      setSelection(next);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selection);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setSelection(next);
      anchor.current = index;
      return;
    }
    setSelection(new Set([index]));
    anchor.current = index;
  };

  if (songs.length === 0) {
    return (
      <div className="fz-empty">
        <div className="fz-empty__title">{emptyMessage ?? 'Nothing here yet'}</div>
      </div>
    );
  }

  const columns =
    variant === 'numbered'
      ? showAlbum
        ? '28px 1fr minmax(0, 0.6fr) 54px 62px'
        : '28px 1fr 54px 62px'
      : showAlbum
        ? '1fr minmax(0, 0.6fr) 54px 62px'
        : '1fr 54px 62px';

  const compactColumns = variant === 'numbered' ? '28px 1fr auto' : '1fr auto';

  return (
    <>
      <div className="fz-tracks" ref={(el) => (reorder.containerRef.current = el)}>
        {songs.map((song, index) => {
          const isCurrent = current?.id === song.id;
          const starred = isStarred('song', song.id);
          const badge = qualityBadge(song);
          const selected = selection.has(index);
          const beingDragged = reorder.state?.from === index;
          const dropTarget = reorder.state?.to === index && reorder.state.from !== index;

          const row = (
            <TrackRow
              song={song}
              index={index}
              songs={songs}
              context={context}
              variant={variant}
              showAlbum={showAlbum}
              compact={compact}
              columns={compact ? compactColumns : columns}
              isCurrent={isCurrent}
              playing={playing}
              starred={starred}
              badge={badge}
              selected={selected}
              beingDragged={Boolean(beingDragged)}
              dropTarget={Boolean(dropTarget)}
              reorderHandle={onReorder ? reorder.handleProps(index) : undefined}
              onClick={(event) => handleRowClick(event, index)}
              onDoubleClick={() => actions.playQueue(songs, index, context)}
              onContextMenu={(event) => open(event, buildMenu(song, index))}
              onLongPress={(point) =>
                openAtPoint(point, buildMenu(song, index), {
                  title: song.title,
                  subtitle: songArtist(song),
                  artwork: (
                    <Artwork coverArt={song.coverArt} name={song.title} size={120} className="fz-actionsheet__art" />
                  ),
                })
              }
              onEllipsis={(element) => openAt(element, buildMenu(song, index))}
              onToggleStar={() => void toggleStar('song', song.id)}
              onAlbum={() => song.albumId && navigate(`/album/${encodeURIComponent(song.albumId)}`)}
            />
          );

          if (!touch) {
            return <div key={`${song.id}-${index}`}>{row}</div>;
          }

          const leftActions: SwipeAction[] = [
            {
              id: 'next',
              label: 'Play Next',
              tone: 'next',
              icon: <QueueIcon />,
              onSelect: () => actions.playNext([song]),
            },
            {
              id: 'last',
              label: 'Play Last',
              tone: 'last',
              icon: <PlusIcon />,
              onSelect: () => actions.playLater([song]),
            },
          ];
          if (onRemove) {
            leftActions.push({
              id: 'remove',
              label: 'Remove',
              tone: 'remove',
              icon: <TrashIcon />,
              onSelect: () => onRemove(index),
            });
          }

          const rightActions: SwipeAction[] = [
            {
              id: 'love',
              label: starred ? 'Unfavourite' : 'Favourite',
              tone: 'love',
              icon: <HeartIcon filled={starred} />,
              onSelect: () => void toggleStar('song', song.id),
            },
            {
              id: 'playlist',
              label: 'Playlist',
              tone: 'playlist',
              icon: <PlusIcon />,
              onSelect: () => addToPlaylist([song]),
            },
          ];

          return (
            <SwipeableRow
              key={`${song.id}-${index}`}
              leftActions={leftActions}
              rightActions={rightActions}
              open={openSwipe?.index === index ? openSwipe.side : null}
              onOpenChange={(next) => setOpenSwipe(next ? { index, side: next } : null)}
            >
              {row}
            </SwipeableRow>
          );
        })}
      </div>

      {selectedSongs.length > 0 && (
        <SelectionBar
          songs={selectedSongs}
          indices={[...selection].sort((a, b) => a - b)}
          onClear={() => setSelection(new Set())}
          onRemove={onRemove}
          context={context}
        />
      )}

      {menu}
    </>
  );
}

/* ------------------------------------------------------------------- one row */

interface TrackRowProps {
  song: Song;
  index: number;
  songs: Song[];
  context?: PlaybackContextInfo;
  variant: 'numbered' | 'artwork';
  showAlbum: boolean;
  compact: boolean;
  columns: string;
  isCurrent: boolean;
  playing: boolean;
  starred: boolean;
  badge: ReturnType<typeof qualityBadge>;
  selected: boolean;
  beingDragged: boolean;
  dropTarget: boolean;
  reorderHandle?: Record<string, unknown>;
  onClick: (event: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onLongPress: (point: { x: number; y: number }) => void;
  onEllipsis: (element: HTMLElement) => void;
  onToggleStar: () => void;
  onAlbum: () => void;
}

function TrackRow(props: TrackRowProps) {
  const {
    song, index, songs, context, variant, showAlbum, compact, columns, isCurrent,
    playing, starred, badge, selected, beingDragged, dropTarget, reorderHandle,
    onClick, onDoubleClick, onContextMenu, onLongPress, onEllipsis, onToggleStar, onAlbum,
  } = props;

  const { actions } = usePlayer();
  const longPress = useLongPress({ onLongPress });

  return (
    <div
      data-reorder-item=""
      className={`fz-track ${isCurrent ? 'is-current' : ''} ${selected ? 'is-selected' : ''} ${
        beingDragged ? 'is-lifted' : ''
      } ${dropTarget ? 'is-drop-target' : ''}`}
      style={{ ['--track-cols' as string]: columns }}
      onClick={(event) => {
        if (longPress.didFire()) return;
        onClick(event);
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...longPress.handlers}
    >
      {variant === 'numbered' && (
        <div className="fz-track__index">
          {isCurrent ? (
            <span className={`fz-eq ${playing ? '' : 'is-paused'}`}><span /><span /><span /></span>
          ) : (
            <>
              <span className="fz-track__index-number">{song.track ?? index + 1}</span>
              <button
                type="button"
                className="fz-track__index-play"
                aria-label={`Play ${song.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.playQueue(songs, index, context);
                }}
              >
                <PlayIcon style={{ width: 12, height: 12 }} />
              </button>
            </>
          )}
        </div>
      )}

      <div className="fz-track__main">
        {variant === 'artwork' && (
          <Artwork coverArt={song.coverArt} name={song.title} size={120} className="fz-track__art">
            {!compact && (
              <button
                type="button"
                className="fz-play-overlay"
                style={{ inset: 0, width: '100%', height: '100%', borderRadius: 'inherit', border: 'none' }}
                aria-label={`Play ${song.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.playQueue(songs, index, context);
                }}
              >
                {isCurrent && playing ? <span className="fz-eq"><span /><span /><span /></span> : <PlayIcon />}
              </button>
            )}
          </Artwork>
        )}
        <div className="fz-track__text">
          <span className="fz-track__title fz-truncate">{song.title}</span>
          <span className="fz-track__sub fz-truncate">
            {songArtist(song)}
            {compact && song.album ? ` — ${song.album}` : ''}
            {badge?.lossless && !compact && (
              <span
                className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : 'fz-badge--lossless'}`}
                style={{ marginLeft: 6, verticalAlign: 'middle' }}
              >
                {badge.hiRes ? 'Hi-Res' : 'Lossless'}
              </span>
            )}
          </span>
        </div>
      </div>

      {!compact && showAlbum && (
        <button
          type="button"
          className="fz-track__meta fz-truncate"
          style={{ textAlign: 'left' }}
          onClick={(event) => {
            event.stopPropagation();
            onAlbum();
          }}
        >
          {song.album}
        </button>
      )}

      {!compact && <div className="fz-track__meta">{formatTime(song.duration)}</div>}

      <div className="fz-track__actions">
        {!compact && (
          <button
            type="button"
            className={`fz-icon-btn fz-track__star ${starred ? 'is-on' : ''}`}
            aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
            aria-pressed={starred}
            onClick={(event) => {
              event.stopPropagation();
              onToggleStar();
            }}
          >
            <HeartIcon filled={starred} />
          </button>
        )}
        {reorderHandle ? (
          <span className="fz-icon-btn" aria-label="Reorder" {...reorderHandle}>
            <GripIcon />
          </span>
        ) : null}
        <button
          type="button"
          className="fz-icon-btn"
          aria-label={`More options for ${song.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onEllipsis(event.currentTarget);
          }}
        >
          <EllipsisIcon />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ selection bar */

function SelectionBar({
  songs,
  indices,
  onClear,
  onRemove,
  context,
}: {
  songs: Song[];
  indices: number[];
  onClear: () => void;
  onRemove?: (index: number) => void;
  context?: PlaybackContextInfo;
}) {
  const { actions } = usePlayer();
  const { addToPlaylist } = useDialogs();
  const { toggleStar, isStarred } = useLibrary();

  const allStarred = songs.every((song) => isStarred('song', song.id));

  return (
    <div className="fz-selection-bar fz-glass fz-glass--strong">
      <div className="fz-selection-bar__count">
        {songs.length} selected
      </div>
      <div className="fz-selection-bar__actions">
        <button type="button" className="fz-btn" onClick={() => actions.playQueue(songs, 0, context)}>
          <PlayIcon /> Play
        </button>
        <button type="button" className="fz-btn" onClick={() => actions.playNext(songs)}>
          <QueueIcon /> Play Next
        </button>
        <button type="button" className="fz-btn" onClick={() => actions.playLater(songs)}>
          <PlusIcon /> Play Last
        </button>
        <button type="button" className="fz-btn" onClick={() => addToPlaylist(songs)}>
          <PlusIcon /> Add to Playlist
        </button>
        <button
          type="button"
          className="fz-btn"
          onClick={() => songs.forEach((song) => void toggleStar('song', song.id))}
        >
          {allStarred ? <CheckIcon /> : <HeartIcon />} {allStarred ? 'Unfavourite' : 'Favourite'}
        </button>
        {onRemove && (
          <button
            type="button"
            className="fz-btn"
            onClick={() => {
              // Remove from the end so earlier indices stay valid.
              [...indices].sort((a, b) => b - a).forEach(onRemove);
              onClear();
            }}
          >
            <TrashIcon /> Remove
          </button>
        )}
      </div>
      <button type="button" className="fz-icon-btn" aria-label="Clear selection" onClick={onClear}>
        <CloseIcon />
      </button>
    </div>
  );
}
