/** The home screen: recent listening, fresh additions, and things to rediscover. */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AlbumCard, ArtistCard, CardSkeleton, Shelf } from '../components/Cards';
import { Page } from '../components/Page';
import { Artwork } from '../components/Artwork';
import { PlayIcon, ShuffleIcon, SparkleIcon } from '../components/Icons';
import { albumArtist } from '../lib/format';
import { getAlbum, getAlbumList, getRandomSongs, getStarred } from '../lib/subsonic';
import { useAsync, type AsyncState } from '../hooks/useAsync';
import { useGlassPointer } from '../hooks/useGlassPointer';
import type { Album } from '../lib/types';
import { usePlayer } from '../state/player';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function ListenNow({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { actions } = usePlayer();
  const glass = useGlassPointer<HTMLDivElement>();

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
      {spotlight && (
        <section className="fz-section">
          <div
            ref={glass.ref}
            onPointerMove={glass.onPointerMove}
            onPointerLeave={glass.onPointerLeave}
            className="fz-hero fz-pane fz-pane--interactive fz-pane--lit"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/album/${encodeURIComponent(spotlight.id)}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/album/${encodeURIComponent(spotlight.id)}`);
            }}
          >
            <Artwork coverArt={spotlight.coverArt} name={spotlight.name} size={400} className="fz-hero__art" />
            <div className="fz-hero__text">
              <div className="fz-hero__eyebrow">Pick up where you left off</div>
              <div className="fz-hero__title fz-truncate">{spotlight.name}</div>
              <div className="fz-hero__artist fz-truncate">{albumArtist(spotlight)}</div>
            </div>
            <div className="fz-hero__actions">
                <button
                  type="button"
                  className="fz-btn fz-btn--solid"
                  onClick={(event) => {
                    event.stopPropagation();
                    void playSpotlight();
                  }}
                >
                  <PlayIcon /> Play
                </button>
                <button
                  type="button"
                  className="fz-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    void shuffleEverything();
                  }}
                >
                  <ShuffleIcon /> Shuffle Library
                </button>
            </div>
          </div>
        </section>
      )}

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
