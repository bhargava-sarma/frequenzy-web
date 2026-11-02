/**
 * The deck: the desktop's transport, docked along the bottom.
 *
 * Left, the screen — artwork, a scrolling title, the format and the status
 * flags; click it for the full-screen player. Centre, the transport over the
 * scrubber. Right, the panel keys and the volume knob.
 */

import { Artwork } from '../Artwork';
import { FKey, Knob, Marquee } from '../controls';
import {
  ChevronUpIcon, EllipsisIcon, HeartIcon, InfinityIcon, InfoIcon, LyricsIcon, QueueIcon,
} from '../Icons';
import { Clock, Elapsed, FormatReadout, IdleLine, Remaining, Scrubber, StatusFlags } from '../player/Display';
import { Transport } from '../player/Transport';
import { songArtist } from '../../lib/format';
import { navigate } from '../../lib/nav';
import * as act from '../../state/actions';
import { useIsStarred } from '../../state/library';
import { songHeader, songMenu } from '../../state/menus';
import { player, usePlayer } from '../../state/player';
import { ui, useUI } from '../../state/ui';

export function Deck() {
  return (
    <footer className="deck" aria-label="Now playing">
      <DeckScreen />
      <div className="deck__center">
        <Transport />
        <div className="deck__scrub">
          <Elapsed className="deck__time" />
          <Scrubber />
          <Remaining className="deck__time deck__time--end" />
        </div>
      </div>
      <DeckAux />
    </footer>
  );
}

function DeckScreen() {
  const current = usePlayer((s) => s.current);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const context = usePlayer((s) => s.context);

  if (!current) {
    return (
      <div className="deck__screen lcd lcd--idle">
        <div className="lcd__art lcd__art--idle" aria-hidden="true">
          <span className="lcd__logo">fz</span>
        </div>
        <div className="lcd__text">
          <Clock className="lcd__title lcd__clock" />
          <div className="lcd__sub">
            <IdleLine />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="deck__screen lcd"
      role="button"
      tabIndex={0}
      aria-label="Open the full-screen player"
      onClick={() => ui.openFullPlayer()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') ui.openFullPlayer();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        ui.openMenu(songMenu(current, { context: context ?? undefined }), { x: event.clientX, y: event.clientY }, songHeader(current));
      }}
    >
      <Artwork key={current.coverArt ?? current.id} coverArt={current.coverArt} name={current.title} size={60} className="lcd__art" eager />
      <div className="lcd__text">
        <Marquee className="lcd__title" key={current.id}>
          {current.title}
        </Marquee>
        <div className="lcd__sub truncate">
          {current.artistId ? (
            <button
              type="button"
              className="lcd__link"
              onClick={(event) => {
                event.stopPropagation();
                act.goToArtist(current);
              }}
            >
              {songArtist(current)}
            </button>
          ) : (
            songArtist(current)
          )}
          {current.album && (
            <>
              <span className="lcd__dot">·</span>
              {current.albumId ? (
                <button
                  type="button"
                  className="lcd__link"
                  onClick={(event) => {
                    event.stopPropagation();
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
        <div className="lcd__status">
          <span className={`lcd__state ${buffering && playing ? 'is-buffering' : ''}`}>
            {buffering && playing ? '◌' : playing ? '▶' : '❚❚'}
          </span>
          <FormatReadout />
          <StatusFlags />
          {context?.route && (
            <button
              type="button"
              className="lcd__from truncate"
              onClick={(event) => {
                event.stopPropagation();
                navigate(context.route!);
              }}
            >
              {context.kind.toLowerCase()} · {context.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeckAux() {
  const current = usePlayer((s) => s.current);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const autoplay = usePlayer((s) => s.autoplay);
  const volumeControl = usePlayer((s) => s.volumeControl);
  const inspector = useUI((s) => s.inspector);
  const starred = useIsStarred('song', current?.isRadio ? undefined : current?.id);
  const context = usePlayer((s) => s.context);

  return (
    <div className="deck__aux">
      <FKey
        icon={<HeartIcon filled={starred} />}
        label="fav"
        className="deck__opt"
        on={starred}
        disabled={!current || current.isRadio}
        title={starred ? 'Remove from favourites (H)' : 'Add to favourites (H)'}
        onClick={() => current && void act.toggleFavourite('song', current.id)}
      />
      <FKey
        icon={<InfinityIcon />}
        label="auto"
        className="deck__opt"
        on={autoplay}
        title="Autoplay similar music when the queue ends (A)"
        onClick={() => player.toggleAutoplay()}
      />
      <span className="deck__sep deck__opt" aria-hidden="true" />
      <FKey icon={<LyricsIcon />} label="lyr" on={inspector === 'lyrics'} title="Lyrics (L)" onClick={() => ui.toggleInspector('lyrics')} />
      <FKey icon={<QueueIcon />} label="queue" on={inspector === 'queue'} title="Queue (Q)" onClick={() => ui.toggleInspector('queue')} />
      <FKey icon={<InfoIcon />} label="info" className="deck__opt" on={inspector === 'info'} title="Track info" onClick={() => ui.toggleInspector('info')} />
      <button
        type="button"
        className="ibtn"
        aria-label="More"
        disabled={!current}
        onClick={(event) => current && ui.openMenu(songMenu(current, { context: context ?? undefined }), event.currentTarget, songHeader(current))}
      >
        <EllipsisIcon />
      </button>
      {volumeControl && (
        <Knob
          value={volume}
          muted={muted}
          label="vol"
          title="Volume — drag, scroll or use the arrow keys; double-click to mute"
          onChange={(value) => player.setVolume(value)}
          onToggleMute={() => player.toggleMute()}
        />
      )}
      <button
        type="button"
        className="ibtn"
        aria-label="Open the full-screen player"
        disabled={!current}
        title="Full screen (F)"
        onClick={() => ui.openFullPlayer()}
      >
        <ChevronUpIcon />
      </button>
    </div>
  );
}
