/**
 * The full-screen player.
 *
 * The whole surface is lit by the artwork: we pull a palette out of the cover
 * and drive three slow-drifting gradient blobs with it, so the room takes on the
 * colour of whatever is playing.
 *
 * On desktop it is a full-window view with lyrics or the queue beside the art.
 * On a phone it is a sheet you pull down to dismiss, panels cover the art
 * instead of sitting next to it, and the artwork itself can be flicked sideways
 * to change track.
 */

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { LyricsView } from './LyricsView';
import { QueuePanel } from './QueuePanel';
import { Scrubber } from './Scrubber';
import { StarRating } from './StarRating';
import { useContextMenu } from './ContextMenu';
import {
  ChevronDownIcon, CloseIcon, EllipsisIcon, HeartIcon, InfinityIcon, LyricsIcon, MoonIcon,
  NextIcon, PauseIcon, PlayIcon, PreviousIcon, QueueIcon, RepeatIcon,
  RepeatOneIcon, ShuffleIcon, VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon,
} from './Icons';
import { formatTime, qualityBadge, songArtist } from '../lib/format';
import { useIsCompact } from '../hooks/useLayout';
import { useMediaMenu } from '../hooks/useMediaMenu';
import { useAmbient } from '../state/ambient';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';

export type PlayerPanel = 'none' | 'lyrics' | 'queue';

interface FullPlayerProps {
  panel: PlayerPanel;
  onPanelChange: (panel: PlayerPanel) => void;
  onClose: () => void;
}

export function FullPlayer({ panel, onPanelChange, onClose }: FullPlayerProps) {
  const {
    current, playing, currentTime, duration, buffered, volume, muted, shuffle,
    repeat, autoplay, sleepTimer, context, actions,
  } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist, showTrackInfo, sleepTimerSheet } = useDialogs();
  const { songMenu } = useMediaMenu();
  const { openAt, menu } = useContextMenu();
  const navigate = useNavigate();
  const compact = useIsCompact();

  // The palette is already extracted once for the whole app; reuse it so the
  // player and the room behind it are lit by the same source.
  const { palette } = useAmbient();
  const [closing, setClosing] = useState(false);
  const [artNudge, setArtNudge] = useState(0);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const gesture = useRef({ x: 0, y: 0, time: 0, active: false, axis: 'undecided' as 'undecided' | 'x' | 'y' });

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, compact ? 300 : 380);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Bound once on mount; `close` only calls setState and the prop.
  }, []);

  if (!current) return null;

  const starred = isStarred('song', current.id);
  const badge = qualityBadge(current);
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;
  const panelOpen = panel !== 'none';

  /*
   * One gesture covers the whole sheet on a phone: flick sideways to change
   * track, pull down to dismiss. Deciding the axis once — rather than running
   * two competing handlers — is what stops a diagonal drag doing both.
   */
  const onSheetPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!compact || event.pointerType === 'mouse') return;
    gesture.current = { x: event.clientX, y: event.clientY, time: performance.now(), active: true, axis: 'undecided' };
  };

  const onSheetPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;

    if (g.axis === 'undecided') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      event.currentTarget.setPointerCapture(event.pointerId);
      if (g.axis === 'y') setSheetDragging(true);
    }

    if (g.axis === 'x') setArtNudge(dx * 0.45);
    // Only downward pulls the sheet; upward is not a dismissal.
    else setSheetOffset(Math.max(0, dy));
  };

  const onSheetPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    const elapsed = Math.max(1, performance.now() - g.time);
    g.active = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (g.axis === 'x') {
      setArtNudge(0);
      if (Math.abs(dx) > 70 || Math.abs(dx / elapsed) > 0.45) {
        if (dx < 0) actions.next();
        else actions.previous();
      }
      return;
    }

    setSheetDragging(false);
    if (dy > 130 || dy / elapsed > 0.6) close();
    else setSheetOffset(0);
  };

  const sheetHandlers = compact
    ? {
        onPointerDown: onSheetPointerDown,
        onPointerMove: onSheetPointerMove,
        onPointerUp: onSheetPointerUp,
        onPointerCancel: onSheetPointerUp,
      }
    : {};

  return (
    <div
      className={`fz-player ${compact ? 'fz-player--compact fz-player--sheet' : ''} ${closing ? 'is-closing' : ''} ${
        sheetDragging ? '' : 'is-settling'
      }`}
      style={{
        ['--art-primary' as string]: palette.primary,
        ['--art-secondary' as string]: palette.secondary,
        ['--art-tertiary' as string]: palette.tertiary,
        ['--art-background' as string]: palette.background,
        transform: sheetOffset ? `translateY(${sheetOffset}px)` : undefined,
      }}
    >
      <div className="fz-ambient">
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__blob" />
        <div className="fz-ambient__scrim" />
        <div className="fz-ambient__grain" />
      </div>

      {compact && <div className="fz-sheet-grip" />}

      <div className="fz-player__chrome" {...sheetHandlers}>
        <button type="button" className="fz-player__collapse" aria-label="Close player" onClick={close}>
          <ChevronDownIcon />
        </button>
        {context && (
          <div className="fz-player__context">
            {compact ? context.name : `Playing from ${context.kind} · ${context.name}`}
          </div>
        )}
        {!compact && <div className="fz-player__chrome-spacer" />}
        {badge && !compact && (
          <span
            className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : badge.lossless ? 'fz-badge--lossless' : ''}`}
            title={badge.detail}
          >
            {badge.label} · {badge.detail}
          </span>
        )}
        {compact && (
          <button
            type="button"
            className="fz-player__collapse"
            aria-label={`More options for ${current.title}`}
            onClick={(event) =>
              openAt(event.currentTarget, songMenu(current, {
                onRequestAddToPlaylist: addToPlaylist,
                onShowInfo: showTrackInfo,
                context: context ?? undefined,
              }), { title: current.title, subtitle: songArtist(current) })
            }
          >
            <EllipsisIcon />
          </button>
        )}
      </div>

      <div className={`fz-player__body ${panelOpen && !compact ? 'has-panel' : ''}`}>
        {/* On a phone the panel covers the stage, so the stage stays mounted
            underneath and simply hides — no remount, no artwork reload. */}
        <div
          className="fz-player__stage"
          style={compact && panelOpen ? { visibility: 'hidden' } : undefined}
          {...(panelOpen ? {} : sheetHandlers)}
        >
          <div
            style={{
              width: '100%',
              transform: artNudge ? `translateX(${artNudge}px)` : undefined,
              touchAction: compact ? 'none' : undefined,
            }}
          >
            <Artwork
              coverArt={current.coverArt}
              name={current.title}
              size={800}
              className={`fz-player__art ${playing ? 'is-playing' : ''}`}
            />
          </div>

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
              style={{ color: starred ? '#fff' : 'rgba(255,255,255,0.6)', width: 40, height: 40 }}
              aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
              onClick={() => void toggleStar('song', current.id)}
            >
              <HeartIcon filled={starred} />
            </button>
            {!compact && (
              <button
                type="button"
                className="fz-icon-btn"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                aria-label={`More options for ${current.title}`}
                onClick={(event) =>
                  openAt(event.currentTarget, songMenu(current, {
                    onRequestAddToPlaylist: addToPlaylist,
                    onShowInfo: showTrackInfo,
                    context: context ?? undefined,
                  }))
                }
              >
                <EllipsisIcon />
              </button>
            )}
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
              {compact && badge && (
                <span style={{ opacity: 0.75, letterSpacing: '0.03em' }}>
                  {badge.label.toUpperCase()}
                </span>
              )}
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

          {!compact && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <StarRating song={current} />
            </div>
          )}

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
            <button
              type="button"
              className={`fz-icon-btn ${autoplay ? 'is-on' : ''}`}
              aria-label="Autoplay similar songs"
              aria-pressed={autoplay}
              title="Keep playing similar music when the queue runs out"
              onClick={actions.toggleAutoplay}
            >
              <InfinityIcon />
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${sleepTimer ? 'is-on' : ''}`}
              aria-label="Sleep timer"
              onClick={sleepTimerSheet}
            >
              <MoonIcon />
            </button>

            {!compact && (
              <div className="fz-volume" style={{ flex: 1, maxWidth: 150 }}>
                <button type="button" className="fz-icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={actions.toggleMute}>
                  <VolumeIcon />
                </button>
                <Scrubber value={muted ? 0 : volume} max={1} onChange={actions.setVolume} ariaLabel="Volume" />
              </div>
            )}

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

        {panelOpen && (
          <div className="fz-player__panel">
            {/* With the stage hidden on a phone, these are the only way to move
                between lyrics, the queue and the artwork. */}
            {compact && (
              <div className="fz-player__panel-tabs">
                <div className="fz-segmented">
                  <button
                    type="button"
                    className={panel === 'lyrics' ? 'is-active' : ''}
                    onClick={() => onPanelChange('lyrics')}
                  >
                    Lyrics
                  </button>
                  <button
                    type="button"
                    className={panel === 'queue' ? 'is-active' : ''}
                    onClick={() => onPanelChange('queue')}
                  >
                    Up Next
                  </button>
                </div>
                <button
                  type="button"
                  className="fz-icon-btn"
                  aria-label="Back to artwork"
                  onClick={() => onPanelChange('none')}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            {panel === 'lyrics' ? <LyricsView song={current} /> : <QueuePanel />}
          </div>
        )}
      </div>

      {/* With a panel covering the art on a phone, the transport moves to a dock. */}
      {compact && panelOpen && (
        <div className="fz-player__dock">
          <Artwork coverArt={current.coverArt} name={current.title} size={120} className="fz-player__dock-art" />
          <div style={{ minWidth: 0 }}>
            <div className="fz-truncate" style={{ fontSize: 14, fontWeight: 600 }}>{current.title}</div>
            <div className="fz-truncate" style={{ fontSize: 12, opacity: 0.65 }}>{songArtist(current)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button type="button" className="fz-mini__btn" aria-label={playing ? 'Pause' : 'Play'} onClick={actions.toggle}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="fz-mini__btn" aria-label="Next" onClick={actions.next}>
              <NextIcon />
            </button>

          </div>
        </div>
      )}
      {menu}
    </div>
  );
}
