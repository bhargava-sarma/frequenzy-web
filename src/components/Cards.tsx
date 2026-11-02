/**
 * Album, artist and playlist cards, coloured tiles, and the shelf that
 * scrolls them sideways.
 *
 * A card opens on click, plays from the key in its corner, offers its menu on
 * right-click or long-press, prefetches its page on hover so opening it is
 * instant, and can be dragged onto a playlist.
 */

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { Artwork } from './Artwork';
import { ChevronLeftIcon, ChevronRightIcon, EllipsisIcon, PlayIcon } from './Icons';
import { endDrag, startDrag } from '../lib/dnd';
import { albumArtist, formatCount } from '../lib/format';
import { navigate } from '../lib/nav';
import { prefetchAlbum, prefetchArtist, prefetchPlaylist } from '../lib/queries';
import { artistCover } from '../lib/song';
import type { Album, Artist, Playlist } from '../lib/types';
import { useIsTouch } from '../hooks/useLayout';
import { useItemMenu } from '../hooks/useItemMenu';
import * as act from '../state/actions';
import {
  albumHeader, albumMenu, artistHeader, artistMenu, playlistHeader, playlistMenu,
} from '../state/menus';

const CARD_ART = 200;

/* --------------------------------------------------------------- the frame */

interface CardFrameProps {
  onOpen: () => void;
  onPlay?: () => void;
  onPrefetch?: () => void;
  menu: ReturnType<typeof useItemMenu>;
  drag?: Parameters<typeof startDrag>[1];
  className?: string;
  label: string;
  art: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  round?: boolean;
}

function CardFrame({ onOpen, onPlay, onPrefetch, menu, drag, className = '', label, art, title, subtitle, round }: CardFrameProps) {
  const touch = useIsTouch();
  return (
    <div
      className={`card ${round ? 'card--round' : ''} ${className}`}
      role="link"
      tabIndex={0}
      aria-label={label}
      draggable={!touch && drag !== undefined}
      onDragStart={drag ? (event) => startDrag(event, drag) : undefined}
      onDragEnd={endDrag}
      onClick={() => {
        if (menu.consumeClick()) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      {...menu.handlers}
    >
      <div className="card__art-wrap">
        {art}
        {!touch && (
          <>
            {onPlay && (
              <button
                type="button"
                className="card__play"
                aria-label={`Play ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlay();
                }}
              >
                <PlayIcon />
              </button>
            )}
            <button
              type="button"
              className="card__more"
              aria-label={`More for ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                menu.openFrom(event.currentTarget);
              }}
            >
              <EllipsisIcon />
            </button>
          </>
        )}
      </div>
      <div className="card__meta">
        <div className={`card__title ${round ? 'truncate' : 'clamp-2'}`}>{title}</div>
        {subtitle && <div className="card__sub truncate">{subtitle}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ cards */

export const AlbumCard = memo(function AlbumCard({ album, subtitle }: { album: Album; subtitle?: string }) {
  const menu = useItemMenu(() => ({ entries: albumMenu(album), header: albumHeader(album) }));
  const id = encodeURIComponent(album.id);
  return (
    <CardFrame
      label={album.name}
      menu={menu}
      drag={{ kind: 'album', album }}
      onOpen={() => navigate(`/album/${id}`)}
      onPlay={() => void act.playAlbum(album)}
      onPrefetch={() => prefetchAlbum(album.id)}
      art={<Artwork coverArt={album.coverArt} name={album.name} size={CARD_ART} className="card__art" />}
      title={album.name}
      subtitle={subtitle ?? albumArtist(album)}
    />
  );
});

export const ArtistCard = memo(function ArtistCard({ artist, subtitle }: { artist: Artist; subtitle?: string }) {
  const menu = useItemMenu(() => ({ entries: artistMenu(artist), header: artistHeader(artist) }));
  const id = encodeURIComponent(artist.id);
  return (
    <CardFrame
      round
      label={artist.name}
      menu={menu}
      drag={{ kind: 'artist', artist }}
      onOpen={() => navigate(`/artist/${id}`)}
      onPlay={() => void act.playArtist(artist, { shuffle: true })}
      onPrefetch={() => prefetchArtist(artist.id)}
      art={<Artwork coverArt={artistCover(artist)} name={artist.name} size={CARD_ART} round className="card__art" />}
      title={artist.name}
      subtitle={subtitle ?? (artist.albumCount !== undefined ? formatCount(artist.albumCount, 'album') : undefined)}
    />
  );
});

export const PlaylistCard = memo(function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const menu = useItemMenu(() => ({ entries: playlistMenu(playlist), header: playlistHeader(playlist) }));
  const id = encodeURIComponent(playlist.id);
  return (
    <CardFrame
      label={playlist.name}
      menu={menu}
      drag={{ kind: 'playlist', playlist }}
      onOpen={() => navigate(`/playlist/${id}`)}
      onPlay={() => void act.playPlaylist(playlist)}
      onPrefetch={() => prefetchPlaylist(playlist.id)}
      art={<Artwork coverArt={playlist.coverArt} name={playlist.name} size={CARD_ART} className="card__art" />}
      title={playlist.name}
      subtitle={formatCount(playlist.songCount, 'song')}
    />
  );
});

export function CardSkeleton({ round }: { round?: boolean }) {
  return (
    <div className={`card card--skeleton ${round ? 'card--round' : ''}`} aria-hidden="true">
      <div className="card__art-wrap">
        <div className="skeleton card__art" />
      </div>
      <div className="card__meta">
        <div className="skeleton" style={{ height: 12, width: '76%', marginBottom: 7 }} />
        <div className="skeleton" style={{ height: 10, width: '48%' }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tiles */

const TILE_COLOURS = ['orange', 'blue', 'green', 'yellow', 'grey', 'red', 'pink', 'ink'] as const;

export function tileColour(seed: string): (typeof TILE_COLOURS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TILE_COLOURS[Math.abs(hash) % TILE_COLOURS.length];
}

/** A coloured square for genres, stations and other things without artwork. */
export function Tile({
  title, subtitle, index, icon, colour, onClick, onPlay, style,
}: {
  title: string;
  subtitle?: string;
  index?: number;
  icon?: ReactNode;
  colour?: (typeof TILE_COLOURS)[number];
  onClick: () => void;
  onPlay?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`tile tile--${colour ?? tileColour(title)}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      style={style}
    >
      <div className="tile__top">
        {index !== undefined && <span className="tile__index">{String(index).padStart(2, '0')}</span>}
        {icon && <span className="tile__icon">{icon}</span>}
      </div>
      <div className="tile__bottom">
        <div className="tile__title clamp-2">{title}</div>
        {subtitle && <div className="tile__sub truncate">{subtitle}</div>}
      </div>
      {onPlay && (
        <button
          type="button"
          className="tile__play"
          aria-label={`Play ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onPlay();
          }}
        >
          <PlayIcon />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ shelf */

/** A row of cards that scrolls sideways, with page keys on a desktop. */
export function Shelf({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const touch = useIsTouch();

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft < 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure, children]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className={`shelf ${edges.start ? 'is-start' : ''} ${edges.end ? 'is-end' : ''} ${className}`}>
      <div className="shelf__scroll" ref={ref} onScroll={measure}>
        <div className="shelf__track">{children}</div>
      </div>
      {!touch && !edges.start && (
        <button type="button" className="shelf__key shelf__key--prev" aria-label="Scroll left" onClick={() => page(-1)}>
          <ChevronLeftIcon />
        </button>
      )}
      {!touch && !edges.end && (
        <button type="button" className="shelf__key shelf__key--next" aria-label="Scroll right" onClick={() => page(1)}>
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}

export function Grid({ children, tight, className = '' }: { children: ReactNode; tight?: boolean; className?: string }) {
  return <div className={`grid ${tight ? 'grid--tight' : ''} ${className}`}>{children}</div>;
}

export function SkeletonCards({ count = 8, round }: { count?: number; round?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} round={round} />
      ))}
    </>
  );
}
