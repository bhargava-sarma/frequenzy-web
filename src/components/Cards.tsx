/**
 * Album / artist / playlist cards, plus the horizontally scrolling shelf.
 *
 * Every card carries its own colour. The palette is lifted from the cover as
 * the card nears the viewport and published as `--card-glow` / `--card-deep`,
 * so a red record throws a red shadow and a blue one a blue shadow — which is
 * most of why a wall of Apple Music covers looks alive rather than like a
 * spreadsheet of thumbnails.
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react';

import { Artwork } from './Artwork';
import { useContextMenu } from './ContextMenu';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from './Icons';
import { albumArtist, formatCount } from '../lib/format';
import { getAlbum } from '../lib/subsonic';
import type { Album, Artist, Playlist } from '../lib/types';
import { useDialogs } from '../state/dialogs';
import { usePlayer } from '../state/player';
import { useGlassPointer } from '../hooks/useGlassPointer';
import { useIsTouch } from '../hooks/useLayout';
import { useMediaMenu } from '../hooks/useMediaMenu';
import { usePalette } from '../hooks/usePalette';
import { MORPH_NAME, morphFrom, useSmoothNavigate } from '../hooks/useSmoothNavigate';

/* --------------------------------------------------------------------- shelf */

export function Shelf({ title, link, onLink, children, wide }: {
  title: string;
  link?: string;
  onLink?: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth > el.scrollWidth - 8);
  };

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.82, behavior: 'smooth' });
  };

  return (
    <section className="fz-section">
      <div className="fz-section__head">
        <h2 className="fz-section__title">{title}</h2>
        {link && (
          <button type="button" className="fz-section__link" onClick={onLink}>
            {link}
          </button>
        )}
        <div className="fz-section__arrows">
          <button type="button" className="fz-icon-btn" aria-label="Scroll left" disabled={atStart} onClick={() => scrollBy(-1)}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="fz-icon-btn" aria-label="Scroll right" disabled={atEnd} onClick={() => scrollBy(1)}>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div
        className={`fz-hscroll fz-shelf-scroll ${atStart ? 'is-at-start' : ''} ${atEnd ? 'is-at-end' : ''}`}
        ref={scroller}
        onScroll={updateEdges}
      >
        <div className={`fz-shelf fz-stagger ${wide ? 'fz-shelf--wide' : ''}`}>{children}</div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- the frame */

/**
 * The shared shell: colour extraction, the lean toward the cursor, and the
 * morph hand-off. A card is a card whatever it holds.
 */
function CardFrame({
  coverArt, onOpen, onContextMenu, children, className = '',
}: {
  coverArt?: string;
  onOpen: (art: HTMLElement | null) => void;
  onContextMenu?: (event: MouseEvent) => void;
  children: (artRef: (node: HTMLDivElement | null) => void) => ReactNode;
  className?: string;
}) {
  const touch = useIsTouch();
  const { palette, ref: paletteRef } = usePalette(coverArt);
  // A finger has no hover, so the lean would only ever fire on tap.
  const glass = useGlassPointer<HTMLDivElement>({ tilt: touch ? 0 : 3 });
  const art = useRef<HTMLDivElement | null>(null);

  const setCard = (node: HTMLDivElement | null) => {
    glass.ref.current = node;
    paletteRef(node);
  };

  return (
    <div
      ref={setCard}
      className={`fz-card ${className}`}
      role="button"
      tabIndex={0}
      style={{
        ['--card-glow' as string]: palette.glow,
        ['--card-deep' as string]: palette.darkVibrant,
      }}
      onPointerMove={touch ? undefined : glass.onPointerMove}
      onPointerLeave={touch ? undefined : glass.onPointerLeave}
      onClick={() => onOpen(art.current)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(art.current);
      }}
      onContextMenu={onContextMenu}
    >
      {children((node) => {
        art.current = node;
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- album card */

export function AlbumCard({ album, subtitle }: { album: Album; subtitle?: string }) {
  const navigate = useSmoothNavigate();
  const { actions } = usePlayer();
  const { addToPlaylist } = useDialogs();
  const { albumMenu } = useMediaMenu();
  const { open, menu } = useContextMenu();

  /** Album lists come back without tracks, so fetch them at the moment of play. */
  const loadSongs = async () => {
    const full = await getAlbum(album.id);
    return full.song ?? [];
  };

  const handlePlay = async (event: MouseEvent) => {
    event.stopPropagation();
    const songs = await loadSongs();
    if (songs.length) actions.playQueue(songs, 0, { kind: 'Album', name: album.name, id: album.id });
  };

  const handleMenu = async (event: MouseEvent) => {
    event.preventDefault();
    const songs = await loadSongs();
    open(event, albumMenu(album, songs, addToPlaylist));
  };

  return (
    <>
      <CardFrame
        coverArt={album.coverArt}
        onContextMenu={(event) => void handleMenu(event)}
        onOpen={(art) => {
          // Hand the cover to the next screen so it flies rather than blinks.
          morphFrom(art);
          navigate(`/album/${encodeURIComponent(album.id)}`);
        }}
      >
        {(artRef) => (
          <>
            <Artwork ref={artRef} coverArt={album.coverArt} name={album.name} size={400} className="fz-card__art">
              <button
                type="button"
                className="fz-play-overlay"
                aria-label={`Play ${album.name}`}
                onClick={(event) => void handlePlay(event)}
              >
                <PlayIcon />
              </button>
            </Artwork>
            <div className="fz-card__meta">
              <div className="fz-card__title fz-clamp-2">{album.name}</div>
              <div className="fz-card__subtitle fz-truncate">{subtitle ?? albumArtist(album)}</div>
            </div>
          </>
        )}
      </CardFrame>
      {menu}
    </>
  );
}

/* --------------------------------------------------------------- artist card */

export function ArtistCard({ artist }: { artist: Artist }) {
  const navigate = useSmoothNavigate();
  const { artistMenu } = useMediaMenu();
  const { open, menu } = useContextMenu();
  const cover = artist.coverArt ?? artist.id;

  return (
    <>
      <CardFrame
        coverArt={cover}
        className="fz-card--round"
        onContextMenu={(event) => open(event, artistMenu(artist))}
        onOpen={(art) => {
          morphFrom(art);
          navigate(`/artist/${encodeURIComponent(artist.id)}`);
        }}
      >
        {(artRef) => (
          <>
            <Artwork ref={artRef} coverArt={cover} name={artist.name} size={400} rounded className="fz-card__art" />
            <div className="fz-card__meta fz-card__meta--center">
              <div className="fz-card__title fz-truncate">{artist.name}</div>
              <div className="fz-card__subtitle fz-truncate">{formatCount(artist.albumCount, 'album')}</div>
            </div>
          </>
        )}
      </CardFrame>
      {menu}
    </>
  );
}

/* ------------------------------------------------------------- playlist card */

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const navigate = useSmoothNavigate();
  return (
    <CardFrame
      coverArt={playlist.coverArt}
      onOpen={(art) => {
        morphFrom(art);
        navigate(`/playlist/${encodeURIComponent(playlist.id)}`);
      }}
    >
      {(artRef) => (
        <>
          <Artwork ref={artRef} coverArt={playlist.coverArt} name={playlist.name} size={400} className="fz-card__art" />
          <div className="fz-card__meta">
            <div className="fz-card__title fz-clamp-2">{playlist.name}</div>
            <div className="fz-card__subtitle fz-truncate">{formatCount(playlist.songCount, 'song')}</div>
          </div>
        </>
      )}
    </CardFrame>
  );
}

/* ------------------------------------------------------------------ skeleton */

export function CardSkeleton({ rounded }: { rounded?: boolean }) {
  return (
    <div className="fz-card" aria-hidden="true">
      <div className="fz-skeleton" style={{ aspectRatio: '1', borderRadius: rounded ? '50%' : 'var(--radius-md)' }} />
      <div className="fz-card__meta">
        <div className="fz-skeleton" style={{ height: 11, width: '78%', marginBottom: 6 }} />
        <div className="fz-skeleton" style={{ height: 10, width: '52%' }} />
      </div>
    </div>
  );
}

export { MORPH_NAME };
