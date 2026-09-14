/** The home screen: recent listening, fresh additions, and things to rediscover. */

import { useMemo, useRef } from 'react';

import { AlbumCard, ArtistCard, CardSkeleton, Shelf } from '../components/Cards';
import { Page } from '../components/Page';
import { Artwork } from '../components/Artwork';
import { PlayIcon, ShuffleIcon, SparkleIcon } from '../components/Icons';
import { albumArtist } from '../lib/format';
import { getAlbum, getAlbumList, getRandomSongs, getStarred } from '../lib/subsonic';
import { useAsync, type AsyncState } from '../hooks/useAsync';
import { useGlassPointer } from '../hooks/useGlassPointer';
import { usePalette } from '../hooks/usePalette';
import { morphFrom } from '../hooks/useSmoothNavigate';
import type { Album } from '../lib/types';
import { usePlayer } from '../state/player';
import { useSmoothNavigate } from '../hooks/useSmoothNavigate';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function ListenNow({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useSmoothNavigate();
  const { actions } = usePlayer();
  const glass = useGlassPointer<HTMLDivElement>();
  const heroArt = useRef<HTMLDivElement | null>(null);

  const recent = useAsync((signal) => getAlbumList('recent', { size: 16 }, signal), []);
  const newest = useAsync((signal) => getAlbumList('newest', { size: 16 }, signal), []);
  const frequent = useAsync((signal) => getAlbumList('frequent', { size: 16 }, signal), []);
  const random = useAsync((signal) => getAlbumList('random', { size: 16 }, signal), []);
  const starred = useAsync((signal) => getStarred(signal), []);

  const spotlight = useMemo(() => {
    const pool = recent.data?.length ? recent.data : newest.data;
    return pool?.[0];
  }, [newest.data, recent.data]);

  const playSpotlight = async () => {
    if (!spotlight) return;
    const full = await getAlbum(spotlight.id).catch(() => null);
    const songs = full?.song ?? [];
    if (songs.length) actions.playQueue(songs, 0, { kind: 'Album', name: spotlight.name, id: spotlight.id });
  };

  const shuffleEverything = async () => {
    const songs = await getRandomSongs({ size: 200 });
    if (songs.length) actions.playQueue(songs, 0, { kind: 'Station', name: 'Your Library' });
  };

  return (
    <Page
      title={greeting()}
      subtitle="Everything in your library, straight from the source."
      onMenuClick={onMenuClick}
      onRefresh={() => {
        recent.reload();
        newest.reload();
        frequent.reload();
        random.reload();
        starred.reload();
      }}
    >
      {spotlight && <Spotlight album={spotlight} onPlay={playSpotlight} onShuffle={shuffleEverything} />}

      <AlbumShelf title="Recently Played" state={recent} onLink={() => navigate('/library/albums')} />
      <AlbumShelf title="Recently Added" state={newest} onLink={() => navigate('/library/recent')} />

      {starred.data && starred.data.artist.length > 0 && (
        <Shelf title="Favourite Artists" link="See All" onLink={() => navigate('/library/favourites')}>
          {starred.data.artist.slice(0, 16).map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </Shelf>
      )}

      <AlbumShelf title="Most Played" state={frequent} onLink={() => navigate('/library/albums')} />

      <Shelf title="Rediscover" link="Shuffle" onLink={() => void shuffleEverything()}>
        {random.loading
          ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
          : (random.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
      </Shelf>

      {!recent.loading && !newest.loading && (recent.data?.length ?? 0) === 0 && (newest.data?.length ?? 0) === 0 && (
        <div className="fz-empty">
          <SparkleIcon />
          <div className="fz-empty__title">Your library is empty</div>
          <div>Point Navidrome at your music folder and run a scan.</div>
        </div>
      )}
    </Page>
  );
}

/**
 * "Pick up where you left off". Owns its own palette rather than borrowing the
 * app's, because the album it is showing is usually not the one playing.
 */
function Spotlight({
  album, onPlay, onShuffle,
}: {
  album: Album;
  onPlay: () => Promise<void>;
  onShuffle: () => Promise<void>;
}) {
  const navigate = useSmoothNavigate();
  const glass = useGlassPointer<HTMLDivElement>();
  const { palette, ref: paletteRef } = usePalette(album.coverArt, true);
  const art = useRef<HTMLDivElement | null>(null);

  const open = () => {
    morphFrom(art.current);
    navigate(`/album/${encodeURIComponent(album.id)}`);
  };

  return (
    <section className="fz-section">
      <div
        ref={(node) => {
          glass.ref.current = node;
          paletteRef(node);
        }}
        onPointerMove={glass.onPointerMove}
        onPointerLeave={glass.onPointerLeave}
        className="fz-hero fz-pane fz-pane--interactive"
        role="button"
        tabIndex={0}
        style={{
          ['--card-glow' as string]: palette.vibrant,
          ['--card-deep' as string]: palette.darkVibrant,
        }}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter') open();
        }}
      >
        <div className="fz-hero__wash" aria-hidden="true" />
        <Artwork ref={art} coverArt={album.coverArt} name={album.name} size={400} className="fz-hero__art" />
        <div className="fz-hero__text">
          <div className="fz-hero__eyebrow">Pick up where you left off</div>
          <div className="fz-hero__title fz-truncate">{album.name}</div>
          <div className="fz-hero__artist fz-truncate">{albumArtist(album)}</div>
        </div>
        <div className="fz-hero__actions">
          <button
            type="button"
            className="fz-btn fz-btn--solid"
            onClick={(event) => {
              event.stopPropagation();
              void onPlay();
            }}
          >
            <PlayIcon /> Play
          </button>
          <button
            type="button"
            className="fz-btn fz-btn--glass"
            onClick={(event) => {
              event.stopPropagation();
              void onShuffle();
            }}
          >
            <ShuffleIcon /> Shuffle Library
          </button>
        </div>
      </div>
    </section>
  );
}

function AlbumShelf({
  title,
  state,
  onLink,
}: {
  title: string;
  state: AsyncState<Album[]>;
  onLink: () => void;
}) {
  if (!state.loading && (state.data?.length ?? 0) === 0) return null;
  return (
    <Shelf title={title} link="See All" onLink={onLink}>
      {state.loading
        ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
        : (state.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
    </Shelf>
  );
}
