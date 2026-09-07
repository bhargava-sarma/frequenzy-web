/**
 * "Playing Next" — the live queue.
 *
 * Rows reorder by dragging their grip, which works with a finger as well as a
 * mouse, and swipe away to remove on touch. What has already played stays
 * available above, so you can jump back a couple of tracks.
 */

import { useState } from 'react';

import { Artwork } from './Artwork';
import { GripIcon, InfinityIcon, PlayIcon, TrashIcon } from './Icons';
import { SwipeableRow } from './SwipeableRow';
import { songArtist } from '../lib/format';
import { useDragReorder } from '../hooks/useGestures';
import { useIsTouch } from '../hooks/useLayout';
import { usePlayer } from '../state/player';
import type { Song } from '../lib/types';

export function QueuePanel() {
  const { queue, index, context, autoplay, extending, actions } = usePlayer();
  const touch = useIsTouch();
  const [openSwipe, setOpenSwipe] = useState<number | null>(null);

  const reorder = useDragReorder({
    onReorder: (from, to) => actions.moveInQueue(index + 1 + from, index + 1 + to),
  });

  const played = queue.slice(0, Math.max(0, index));
  const upcoming = queue.slice(index + 1);

  return (
    <div className="fz-queue">
      <div className="fz-queue__head">
        <div style={{ minWidth: 0 }}>
          <div className="fz-queue__title">Playing Next</div>
          {context && (
            <div className="fz-truncate" style={{ fontSize: 11.5, opacity: 0.6 }}>
              From {context.kind} · {context.name}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`fz-chip ${autoplay ? 'is-on' : ''}`}
          style={{ marginLeft: 'auto' }}
          aria-pressed={autoplay}
          title="Keep playing similar music when the queue runs out"
          onClick={actions.toggleAutoplay}
        >
          <InfinityIcon />
          Autoplay
        </button>
        {upcoming.length > 0 && (
          <button type="button" className="fz-chip" onClick={actions.clearQueue}>
            <TrashIcon />
            Clear
          </button>
        )}
      </div>

      <div className="fz-queue__list">
        {played.length > 0 && (
          <>
            <div className="fz-queue__section">Played</div>
            {played.map((song, i) => (
              <QueueRow
                key={`played-${song.id}-${i}`}
                song={song}
                dimmed
                onPlay={() => actions.jumpTo(i)}
                onRemove={() => actions.removeAt(i)}
              />
            ))}
          </>
        )}

        {index >= 0 && queue[index] && (
          <>
            <div className="fz-queue__section">Now Playing</div>
            <QueueRow song={queue[index]} isCurrent onPlay={() => actions.jumpTo(index)} />
          </>
        )}

        {upcoming.length > 0 && <div className="fz-queue__section">Up Next</div>}

        <div ref={(el) => (reorder.containerRef.current = el)}>
          {upcoming.map((song, offset) => {
            const absolute = index + 1 + offset;
            const lifted = reorder.state?.from === offset;
            const dropTarget = reorder.state?.to === offset && reorder.state.from !== offset;

            const row = (
              <div
                data-reorder-item=""
                className={`fz-queue-item ${lifted ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
                onDoubleClick={() => actions.jumpTo(absolute)}
                onClick={() => actions.jumpTo(absolute)}
              >
                <Artwork coverArt={song.coverArt} name={song.title} size={120} className="fz-queue-item__art" />
                <div className="fz-queue-item__text">
                  <div className="fz-queue-item__title fz-truncate">{song.title}</div>
                  <div className="fz-queue-item__sub fz-truncate">{songArtist(song)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {!touch && (
                    <button
                      type="button"
                      className="fz-icon-btn fz-queue-item__handle"
                      aria-label={`Remove ${song.title} from the queue`}
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.removeAt(absolute);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <span
                    className="fz-queue-item__grip"
                    aria-label="Reorder"
                    onClick={(event) => event.stopPropagation()}
                    {...reorder.handleProps(offset)}
                  >
                    <GripIcon style={{ width: 18, height: 18 }} />
                  </span>
                </div>
              </div>
            );

            if (!touch) return <div key={`${song.id}-${absolute}`}>{row}</div>;

            return (
              <SwipeableRow
                key={`${song.id}-${absolute}`}
                open={openSwipe === absolute ? 'left' : null}
                onOpenChange={(next) => setOpenSwipe(next ? absolute : null)}
                leftActions={[
                  {
                    id: 'remove',
                    label: 'Remove',
                    tone: 'remove',
                    icon: <TrashIcon />,
                    onSelect: () => actions.removeAt(absolute),
                  },
                ]}
                rightActions={[
                  {
                    id: 'play',
                    label: 'Play Now',
                    tone: 'next',
                    icon: <PlayIcon />,
                    onSelect: () => actions.jumpTo(absolute),
                  },
                ]}
              >
                {row}
              </SwipeableRow>
            );
          })}
        </div>

        {upcoming.length === 0 && (
          <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 12.5, opacity: 0.55 }}>
            {extending
              ? 'Finding more music…'
              : autoplay
                ? 'Autoplay will keep this going when the queue runs out.'
                : 'Nothing queued after this track.'}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  song,
  isCurrent,
  dimmed,
  onPlay,
  onRemove,
}: {
  song: Song;
  isCurrent?: boolean;
  dimmed?: boolean;
  onPlay: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`fz-queue-item ${isCurrent ? 'is-current' : ''}`}
      onClick={onPlay}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.55 : 1 }}
    >
      <Artwork coverArt={song.coverArt} name={song.title} size={120} className="fz-queue-item__art" />
      <div className="fz-queue-item__text">
        <div className="fz-queue-item__title fz-truncate">{song.title}</div>
        <div className="fz-queue-item__sub fz-truncate">{songArtist(song)}</div>
      </div>
      {isCurrent ? (
        <span className="fz-eq"><span /><span /><span /></span>
      ) : onRemove ? (
        <button
          type="button"
          className="fz-icon-btn fz-queue-item__handle"
          aria-label={`Remove ${song.title} from the queue`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <TrashIcon />
        </button>
      ) : null}
    </div>
  );
}
