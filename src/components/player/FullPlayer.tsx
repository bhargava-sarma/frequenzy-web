/**
 * The full-screen player.
 *
 * Desktop: the record on the left — artwork, or the tape deck — with the
 * transport under it, and lyrics, the queue or the details beside it.
 * Phone: a sheet you pull down to dismiss; flick the artwork sideways to skip;
 * lyrics and the queue replace the artwork rather than squeezing in beside it.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { Artwork } from '../Artwork';
import { FKey, Marquee, Segmented, Slider } from '../controls';
import {
  ArtworkIcon, ChevronDownIcon, EllipsisIcon, HeartIcon, InfinityIcon, InfoIcon, LoopIcon, LyricsIcon, MoonIcon,
  QueueIcon, SpeedIcon, TapeIcon, VolumeHighIcon, VolumeLowIcon, VolumeMuteIcon,
} from '../Icons';
import { Elapsed, FormatReadout, Remaining, Scrubber, StatusFlags } from './Display';
import { LyricsView } from './LyricsView';
import { QueueList } from './QueueList';
import { TapeDeck } from './TapeDeck';
import { Transport } from './Transport';
import { TrackDetails } from '../TrackDetails';
import { songArtist } from '../../lib/format';
import { navigate } from '../../lib/nav';
import { useArtworkPalette } from '../../hooks/useData';
import { useIsCompact } from '../../hooks/useLayout';
import * as act from '../../state/actions';
import { useIsStarred } from '../../state/library';
import { songHeader, songMenu } from '../../state/menus';
import { player, usePlayer } from '../../state/player';
import { updateSettings, useSetting } from '../../state/settings';
import { haptic, ui, uiStore, useUI, type MenuEntry, type PlayerTab } from '../../state/ui';

const SPEEDS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function speedMenu(): MenuEntry[] {
  const rate = player.store.get().rate;
  return SPEEDS.map((value) => ({
    id: `rate-${value}`,
    label: `${value.toFixed(2)}×${value === 1 ? ' · normal' : ''}`,
    checked: Math.abs(rate - value) < 0.001,
    onSelect: () => player.setRate(value),
  }));
}

export function FullPlayerHost() {
  const open = useUI((s) => s.fullPlayer);
  const hasCurrent = usePlayer((s) => s.current !== null);
  useEffect(() => {
    if (open && !hasCurrent) ui.closeFullPlayer();
  }, [hasCurrent, open]);
  useEffect(() => {
    document.documentElement.dataset.player = open && hasCurrent ? 'open' : 'closed';
  }, [hasCurrent, open]);
  if (!open || !hasCurrent) return null;
  return <FullPlayer />;
}

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!enabled || !nav.wakeLock) return;
    let lock: { release: () => Promise<void> } | null = null;
    let alive = true;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(
        (l) => {
          if (alive) lock = l;
          else void l.release();
        },
        () => {},
      );
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}

function FullPlayer() {
  const current = usePlayer((s) => s.current)!;
  const context = usePlayer((s) => s.context);
  const tab = useUI((s) => s.playerTab);
  const compact = useIsCompact();
  const display = useSetting('playerDisplay');
  const tint = useSetting('artworkTint');
  const keepAwake = useSetting('keepScreenOn');
  const palette = useArtworkPalette(current.coverArt, tint);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [nudge, setNudge] = useState(0);
  const gesture = useRef({ x: 0, y: 0, t: 0, active: false, axis: 'none' as 'none' | 'x' | 'y', fromArt: false });
  useWakeLock(keepAwake);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => ui.closeFullPlayer(), 220);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A dialog, menu or the palette over the player closes first.
      const state = uiStore.get();
      if (state.dialog || state.menu || state.palette) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);

  // Give focus back to whatever had it when the player opened.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  const panelOpen = compact && tab !== 'none';

  /* --------------------------------------------------- phone gestures */

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!compact || event.pointerType === 'mouse') return;
    const target = event.target as HTMLElement;
    if (target.closest('button, [role="slider"], .lyrics__scroll, .queue__scroll, input, a')) return;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      active: true,
      axis: 'none',
      fromArt: Boolean(target.closest('.fp__display')),
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (g.axis === 'none') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (g.axis === 'x' && !g.fromArt) {
        g.active = false;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (g.axis === 'x') setNudge(dx * 0.5);
    else setDrag(Math.max(0, dy));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    const elapsed = Math.max(1, performance.now() - g.t);
    if (g.axis === 'x') {
      setNudge(0);
      if (Math.abs(dx) > 70 || Math.abs(dx / elapsed) > 0.5) {
        haptic(8);
        if (dx < 0) player.next();
        else player.previous();
      }
      return;
    }
    if (g.axis === 'y') {
      if (dy > 120 || dy / elapsed > 0.7) {
        setDrag(window.innerHeight);
        close();
      } else {
        setDrag(0);
      }
    }
  };

  const style = {
    ...(tint
      ? {
          '--fp-tint': palette.darkVibrant,
          '--fp-glow': palette.vibrant,
        }
      : null),
    ...(drag ? { transform: `translate3d(0, ${drag}px, 0)` } : null),
  } as CSSProperties;

  return (
    <div
      className={`fp ${compact ? 'fp--compact' : 'fp--wide'} ${closing ? 'is-closing' : ''} ${drag ? 'is-dragging' : ''} ${
        panelOpen ? 'has-panel' : ''
      } ${tint ? 'is-tinted' : ''}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="fp__bg" aria-hidden="true" />
      {compact && <div className="fp__grip" aria-hidden="true" />}

      <header className="fp__bar">
        <button type="button" className="ibtn ibtn--lg" aria-label="Close the player" onClick={close}>
          <ChevronDownIcon />
        </button>
        <div className="fp__from">
          {context ? (
            <>
              <span className="label">playing from {context.kind.toLowerCase()}</span>
              {context.route ? (
                <button
                  type="button"
                  className="fp__from-name truncate"
                  onClick={() => {
                    close();
                    navigate(context.route!);
                  }}
                >
                  {context.name}
                </button>
              ) : (
                <span className="fp__from-name truncate">{context.name}</span>
              )}
            </>
          ) : (
            <span className="label">now playing</span>
          )}
        </div>
        {!compact && (
          <Segmented
            label="Display"
            small
            value={display}
            onChange={(value) => updateSettings({ playerDisplay: value })}
            options={[
              { value: 'art', label: <ArtworkIcon />, title: 'Artwork' },
              { value: 'tape', label: <TapeIcon />, title: 'Tape' },
            ]}
          />
        )}
        <button
          type="button"
          className="ibtn ibtn--lg"
          aria-label="More"
          onClick={(event) =>
            ui.openMenu(
              [
                ...songMenu(current, { context: context ?? undefined }),
                { id: 'fp-s', separator: true },
                {
                  id: 'fp-display',
                  label: display === 'tape' ? 'show artwork' : 'show the tape',
                  icon: display === 'tape' ? <ArtworkIcon /> : <TapeIcon />,
                  onSelect: () => updateSettings({ playerDisplay: display === 'tape' ? 'art' : 'tape' }),
                },
                { id: 'fp-speed', label: 'playback speed', icon: <SpeedIcon />, submenu: speedMenu },
                { id: 'fp-loop', label: 'a–b loop', icon: <LoopIcon />, onSelect: () => player.cycleLoop() },
              ],
              event.currentTarget,
              songHeader(current),
            )
          }
        >
          <EllipsisIcon />
        </button>
      </header>

      <div className="fp__body">
        <section className="fp__main">
          {panelOpen ? (
            <div className="fp__panel">
              {tab === 'lyrics' &&
                (current.isRadio ? (
                  <div className="fp__panel-empty">radio has no lyrics</div>
                ) : (
                  <LyricsView key={current.id} song={current} variant="full" />
                ))}
              {tab === 'queue' && <QueueList variant="full" />}
            </div>
          ) : (
            <div className="fp__display" style={nudge ? { transform: `translate3d(${nudge}px, 0, 0)` } : undefined}>
              {display === 'tape' ? (
                <TapeDeck />
              ) : (
                <Artwork key={current.coverArt ?? current.id} coverArt={current.coverArt} name={current.title} size={compact ? 360 : 560} className="fp__art" eager />
              )}
            </div>
          )}

          <Meta panel={panelOpen} />

          <div className="fp__scrub">
            <Scrubber large />
            <div className="fp__times">
              <Elapsed />
              <FormatReadout />
              <Remaining />
            </div>
          </div>

          <Transport size="lg" />
          <Utilities compact={compact} tab={tab} />
        </section>

        {!compact && <SidePanel />}
      </div>
    </div>
  );
}

function Meta({ panel }: { panel: boolean }) {
  const current = usePlayer((s) => s.current)!;
  const starred = useIsStarred('song', current.isRadio ? undefined : current.id);
  return (
    <div className={`fp__meta ${panel ? 'is-small' : ''}`}>
      {panel && <Artwork coverArt={current.coverArt} name={current.title} size={48} className="fp__thumb" />}
      <div className="fp__titles">
        <Marquee className="fp__title" key={current.id}>
          {current.title}
        </Marquee>
        <div className="fp__artist truncate">
          {current.artistId ? (
            <button
              type="button"
              className="fp__link"
              onClick={() => {
                ui.closeFullPlayer();
                act.goToArtist(current);
              }}
            >
              {songArtist(current)}
            </button>
          ) : (
            songArtist(current)
          )}
          {current.album && !panel && (
            <>
              <span className="fp__dot"> · </span>
              {current.albumId ? (
                <button
                  type="button"
                  className="fp__link"
                  onClick={() => {
                    ui.closeFullPlayer();
                    act.goToAlbum(current);
                  }}
                >
                  {current.album}
                </button>
              ) : (
                current.album
              )}
            </>
          )}
        </div>
      </div>
      {!current.isRadio && (
        <button
          type="button"
          className={`ibtn ibtn--lg fp__heart ${starred ? 'is-on' : ''}`}
          aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={starred}
          onClick={() => void act.toggleFavourite('song', current.id)}
        >
          <HeartIcon filled={starred} />
        </button>
      )}
    </div>
  );
}

function Utilities({ compact, tab }: { compact: boolean; tab: PlayerTab }) {
  const sleep = usePlayer((s) => s.sleep);
  const loop = usePlayer((s) => s.loop);
  const autoplay = usePlayer((s) => s.autoplay);
  const rate = usePlayer((s) => s.rate);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const volumeControl = usePlayer((s) => s.volumeControl);
  const VolumeIcon = muted || volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div className="fp__utils">
      {compact && (
        <>
          <FKey icon={<LyricsIcon />} label="lyrics" on={tab === 'lyrics'} onClick={() => ui.setPlayerTab(tab === 'lyrics' ? 'none' : 'lyrics')} />
          <FKey icon={<QueueIcon />} label="queue" on={tab === 'queue'} onClick={() => ui.setPlayerTab(tab === 'queue' ? 'none' : 'queue')} />
        </>
      )}
      <FKey icon={<MoonIcon />} label="sleep" on={sleep !== null} onClick={() => ui.openDialog({ type: 'sleep' })} />
      <FKey
        icon={<SpeedIcon />}
        label={rate === 1 ? 'speed' : `${rate.toFixed(2)}×`}
        on={rate !== 1}
        onClick={(event) => ui.openMenu(speedMenu(), event.currentTarget, { title: 'playback speed' })}
      />
      <FKey
        icon={<LoopIcon />}
        label={loop ? (loop.b === null ? 'a–' : 'a–b') : 'loop'}
        on={loop !== null}
        blink={loop !== null && loop.b === null}
        onClick={() => player.cycleLoop()}
      />
      <FKey icon={<InfinityIcon />} label="auto" on={autoplay} onClick={() => player.toggleAutoplay()} />
      {!compact && <StatusFlags className="fp__flags" />}
      {volumeControl && (
        <div className="fp__volume">
          <button type="button" className="ibtn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => player.toggleMute()}>
            <VolumeIcon />
          </button>
          <Slider
            value={muted ? 0 : volume}
            max={1}
            step={0.02}
            live
            label="Volume"
            onChange={(value) => player.setVolume(value)}
            format={(value) => `${Math.round(value * 100)}`}
          />
        </div>
      )}
    </div>
  );
}

function SidePanel() {
  const current = usePlayer((s) => s.current)!;
  const tab = useUI((s) => s.playerTab);
  const side: 'lyrics' | 'queue' = tab === 'queue' ? 'queue' : 'lyrics';
  const [view, setView] = useState<'lyrics' | 'queue' | 'info'>(side);
  useEffect(() => setView(side), [side]);

  return (
    <section className="fp__side">
      <div className="fp__side-tabs">
        <Segmented
          label="Panel"
          value={view}
          onChange={(value) => {
            setView(value);
            if (value !== 'info') ui.setPlayerTab(value);
          }}
          options={[
            { value: 'lyrics', label: <><LyricsIcon /> lyrics</> },
            { value: 'queue', label: <><QueueIcon /> queue</> },
            { value: 'info', label: <><InfoIcon /> info</> },
          ]}
        />
      </div>
      <div className="fp__side-body">
        {view === 'lyrics' &&
          (current.isRadio ? <div className="fp__panel-empty">radio has no lyrics</div> : <LyricsView key={current.id} song={current} variant="full" />)}
        {view === 'queue' && <QueueList variant="full" />}
        {view === 'info' && (
          <div className="fp__side-scroll">
            <TrackDetails key={current.id} song={current} />
          </div>
        )}
      </div>
    </section>
  );
}
