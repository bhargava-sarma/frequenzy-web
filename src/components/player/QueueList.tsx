/**
 * The queue: what is playing, what comes next, and what has played.
 *
 * Up-next rows reorder by their grip with a finger or a mouse, swipe away on
 * touch, and jump straight to a track on click. What has already played
 * folds away underneath, one tap from coming back.
 */

import { memo, useMemo, useRef, useState } from 'react';

import { Artwork } from '../Artwork';
import { Eq } from '../controls';
import {
  ChevronDownIcon, ChevronUpIcon, CloseIcon, EllipsisIcon, GripIcon, InfinityIcon, PlayNextIcon, PlusIcon, ShuffleIcon,
  TrashIcon,
} from '../Icons';
import { SwipeRow } from '../SwipeRow';
import { songsOf } from '../../lib/dnd';
import { formatDurationLong, formatTime, songArtist } from '../../lib/format';
import { useReorder } from '../../hooks/useGestures';
import { useDropTarget } from '../../hooks/useDropTarget';
import { useIsCompact, useIsTouch } from '../../hooks/useLayout';
import { useVirtualRows } from '../../hooks/useScroller';
import * as act from '../../state/actions';
import { songHeader, songMenu } from '../../state/menus';
import { player, usePlayer, type QueueItem } from '../../state/player';
import { ui } from '../../state/ui';

const VIRTUAL_AFTER = 150;

export function QueueList({ variant = 'panel' }: { variant?: 'panel' | 'full' }) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const autoplay = usePlayer((s) => s.autoplay);
  const extending = usePlayer((s) => s.extending);
  const context = usePlayer((s) => s.context);
  const compact = useIsCompact();
  const touch = useIsTouch();
  const rowHeight = compact ? 60 : 52;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showPlayed, setShowPlayed] = useState(false);
  const [openSwipe, setOpenSwipe] = useState<{ key: string; side: 'left' | 'right' } | null>(null);

  const current = queue[index] ?? null;
  const upcoming = useMemo(() => queue.slice(index + 1), [index, queue]);
  const played = useMemo(() => queue.slice(0, Math.max(0, index)), [index, queue]);
  const upcomingTime = useMemo(() => upcoming.reduce((sum, entry) => sum + (entry.song.duration ?? 0), 0), [upcoming]);

  const reorder = useReorder({
    count: upcoming.length,
    rowHeight,
    scroller: scrollRef,
    onReorder: (from, to) => player.move(index + 1 + from, index + 1 + to),
  });
  const virtual = upcoming.length > VIRTUAL_AFTER && !reorder.state;
  const range = useVirtualRows(upcoming.length, rowHeight, listRef, virtual, 8, scrollRef);

  const drop = useDropTarget((payload) => {
    void songsOf(payload).then((songs) => act.addToQueue(songs));
  });

  const moreMenu = (element: Element) =>
    ui.openMenu(
      [
        { id: 'shuffle', label: 'shuffle up next', icon: <ShuffleIcon />, disabled: upcoming.length < 2, onSelect: () => act.shuffleUpcoming() },
        { id: 'save', label: 'save queue as playlist…', icon: <PlusIcon />, disabled: queue.length === 0, onSelect: () => act.saveQueueAsPlaylist() },
        { id: 's1', separator: true },
        { id: 'clear', label: 'clear up next', icon: <TrashIcon />, disabled: upcoming.length === 0, onSelect: () => act.clearUpcoming() },
        { id: 'played', label: 'clear history', icon: <TrashIcon />, disabled: played.length === 0, onSelect: () => act.clearPlayed() },
        { id: 'stop', label: 'stop and clear everything', icon: <CloseIcon />, danger: true, disabled: queue.length === 0, onSelect: () => act.stopAndClear() },
      ],
      element,
    );

  const rows = [];
  const first = virtual ? range.start : 0;
  const last = virtual ? range.end : upcoming.length;
  for (let i = first; i < last; i++) {
    const entry = upcoming[i];
    const absolute = index + 1 + i;
    const lifted = reorder.state?.from === i;
    const slot = {
      height: rowHeight,
      ...(virtual ? { position: 'absolute' as const, top: i * rowHeight, left: 0, right: 0 } : null),
      ...(reorder.state ? { transform: `translate3d(0, ${reorder.shiftFor(i)}px, 0)`, zIndex: lifted ? 3 : 1, position: virtual ? ('absolute' as const) : ('relative' as const) } : null),
    };
    const row = (
      <QueueRow
        entry={entry}
        height={rowHeight}
        lifted={lifted}
        settling={Boolean(reorder.state) && !lifted}
        touch={touch}
        grip={reorder.handleProps(i)}
        onPlay={() => player.jumpTo(absolute)}
        onRemove={() => act.removeFromQueue([entry.key])}
      />
    );
    if (touch) {
      rows.push(
        <SwipeRow
          key={entry.key}
          style={slot}
          open={openSwipe?.key === entry.key ? openSwipe.side : null}
          onOpenChange={(side) => setOpenSwipe(side ? { key: entry.key, side } : null)}
          disabled={Boolean(reorder.state)}
          leftActions={[
            { id: 'remove', label: 'remove', tone: 'red', icon: <TrashIcon />, onSelect: () => act.removeFromQueue([entry.key]) },
            { id: 'next', label: 'next', tone: 'blue', icon: <PlayNextIcon />, onSelect: () => player.moveToNext(entry.key) },
          ]}
        >
          {row}
        </SwipeRow>,
      );
    } else {
      rows.push(
        <div key={entry.key} style={slot} className="qslot">
          {row}
        </div>,
      );
    }
  }

  return (
    <div className={`queue queue--${variant} ${drop.over ? 'is-drop' : ''}`} {...drop.handlers}>
      <div className="queue__head">
        <div className="queue__head-text">
          <span className="label">up next</span>
          <span className="meta">
            {upcoming.length} {upcoming.length === 1 ? 'track' : 'tracks'}
            {upcomingTime > 0 ? ` · ${formatDurationLong(upcomingTime)}` : ''}
          </span>
        </div>
        <button
          type="button"
          className={`chip ${autoplay ? 'is-on' : ''}`}
          aria-pressed={autoplay}
          title="Keep playing similar music when the queue ends"
          onClick={() => player.toggleAutoplay()}
        >
          <InfinityIcon /> auto
        </button>
        <button type="button" className="ibtn" aria-label="Queue options" onClick={(event) => moreMenu(event.currentTarget)}>
          <EllipsisIcon />
        </button>
      </div>

      <div className="queue__scroll" ref={scrollRef}>
        {current && (
          <div className="queue__section">
            <div className="queue__label label">
              now playing{context ? <span className="queue__from"> · {context.kind.toLowerCase()} · {context.name}</span> : null}
            </div>
            <QueueRow entry={current} height={rowHeight} current touch={touch} onPlay={() => player.toggle()} />
          </div>
        )}

        <div className="queue__section">
          {upcoming.length > 0 ? (
            <div
              ref={listRef}
              className={`queue__list ${reorder.state ? 'is-reordering' : ''}`}
              style={virtual ? { position: 'relative', height: upcoming.length * rowHeight } : undefined}
            >
              {rows}
            </div>
          ) : (
            <div className="queue__empty">
              {extending
                ? 'finding more music…'
                : autoplay
                  ? 'autoplay will keep going with similar music when this track ends.'
                  : current
                    ? 'nothing queued after this track.'
                    : 'the queue is empty — play something.'}
            </div>
          )}
        </div>

        {played.length > 0 && (
          <div className="queue__section">
            <button type="button" className="queue__toggle" onClick={() => setShowPlayed((v) => !v)}>
              <span className="label">history · {played.length}</span>
              {showPlayed ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {showPlayed &&
              played
                .slice(-100)
                .map((entry, i, list) => (
                  <QueueRow
                    key={entry.key}
                    entry={entry}
                    height={rowHeight}
                    dim
                    touch={touch}
                    onPlay={() => player.jumpTo(played.length - list.length + i)}
                    onRemove={() => act.removeFromQueue([entry.key])}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface QueueRowProps {
  entry: QueueItem;
  height: number;
  current?: boolean;
  dim?: boolean;
  lifted?: boolean;
  settling?: boolean;
  touch: boolean;
  grip?: ReturnType<ReturnType<typeof useReorder>['handleProps']>;
  onPlay: () => void;
  onRemove?: () => void;
}

const QueueRow = memo(function QueueRow({ entry, height, current, dim, lifted, settling, touch, grip, onPlay, onRemove }: QueueRowProps) {
  const playing = usePlayer((s) => (current ? s.playing : false));
  const song = entry.song;
  return (
    <div
      className={`qrow ${current ? 'is-current' : ''} ${dim ? 'is-dim' : ''} ${lifted ? 'is-lifted' : ''} ${settling ? 'is-settling' : ''}`}
      style={{ height }}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onPlay();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        ui.openMenu(songMenu(song, { queueKey: current ? undefined : entry.key }), { x: event.clientX, y: event.clientY }, songHeader(song));
      }}
    >
      <div className="qrow__art-wrap">
        <Artwork coverArt={song.coverArt} name={song.title} size={40} className="qrow__art" />
        {current && (
          <span className="qrow__eq">
            <Eq paused={!playing} />
          </span>
        )}
      </div>
      <div className="qrow__text">
        <div className="qrow__title truncate">{song.title}</div>
        <div className="qrow__sub truncate">{songArtist(song)}</div>
      </div>
      <span className="qrow__time tnum">{song.isRadio ? 'live' : formatTime(song.duration)}</span>
      {!touch &&
        (onRemove ? (
          <button
            type="button"
            className="ibtn ibtn--sm qrow__remove"
            aria-label={`Remove ${song.title} from the queue`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <CloseIcon />
          </button>
        ) : (
          <span className="qrow__slot" aria-hidden="true" />
        ))}
      {grip ? (
        <span className="qrow__grip" aria-label="Drag to reorder" {...grip}>
          <GripIcon />
        </span>
      ) : (
        <span className="qrow__slot qrow__slot--grip" aria-hidden="true" />
      )}
    </div>
  );
});
