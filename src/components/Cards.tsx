/** Album / artist / playlist cards, plus the horizontally scrolling shelf. */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Artwork } from './Artwork';
import { useContextMenu } from './ContextMenu';
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from './Icons';
import { albumArtist, formatCount } from '../lib/format';
import { getAlbum } from '../lib/subsonic';
import type { Album, Artist, Playlist } from '../lib/types';
import { useDialogs } from '../state/dialogs';
import { usePlayer } from '../state/player';
import { useMediaMenu } from '../hooks/useMediaMenu';

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
        <div style={{ display: 'flex', gap: 2, marginLeft: link ? 10 : 'auto' }}>
          <button type="button" className="fz-icon-btn" aria-label="Scroll left" disabled={atStart} onClick={() => scrollBy(-1)}>
            <ChevronLeftIcon />
          </button>
          <button type="button" className="fz-icon-btn" aria-label="Scroll right" disabled={atEnd} onClick={() => scrollBy(1)}>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className="fz-hscroll" ref={scroller} onScroll={updateEdges}>
        <div className={`fz-shelf ${wide ? 'fz-shelf--wide' : ''}`}>{children}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- album card */

export function AlbumCard({ album, subtitle }: { album: Album; subtitle?: string }) {
  const navigate = useNavigate();
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
      <div
        className="fz-card"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') navigate(`/album/${encodeURIComponent(album.id)}`);
        }}
        onContextMenu={(event) => void handleMenu(event)}
      >
        <Artwork coverArt={album.coverArt} name={album.name} size={400} className="fz-card__art">
          <button type="button" className="fz-play-overlay" aria-label={`Play ${album.name}`} onClick={(event) => void handlePlay(event)}>
            <PlayIcon />
          </button>
        </Artwork>
        <div>
          <div className="fz-card__title fz-clamp-2">{album.name}</div>
          <div className="fz-card__subtitle fz-truncate">{subtitle ?? albumArtist(album)}</div>
        </div>
      </div>
      {menu}
    </>
  );
}

/* --------------------------------------------------------------- artist card */

export function ArtistCard({ artist }: { artist: Artist }) {
  const navigate = useNavigate();
  const { artistMenu } = useMediaMenu();
  const { open, menu } = useContextMenu();

  return (
    <>
      <div
        className="fz-card"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') navigate(`/artist/${encodeURIComponent(artist.id)}`);
        }}
        onContextMenu={(event) => open(event, artistMenu(artist))}
      >
        <Artwork coverArt={artist.coverArt ?? artist.id} name={artist.name} size={400} rounded className="fz-card__art" />
        <div style={{ textAlign: 'center' }}>
          <div className="fz-card__title fz-truncate">{artist.name}</div>
          <div className="fz-card__subtitle fz-truncate">{formatCount(artist.albumCount, 'album')}</div>
        </div>
      </div>
      {menu}
    </>
  );
}

/* ------------------------------------------------------------- playlist card */

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const navigate = useNavigate();
  return (
    <div
      className="fz-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') navigate(`/playlist/${encodeURIComponent(playlist.id)}`);
      }}
    >
      <Artwork coverArt={playlist.coverArt} name={playlist.name} size={400} className="fz-card__art" />
      <div>
        <div className="fz-card__title fz-clamp-2">{playlist.name}</div>
        <div className="fz-card__subtitle fz-truncate">{formatCount(playlist.songCount, 'song')}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ skeleton */

export function CardSkeleton({ rounded }: { rounded?: boolean }) {
  return (
    <div className="fz-card" aria-hidden="true">
      <div className="fz-skeleton" style={{ aspectRatio: '1', borderRadius: rounded ? '50%' : 'var(--radius-md)' }} />
      <div>
        <div className="fz-skeleton" style={{ height: 11, width: '78%', marginBottom: 6 }} />
        <div className="fz-skeleton" style={{ height: 10, width: '52%' }} />
      </div>
    </div>
  );
}
