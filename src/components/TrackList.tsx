/**
 * The song list, used by every page that lists songs.
 *
 * Rows are a fixed height, which buys three things: long lists render only
 * what is on screen, drag-to-reorder is arithmetic rather than hit-testing,
 * and nothing ever jumps when artwork loads.
 *
 * Desktop: click selects, ⇧-click extends, ⌘/Ctrl-click toggles, double-click
 * plays, arrows move, Enter plays; rows drag onto playlists in the sidebar.
 * Touch: tap plays, swipe for quick actions, long-press for everything, and
 * "select" in that menu for picking several.
 */

import {
  memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent,
  type KeyboardEvent, type MouseEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Artwork } from './Artwork';
import { albumPath, InlineLink } from './InlineLink';
import { Eq } from './controls';
import {
  AddToQueueIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon, DownloadIcon, EllipsisIcon, GripIcon,
  HeartIcon, PlayIcon, PlayNextIcon, PlusIcon, TrashIcon,
} from './Icons';
import { SwipeRow, type SwipeAction } from './SwipeRow';
import { endDrag, startDrag } from '../lib/dnd';
import { isDownloaded, subscribeDownloads } from '../lib/downloads';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import type { Song } from '../lib/types';
import { useLongPress, useReorder } from '../hooks/useGestures';
import { useIsCompact, useIsTouch } from '../hooks/useLayout';
import { useScroller, useVirtualRows } from '../hooks/useScroller';
import * as act from '../state/actions';
import { useIsStarred } from '../state/library';
import { selectionMenu, songHeader, songMenu } from '../state/menus';
import { usePlayer, type PlaybackContextInfo } from '../state/player';
import { useSetting } from '../state/settings';
import { ui } from '../state/ui';

export type SortKey = 'index' | 'title' | 'artist' | 'album' | 'duration' | 'plays' | 'year';

interface TrackListProps {
  songs: Song[];
  context?: PlaybackContextInfo;
  /** 'album' numbers rows by track and drops the artwork. */
  variant?: 'album' | 'default';
  showAlbum?: boolean;
  showPlays?: boolean;
  /** Column headers that sort the list in place (desktop). */
  sortable?: boolean;
  /** Removal from whatever this list is (a playlist, the history, downloads). */
  onRemove?: (indices: number[]) => void;
  removeLabel?: string;
  /** Drag grips; indices are positions in `songs`. */
  onReorder?: (from: number, to: number) => void;
  /** For the song menu's "remove from playlist". */
  playlistId?: string;
  emptyText?: ReactNode;
  /** Album artist, so album rows only print a track's artist when it differs. */
  albumArtistName?: string;
  /**
   * What playing a row should queue, when it is more than this list — one
   * disc of an album queues the whole album, from that track.
   */
  queue?: { songs: Song[]; offset: number };
}

/** One place that decides how tall a row is, so CSS and arithmetic agree. */
export function useRowHeight(variant: 'album' | 'default'): number {
  const compact = useIsCompact();
  const density = useSetting('density');
  const tight = density === 'compact';
  if (variant === 'album') return compact ? (tight ? 48 : 54) : tight ? 38 : 44;
  return compact ? (tight ? 54 : 62) : tight ? 44 : 52;
}

const VIRTUAL_AFTER = 120;

function useIsDownloaded(id: string): boolean {
  return useSyncExternalStore(
    subscribeDownloads,
    () => isDownloaded(id),
    () => isDownloaded(id),
  );
}

function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}

export function TrackList({
  songs, context, variant = 'default', showAlbum = true, showPlays = false, sortable = false, onRemove,
  removeLabel = 'remove', onReorder, playlistId, emptyText, albumArtistName, queue,
}: TrackListProps) {
  const compact = useIsCompact();
  const touch = useIsTouch();
  const scroller = useScroller();
  const scrollerRef = useRef<HTMLElement | null>(scroller);
  scrollerRef.current = scroller;
  const rowHeight = useRowHeight(variant);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'index', dir: 1 });
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [openSwipe, setOpenSwipe] = useState<{ index: number; side: 'left' | 'right' } | null>(null);
  const anchor = useRef<number | null>(null);
  const gripDown = useRef(false);

  // Sorting is display-only; `order[i]` is the position in `songs` of row i.
  const order = useMemo(() => {
    const indices = songs.map((_, i) => i);
    if (!sortable || sort.key === 'index') return sort.dir === 1 ? indices : indices.reverse();
    const by: Record<Exclude<SortKey, 'index'>, (a: Song, b: Song) => number> = {
      title: (a, b) => compareText(a.title, b.title),
      artist: (a, b) => compareText(songArtist(a), songArtist(b)),
      album: (a, b) => compareText(a.album, b.album) || (a.track ?? 0) - (b.track ?? 0),
      duration: (a, b) => (a.duration ?? 0) - (b.duration ?? 0),
      plays: (a, b) => (a.playCount ?? 0) - (b.playCount ?? 0),
      year: (a, b) => (a.year ?? 0) - (b.year ?? 0),
    };
    const compare = by[sort.key];
    return indices.sort((x, y) => compare(songs[x], songs[y]) * sort.dir || x - y);
  }, [songs, sort, sortable]);

  const shown = useMemo(() => order.map((i) => songs[i]), [order, songs]);

  // A different list is a fresh start for the selection.
  const signature = useMemo(() => songs.map((s) => s.id).join('|'), [songs]);
  useEffect(() => {
    setSelected(new Set());
    setSelecting(false);
    anchor.current = null;
  }, [signature, sort]);

  const reorderEnabled = Boolean(onReorder) && sort.key === 'index' && sort.dir === 1;
  const reorder = useReorder({
    count: shown.length,
    rowHeight,
    scroller: scrollerRef,
    enabled: reorderEnabled,
    onReorder: (from, to) => onReorder?.(from, to),
  });

  const virtual = shown.length > VIRTUAL_AFTER && !reorder.state;
  const range = useVirtualRows(shown.length, rowHeight, listRef, virtual);

  /* ------------------------------------------------------------ selection */

  const selectedSongs = useMemo(
    () => [...selected].sort((a, b) => a - b).map((i) => shown[i]).filter(Boolean),
    [selected, shown],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setSelecting(false);
    anchor.current = null;
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        // Only the list the pointer or focus is in takes ⌘A.
        if (!listRef.current) return;
        if (!listRef.current.matches(':hover') && !listRef.current.contains(document.activeElement)) return;
        event.preventDefault();
        setSelected(new Set(shown.map((_, i) => i)));
      } else if (event.key === 'Escape' && selected.size > 0) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, selected.size, shown]);

  const toggle = useCallback((row: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
    anchor.current = row;
  }, []);

  /* --------------------------------------------------------------- actions */

  const play = useCallback(
    (row: number) => {
      if (queue) act.playSongs(queue.songs, queue.offset + order[row], context);
      else act.playSongs(shown, row, context);
    },
    [context, order, queue, shown],
  );

  const latest = useRef({ selected, selecting, compact, touch, play, toggle });
  latest.current = { selected, selecting, compact, touch, play, toggle };

  const onRowClick = useCallback((row: number, event: MouseEvent) => {
    const { selected: sel, selecting: picking, touch: isTouch, play: playRow, toggle: toggleRow } = latest.current;
    if (picking) {
      toggleRow(row);
      return;
    }
    if (isTouch) {
      playRow(row);
      return;
    }
    if (event.shiftKey && anchor.current !== null) {
      const [from, to] = [anchor.current, row].sort((a, b) => a - b);
      const next = new Set(sel);
      for (let i = from; i <= to; i++) next.add(i);
      setSelected(next);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      toggleRow(row);
      return;
    }
    setSelected(new Set([row]));
    anchor.current = row;
  }, []);

  const removeRows = useCallback(
    (rows: number[]) => {
      if (!onRemove) return;
      onRemove(rows.map((row) => order[row]).sort((a, b) => b - a));
      clearSelection();
    },
    [clearSelection, onRemove, order],
  );

  const menuFor = useCallback(
    (row: number) => {
      const song = shown[row];
      return songMenu(song, {
        list: queue ? queue.songs : shown,
        index: queue ? queue.offset + order[row] : row,
        context,
        playlist: playlistId && onRemove ? { id: playlistId, index: order[row], onRemove: () => removeRows([row]) } : undefined,
        // A mouse has ⌘-click; a finger needs a way in.
        onSelect: latest.current.touch
          ? () => {
              setSelecting(true);
              setSelected(new Set([row]));
            }
          : undefined,
      });
    },
    [context, onRemove, order, playlistId, queue, removeRows, shown],
  );

  const openMenu = useCallback(
    (row: number, at: { x: number; y: number } | Element) => {
      const sel = latest.current.selected;
      if (sel.size > 1 && sel.has(row)) {
        const rows = [...sel];
        ui.openMenu(
          selectionMenu(rows.sort((a, b) => a - b).map((i) => shown[i]), { onRemove: onRemove ? () => removeRows(rows) : undefined }),
          at,
          { title: `${rows.length} songs`, subtitle: 'selection' },
        );
        return;
      }
      ui.openMenu(menuFor(row), at, songHeader(shown[row]));
    },
    [menuFor, onRemove, removeRows, shown],
  );

  const onDragStart = useCallback(
    (row: number, event: DragEvent) => {
      if (gripDown.current) {
        event.preventDefault();
        return;
      }
      const sel = latest.current.selected;
      const songsToDrag = sel.has(row) && sel.size > 1 ? [...sel].sort((a, b) => a - b).map((i) => shown[i]) : [shown[row]];
      startDrag(event, { kind: 'songs', songs: songsToDrag });
    },
    [shown],
  );

  /* ---------------------------------------------------------- keyboard nav */

  const focusRow = useCallback(
    (row: number) => {
      const el = scroller;
      const list = listRef.current;
      if (!el || !list || row < 0 || row >= shown.length) return;
      const offset = list.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      const top = offset + row * rowHeight;
      const bar = 64;
      if (top < el.scrollTop + bar) el.scrollTop = top - bar;
      else if (top + rowHeight > el.scrollTop + el.clientHeight - 8) el.scrollTop = top + rowHeight - el.clientHeight + 8;
      // Two frames: a windowed list renders the row on the frame after the scroll.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          list.querySelector<HTMLElement>(`[data-row="${row}"]`)?.focus();
        }),
      );
    },
    [rowHeight, scroller, shown.length],
  );

  const onRowKey = useCallback(
    (row: number, event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const next = row + (event.key === 'ArrowDown' ? 1 : -1);
        if (next < 0 || next >= shown.length) return;
        if (event.shiftKey) {
          setSelected((prev) => new Set(prev).add(row).add(next));
        } else if (!latest.current.touch) {
          setSelected(new Set([next]));
          anchor.current = next;
        }
        focusRow(next);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        play(row);
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        openMenu(row, event.currentTarget);
      }
    },
    [focusRow, openMenu, play, shown.length],
  );

  if (songs.length === 0) {
    return <div className="tracks-empty">{emptyText ?? 'nothing here yet'}</div>;
  }

  /* ------------------------------------------------------------------ rows */

  const columns = gridColumns(variant, compact, showAlbum, showPlays, Boolean(onReorder));
  const rows: ReactNode[] = [];
  const first = virtual ? range.start : 0;
  const last = virtual ? range.end : shown.length;

  for (let row = first; row < last; row++) {
    const song = shown[row];
    const shift = reorder.shiftFor(row);
    const lifted = reorder.state?.from === row;
    // Where the row sits (windowing, reorder), separate from what it looks like.
    const slotStyle: CSSProperties = {
      height: rowHeight,
      ...(virtual ? { position: 'absolute', top: row * rowHeight, left: 0, right: 0 } : null),
      ...(reorder.state ? { transform: `translate3d(0, ${shift}px, 0)`, zIndex: lifted ? 3 : 1, position: virtual ? 'absolute' : 'relative' } : null),
    };
    const rowStyle: CSSProperties = { height: rowHeight, gridTemplateColumns: columns };
    const rowNode = (
      <TrackRow
        song={song}
        row={row}
        number={variant === 'album' ? (song.track ?? order[row] + 1) : order[row] + 1}
        variant={variant}
        compact={compact}
        touch={touch}
        showAlbum={showAlbum}
        showPlays={showPlays}
        albumArtistName={albumArtistName}
        style={touch ? rowStyle : { ...rowStyle, ...slotStyle }}
        selected={selected.has(row)}
        selecting={selecting}
        lifted={lifted}
        settling={Boolean(reorder.state) && !lifted}
        grip={reorderEnabled ? reorder.handleProps(order[row]) : undefined}
        onGripDown={() => {
          gripDown.current = true;
          window.addEventListener('pointerup', () => (gripDown.current = false), { once: true });
        }}
        onClick={onRowClick}
        onPlay={play}
        onMenu={openMenu}
        onKey={onRowKey}
        onDragStart={onDragStart}
      />
    );

    const key = `${song.id}:${order[row]}`;
    if (!touch) {
      rows.push(<RowKey key={key}>{rowNode}</RowKey>);
      continue;
    }
    if (selecting) {
      rows.push(
        <div key={key} className="track-slot" style={slotStyle}>
          {rowNode}
        </div>,
      );
      continue;
    }

    rows.push(
      <SwipeRow
        key={key}
        style={slotStyle}
        open={openSwipe?.index === row ? openSwipe.side : null}
        onOpenChange={(next) => setOpenSwipe(next ? { index: row, side: next } : null)}
        disabled={Boolean(reorder.state)}
        leftActions={swipeLeft(song, onRemove ? () => removeRows([row]) : undefined, removeLabel)}
        rightActions={swipeRight(song)}
      >
        {rowNode}
      </SwipeRow>,
    );
  }

  return (
    <>
      {sortable && !compact && (
        <ListHeader variant={variant} columns={columns} showAlbum={showAlbum} showPlays={showPlays} sort={sort} onSort={setSort} />
      )}
      <div
        ref={listRef}
        className={`tracks tracks--${variant} ${reorder.state ? 'is-reordering' : ''}`}
        role="list"
        style={virtual ? { position: 'relative', height: shown.length * rowHeight } : undefined}
      >
        {rows}
      </div>
      {(selectedSongs.length > 1 || selecting) && (
        <SelectionBar
          songs={selectedSongs}
          onClear={clearSelection}
          onRemove={onRemove ? () => removeRows([...selected]) : undefined}
          removeLabel={removeLabel}
          onSelectAll={() => setSelected(new Set(shown.map((_, i) => i)))}
        />
      )}
    </>
  );
}

function RowKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function gridColumns(variant: 'album' | 'default', compact: boolean, album: boolean, plays: boolean, grip: boolean): string {
  if (compact) {
    const lead = variant === 'album' ? '30px ' : '';
    return `${lead}minmax(0, 1fr) auto`;
  }
  const parts: string[] = [];
  if (variant === 'album') parts.push('36px', 'minmax(0, 1fr)');
  else parts.push('minmax(0, 1.5fr)');
  if (album && variant !== 'album') parts.push('minmax(0, 1fr)');
  if (plays) parts.push('64px');
  parts.push('58px', grip ? '104px' : '76px');
  return parts.join(' ');
}

/* ------------------------------------------------------------------ header */

function ListHeader({
  variant, columns, showAlbum, showPlays, sort, onSort,
}: {
  variant: 'album' | 'default';
  columns: string;
  showAlbum: boolean;
  showPlays: boolean;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (sort: { key: SortKey; dir: 1 | -1 }) => void;
}) {
  const cell = (key: SortKey, label: string, className = '') => {
    const active = sort.key === key;
    return (
      <button
        type="button"
        className={`tracks-head__cell ${active ? 'is-active' : ''} ${className}`}
        onClick={() => onSort(active ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: key === 'plays' ? -1 : 1 })}
      >
        {label}
        {active && (sort.dir === 1 ? <ArrowUpIcon /> : <ArrowDownIcon />)}
      </button>
    );
  };
  return (
    <div className="tracks-head" style={{ gridTemplateColumns: columns }}>
      {variant === 'album' && cell('index', '#')}
      {cell('title', variant === 'album' ? 'title' : 'title / artist')}
      {showAlbum && variant !== 'album' && cell('album', 'album')}
      {showPlays && cell('plays', 'plays', 'is-right')}
      {cell('duration', 'time', 'is-right')}
      <span />
    </div>
  );
}

/* --------------------------------------------------------------------- row */

interface TrackRowProps {
  song: Song;
  row: number;
  number: number;
  variant: 'album' | 'default';
  compact: boolean;
  touch: boolean;
  showAlbum: boolean;
  showPlays: boolean;
  albumArtistName?: string;
  style: CSSProperties;
  selected: boolean;
  selecting: boolean;
  lifted: boolean;
  settling: boolean;
  grip?: ReturnType<ReturnType<typeof useReorder>['handleProps']>;
  onGripDown: () => void;
  onClick: (row: number, event: MouseEvent) => void;
  onPlay: (row: number) => void;
  onMenu: (row: number, at: { x: number; y: number } | Element) => void;
  onKey: (row: number, event: KeyboardEvent) => void;
  onDragStart: (row: number, event: DragEvent) => void;
}

const TrackRow = memo(function TrackRow(props: TrackRowProps) {
  const {
    song, row, number, variant, compact, touch, showAlbum, showPlays, albumArtistName, style, selected, selecting,
    lifted, settling, grip, onGripDown, onClick, onPlay, onMenu, onKey, onDragStart,
  } = props;
  const status = usePlayer((s) => (s.current?.id === song.id ? (s.playing ? 'playing' : 'paused') : 'none'));
  const starred = useIsStarred('song', song.id);
  const offline = useIsDownloaded(song.id);
  const longPress = useLongPress((point) => onMenu(row, point));
  const badge = qualityBadge(song);
  const current = status !== 'none';
  const artist = songArtist(song);
  const showArtistLine = variant !== 'album' || (albumArtistName !== undefined && artist !== albumArtistName);

  return (
    <div
      className={`track ${current ? 'is-current' : ''} ${selected ? 'is-selected' : ''} ${lifted ? 'is-lifted' : ''} ${
        settling ? 'is-settling' : ''
      } ${song.isRadio ? 'is-radio' : ''}`}
      role="listitem"
      tabIndex={row === 0 ? 0 : -1}
      data-row={row}
      style={style}
      draggable={!touch}
      onDragStart={(event) => onDragStart(row, event)}
      onDragEnd={endDrag}
      onClick={(event) => {
        if (longPress.consumeClick()) return;
        onClick(row, event);
      }}
      onDoubleClick={() => !touch && onPlay(row)}
      onContextMenu={(event) => {
        event.preventDefault();
        if (touch) return;
        onMenu(row, { x: event.clientX, y: event.clientY });
      }}
      onKeyDown={(event) => onKey(row, event)}
      {...(touch ? longPress.handlers : null)}
    >
      {variant === 'album' && (
        <div className="track__num">
          {selecting ? (
            <span className={`check ${selected ? 'is-on' : ''}`}>{selected && <CheckIcon />}</span>
          ) : current ? (
            <Eq paused={status === 'paused'} />
          ) : (
            <>
              <span className="track__n tnum">{number}</span>
              {!touch && (
                <button
                  type="button"
                  className="track__play"
                  aria-label={`Play ${song.title}`}
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlay(row);
                  }}
                >
                  <PlayIcon />
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="track__main">
        {variant !== 'album' && (
          <div className="track__art-wrap">
            {selecting && <span className={`check check--over ${selected ? 'is-on' : ''}`}>{selected && <CheckIcon />}</span>}
            <Artwork coverArt={song.coverArt} name={song.title} size={compact ? 46 : 38} className="track__art" />
            {current && !selecting && (
              <span className="track__art-eq">
                <Eq paused={status === 'paused'} />
              </span>
            )}
            {!touch && !current && !selecting && (
              <button
                type="button"
                className="track__art-play"
                aria-label={`Play ${song.title}`}
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlay(row);
                }}
              >
                <PlayIcon />
              </button>
            )}
          </div>
        )}
        <div className="track__text">
          <div className="track__title truncate">
            {song.title}
            {badge?.hiRes && !compact && <span className="tag tag--accent track__tag">hi-res</span>}
          </div>
          {(showArtistLine || compact) && (
            <div className="track__sub">
              {offline && <DownloadIcon className="track__offline" aria-label="downloaded" />}
              <span className="truncate">
                {showArtistLine ? artist : formatTime(song.duration)}
                {compact && showArtistLine && showAlbum && song.album ? ` · ${song.album}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {!compact && showAlbum && variant !== 'album' && (
        <div className="track__album truncate">
          {song.albumId ? (
            <InlineLink className="track__link" to={albumPath(song.albumId)} tabIndex={-1}>
              {song.album}
            </InlineLink>
          ) : (
            song.album
          )}
        </div>
      )}
      {!compact && showPlays && <div className="track__time tnum">{song.playCount ?? 0}</div>}
      {!compact && <div className="track__time tnum">{song.isRadio ? 'live' : formatTime(song.duration)}</div>}

      <div className="track__actions">
        {!compact && !song.isRadio && (
          <button
            type="button"
            className={`ibtn ibtn--sm track__heart ${starred ? 'is-on' : ''}`}
            aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={starred}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              void act.toggleFavourite('song', song.id);
            }}
          >
            <HeartIcon filled={starred} />
          </button>
        )}
        {grip && (
          <span
            className="track__grip"
            aria-label="Drag to reorder"
            {...grip}
            onPointerDown={(event) => {
              onGripDown();
              grip.onPointerDown(event);
            }}
          >
            <GripIcon />
          </span>
        )}
        {!selecting && (
          <button
            type="button"
            className="ibtn ibtn--sm track__more"
            aria-label={`More for ${song.title}`}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onMenu(row, event.currentTarget);
            }}
          >
            <EllipsisIcon />
          </button>
        )}
      </div>
    </div>
  );
});

/* ----------------------------------------------------------- swipe actions */

function swipeLeft(song: Song, onRemove: (() => void) | undefined, removeLabel: string): SwipeAction[] {
  const actions: SwipeAction[] = [
    { id: 'next', label: 'play next', tone: 'blue', icon: <PlayNextIcon />, onSelect: () => act.playNext([song]) },
    { id: 'queue', label: 'queue', tone: 'green', icon: <AddToQueueIcon />, onSelect: () => act.addToQueue([song]) },
  ];
  if (onRemove) actions.push({ id: 'remove', label: removeLabel, tone: 'red', icon: <TrashIcon />, onSelect: onRemove });
  return actions;
}

function swipeRight(song: Song): SwipeAction[] {
  if (song.isRadio) return [];
  return [
    {
      id: 'love',
      label: 'favourite',
      tone: 'orange',
      icon: <HeartIcon />,
      onSelect: () => void act.toggleFavourite('song', song.id),
    },
    { id: 'playlist', label: 'playlist', tone: 'yellow', icon: <PlusIcon />, onSelect: () => act.choosePlaylist([song]) },
  ];
}

/* ------------------------------------------------------------ selection bar */

function SelectionBar({
  songs, onClear, onRemove, removeLabel, onSelectAll,
}: {
  songs: Song[];
  onClear: () => void;
  onRemove?: () => void;
  removeLabel: string;
  onSelectAll: () => void;
}) {
  const none = songs.length === 0;
  // Rendered into the body, so no transform or overflow on an ancestor can
  // turn `position: fixed` into something else.
  return createPortal(
    <div className="selbar" role="toolbar" aria-label="Selection">
      <div className="selbar__count">
        <span className="tnum">{songs.length}</span> selected
      </div>
      <div className="selbar__keys">
        <button type="button" className="key key--sm key--primary" disabled={none} onClick={() => act.playSongs(songs, 0)}>
          <PlayIcon /> play
        </button>
        <button type="button" className="key key--sm" disabled={none} onClick={() => act.playNext(songs)}>
          <PlayNextIcon /> next
        </button>
        <button type="button" className="key key--sm" disabled={none} onClick={() => act.addToQueue(songs)}>
          <AddToQueueIcon /> queue
        </button>
        <button type="button" className="key key--sm" disabled={none} onClick={() => act.choosePlaylist(songs)}>
          <PlusIcon /> playlist
        </button>
        <button
          type="button"
          className="key key--sm key--icon"
          aria-label="More"
          disabled={none}
          onClick={(event) => ui.openMenu(selectionMenu(songs, { onRemove }), event.currentTarget, { title: `${songs.length} songs`, subtitle: 'selection' })}
        >
          <EllipsisIcon />
        </button>
        {onRemove && (
          <button type="button" className="key key--sm key--danger" disabled={none} onClick={onRemove}>
            <TrashIcon /> {removeLabel}
          </button>
        )}
      </div>
      <button type="button" className="key key--sm key--ghost" onClick={onSelectAll}>
        all
      </button>
      <button type="button" className="ibtn" aria-label="Clear selection" onClick={onClear}>
        <CloseIcon />
      </button>
    </div>,
    document.body,
  );
}
