/**
 * The full-screen player.
 *
 * The whole surface is lit by the artwork: we pull a palette out of the cover
 * and drive three slow-drifting gradient blobs with it, so the room takes on the
 * colour of whatever is playing. Lyrics and the queue slide in beside the art.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { LyricsView } from './LyricsView';
import { QueuePanel } from './QueuePanel';
import { Scrubber } from './Scrubber';
import { useContextMenu } from './ContextMenu';
import {
  ChevronDownIcon, EllipsisIcon, HeartIcon, LyricsIcon, NextIcon, PauseIcon,
  PlayIcon, PreviousIcon, QueueIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon,
  VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon,
} from './Icons';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import { extractPalette, DEFAULT_PALETTE, type Palette } from '../lib/color';
import { coverArtUrl } from '../lib/subsonic';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useSettings } from '../state/settings';
import { useMediaMenu } from '../hooks/useMediaMenu';

export type PlayerPanel = 'none' | 'lyrics' | 'queue';

interface FullPlayerProps {
  panel: PlayerPanel;
  onPanelChange: (panel: PlayerPanel) => void;
  onClose: () => void;
}

export function FullPlayer({ panel, onPanelChange, onClose }: FullPlayerProps) {
  const { current, playing, currentTime, duration, buffered, volume, muted, shuffle, repeat, context, actions } = usePlayer();
  const { settings } = useSettings();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist, showTrackInfo } = useDialogs();
  const { songMenu } = useMediaMenu();
  const { openAt, menu } = useContextMenu();
  const navigate = useNavigate();

  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [closing, setClosing] = useState(false);

  // Repaint the ambient wash whenever the artwork changes.
  useEffect(() => {
    if (!current?.coverArt || !settings.ambientBackground) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    let alive = true;
    extractPalette(coverArtUrl(current.coverArt, 300)).then((result) => {
      if (alive) setPalette(result);
    });
    return () => {
      alive = false;
    };
  }, [current?.coverArt, settings.ambientBackground]);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 380);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Bound once on mount; `close` only ever calls setState and the prop.
  }, []);

  if (!current) return null;

  const starred = isStarred('song', current.id);
  const badge = qualityBadge(current);
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div
      className={`fz-player ${closing ? 'is-closing' : ''}`}
      style={{
        ['--art-primary' as string]: palette.primary,
        ['--art-secondary' as string]: palette.secondary,
        ['--art-tertiary' as string]: palette.tertiary,
        ['--art-background' as string]: palette.background,
      }}
    >
      <div className="fz-ambient">
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__scrim" />
        <div className="fz-ambient__grain" />
      </div>

      <div className="fz-player__chrome">
        <button type="button" className="fz-player__collapse" aria-label="Close full screen player" onClick={close}>
          <ChevronDownIcon />
        </button>
        {context && <div className="fz-player__context">Playing from {context.kind} · {context.name}</div>}
        <div className="fz-player__chrome-spacer" />
        {badge && (
          <span className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : badge.lossless ? 'fz-badge--lossless' : ''}`} title={badge.detail}>
            {badge.label} · {badge.detail}
          </span>
        )}
      </div>

      <div className={`fz-player__body ${panel !== 'none' ? 'has-panel' : ''}`}>
        <div className="fz-player__stage">
          <Artwork
            coverArt={current.coverArt}
            name={current.title}
            size={800}
            className={`fz-player__art ${playing ? 'is-playing' : ''}`}
          />

          <div className="fz-player__meta">
            <div className="fz-player__meta-text">
              <div className="fz-player__title fz-truncate">{current.title}</div>
              <div
                className="fz-player__artist fz-truncate"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (current.artistId) {
                    close();
                    navigate(`/artist/${encodeURIComponent(current.artistId)}`);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && current.artistId) {
                    close();
                    navigate(`/artist/${encodeURIComponent(current.artistId)}`);
                  }
                }}
              >
                {songArtist(current)}
              </div>
            </div>
            <button
              type="button"
              className={`fz-icon-btn ${starred ? 'is-on' : ''}`}
              style={{ color: starred ? '#fff' : 'rgba(255,255,255,0.6)' }}
              aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
              onClick={() => void toggleStar('song', current.id)}
            >
              <HeartIcon filled={starred} />
            </button>
            <button
              type="button"
              className="fz-icon-btn"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="More options"
              onClick={(event) =>
                openAt(event.currentTarget, songMenu(current, { onRequestAddToPlaylist: addToPlaylist, onShowInfo: showTrackInfo, context: context ?? undefined }))
              }
            >
              <EllipsisIcon />
            </button>
          </div>

          <div className="fz-player__scrub">
            <Scrubber
              value={currentTime}
              max={duration || current.duration || 0}
              buffered={buffered}
              onChange={actions.seek}
              ariaLabel="Seek"
            />
            <div className="fz-scrub__times">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
            </div>
          </div>

          <div className="fz-player__controls">
            <button type="button" className="fz-transport__btn" aria-label="Previous" onClick={actions.previous}>
              <PreviousIcon />
            </button>
            <button
              type="button"
              className="fz-transport__btn fz-transport__btn--play"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={actions.toggle}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="fz-transport__btn" aria-label="Next" onClick={actions.next}>
              <NextIcon />
            </button>
          </div>

          <div className="fz-player__extras">
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

            <div className="fz-volume" style={{ flex: 1, maxWidth: 150 }}>
              <button type="button" className="fz-icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={actions.toggleMute}>
                <VolumeIcon />
              </button>
              <Scrubber value={muted ? 0 : volume} max={1} onChange={actions.setVolume} ariaLabel="Volume" />
            </div>

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
          </div>
        </div>

        {panel !== 'none' && (
          <div className="fz-player__panel">
            {panel === 'lyrics' ? <LyricsView song={current} /> : <QueuePanel />}
          </div>
        )}
      </div>
      {menu}
    </div>
  );
}
