/**
 * The bottom bar: transport on the left, the "LCD" display in the middle, and
 * lyrics / queue / volume on the right — the arrangement Apple Music uses on
 * the desktop. Clicking the LCD raises the full-screen player.
 */

import { useState } from 'react';

import { Artwork } from './Artwork';
import { Scrubber } from './Scrubber';
import {
  ChevronDownIcon, EllipsisIcon, HeartIcon, LyricsIcon, NextIcon, PauseIcon,
  PlayIcon, PreviousIcon, QueueIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon,
  VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon,
} from './Icons';
import { useContextMenu } from './ContextMenu';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useMediaMenu } from '../hooks/useMediaMenu';

interface NowPlayingBarProps {
  onExpand: () => void;
  panel: 'none' | 'lyrics' | 'queue';
  onPanelChange: (panel: 'none' | 'lyrics' | 'queue') => void;
}

export function NowPlayingBar({ onExpand, panel, onPanelChange }: NowPlayingBarProps) {
  const { current, playing, loading, currentTime, duration, buffered, volume, muted, shuffle, repeat, actions, error } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist, showTrackInfo } = useDialogs();
  const { songMenu } = useMediaMenu();
  const { openAt, menu } = useContextMenu();
  const [scrubbing, setScrubbing] = useState(false);

  const starred = current ? isStarred('song', current.id) : false;
  const badge = qualityBadge(current);
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div className="fz-bar">
      <div className="fz-bar__left">
        <div className="fz-transport">
          <button type="button" className="fz-transport__btn" aria-label="Previous" onClick={actions.previous} disabled={!current}>
            <PreviousIcon />
          </button>
          <button
            type="button"
            className="fz-transport__btn fz-transport__btn--play"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={actions.toggle}
            disabled={!current}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="fz-transport__btn" aria-label="Next" onClick={actions.next} disabled={!current}>
            <NextIcon />
          </button>
        </div>
      </div>

      <div
        className="fz-lcd"
        role="button"
        tabIndex={0}
        aria-label="Open full screen player"
        onClick={(event) => {
          // Ignore clicks that landed on the scrubber sitting inside the panel.
          if ((event.target as HTMLElement).closest('.fz-scrub')) return;
          if (current) onExpand();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && current) onExpand();
        }}
      >
        {current ? (
          <>
            <Artwork coverArt={current.coverArt} name={current.title} size={120} className="fz-lcd__art" />
            <div className="fz-lcd__text">
              <span className="fz-lcd__title fz-truncate">
                {loading && <span className="fz-spinner" style={{ width: 10, height: 10, display: 'inline-block', marginRight: 6, verticalAlign: -1 }} />}
                {current.title}
              </span>
              <span className="fz-lcd__sub fz-truncate">
                {songArtist(current)}
                {current.album ? ` — ${current.album}` : ''}
                {badge?.lossless && (
                  <span className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : 'fz-badge--lossless'}`} style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                    {badge.hiRes ? 'Hi-Res' : 'Lossless'}
                  </span>
                )}
              </span>
            </div>
            <div className="fz-lcd__time">{formatTime(duration - currentTime)}</div>
            <div className={`fz-lcd__scrub ${scrubbing ? 'is-active' : ''}`}>
              <Scrubber
                value={currentTime}
                max={duration || current.duration || 0}
                buffered={buffered}
                onChange={actions.seek}
                onDragChange={setScrubbing}
                ariaLabel="Seek"
              />
            </div>
          </>
        ) : (
          <div className="fz-lcd__empty">{error ?? 'Frequenzy'}</div>
        )}
      </div>

      <div className="fz-bar__right">
        {current && (
          <>
            <button
              type="button"
              className={`fz-icon-btn ${starred ? 'is-on' : ''}`}
              aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
              onClick={() => void toggleStar('song', current.id)}
            >
              <HeartIcon filled={starred} />
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${shuffle ? 'is-on' : ''}`}
              aria-label="Shuffle"
              aria-pressed={shuffle}
              onClick={actions.toggleShuffle}
            >
              <ShuffleIcon />
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${repeat !== 'off' ? 'is-on' : ''}`}
              aria-label={`Repeat: ${repeat}`}
              onClick={actions.cycleRepeat}
            >
              {repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${panel === 'lyrics' ? 'is-on' : ''}`}
              aria-label="Lyrics"
              onClick={() => onPanelChange(panel === 'lyrics' ? 'none' : 'lyrics')}
            >
              <LyricsIcon />
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${panel === 'queue' ? 'is-on' : ''}`}
              aria-label="Playing Next"
              onClick={() => onPanelChange(panel === 'queue' ? 'none' : 'queue')}
            >
              <QueueIcon />
            </button>
            <button
              type="button"
              className="fz-icon-btn"
              aria-label="More options"
              onClick={(event) =>
                openAt(
                  event.currentTarget,
                  songMenu(current, { onRequestAddToPlaylist: addToPlaylist, onShowInfo: showTrackInfo }),
                )
              }
            >
              <EllipsisIcon />
            </button>
          </>
        )}
        <div className="fz-volume">
          <button type="button" className="fz-icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={actions.toggleMute}>
            <VolumeIcon />
          </button>
          <Scrubber value={muted ? 0 : volume} max={1} onChange={actions.setVolume} ariaLabel="Volume" />
        </div>
        {current && (
          <button type="button" className="fz-icon-btn" aria-label="Open full screen player" onClick={onExpand}>
            <ChevronDownIcon style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>
      {menu}
    </div>
  );
}
