/**
 * "Playing Next" — the live queue, reorderable by dragging.
 * The current track pins to the top; everything after it is fair game.
 */

import { useState } from 'react';

import { Artwork } from './Artwork';
import { GripIcon, TrashIcon } from './Icons';
import { songArtist } from '../lib/format';
import { usePlayer } from '../state/player';

export function QueuePanel() {
  const { queue, index, context, actions } = usePlayer();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const upcoming = queue.slice(index + 1);

  return (
    <div className="fz-queue">
      <div className="fz-queue__head">
        <div>
          <div className="fz-queue__title">Playing Next</div>
          {context && (
            <div style={{ fontSize: 11.5, opacity: 0.6 }}>
              From {context.kind} · {context.name}
            </div>
          )}
        </div>
        {upcoming.length > 0 && (
          <button type="button" className="fz-chip" style={{ marginLeft: 'auto' }} onClick={actions.clearQueue}>
            <TrashIcon />
            Clear
          </button>
        )}
      </div>

      <div className="fz-queue__list">
        {index >= 0 && queue[index] && (
          <>
            <div className="fz-queue__section">Now Playing</div>
            <QueueRow song={queue[index]} isCurrent onPlay={() => actions.jumpTo(index)} />
          </>
        )}

        {upcoming.length > 0 && <div className="fz-queue__section">Up Next</div>}

        {upcoming.map((song, offset) => {
          const absolute = index + 1 + offset;
          return (
            <div
              key={`${song.id}-${absolute}`}
              draggable
              className={`fz-queue-item ${dragIndex === absolute ? 'is-dragging' : ''} ${overIndex === absolute ? 'is-drop-target' : ''}`}
              onDragStart={() => setDragIndex(absolute)}
              onDragOver={(event) => {
                event.preventDefault();
                setOverIndex(absolute);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== absolute) actions.moveInQueue(dragIndex, absolute);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDoubleClick={() => actions.jumpTo(absolute)}
            >
              <Artwork coverArt={song.coverArt} name={song.title} size={80} className="fz-queue-item__art" />
              <div className="fz-queue-item__text">
                <div className="fz-queue-item__title fz-truncate">{song.title}</div>
                <div className="fz-queue-item__sub fz-truncate">{songArtist(song)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  type="button"
                  className="fz-icon-btn fz-queue-item__handle"
                  aria-label="Remove from queue"
                  onClick={() => actions.removeAt(absolute)}
                >
                  <TrashIcon />
                </button>
                <span className="fz-queue-item__handle" aria-hidden="true"><GripIcon style={{ width: 16, height: 16 }} /></span>
              </div>
            </div>
          );
        })}

        {upcoming.length === 0 && (
          <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 12.5, opacity: 0.55 }}>
            Nothing queued after this track.
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({ song, isCurrent, onPlay }: { song: { id: string; title: string; coverArt?: string; artist?: string; displayArtist?: string }; isCurrent?: boolean; onPlay: () => void }) {
  return (
    <div className={`fz-queue-item ${isCurrent ? 'is-current' : ''}`} onDoubleClick={onPlay} style={{ cursor: 'default' }}>
      <Artwork coverArt={song.coverArt} name={song.title} size={80} className="fz-queue-item__art" />
      <div className="fz-queue-item__text">
        <div className="fz-queue-item__title fz-truncate">{song.title}</div>
        <div className="fz-queue-item__sub fz-truncate">{songArtist(song)}</div>
      </div>
      <span className="fz-eq"><span /><span /><span /></span>
    </div>
  );
}
