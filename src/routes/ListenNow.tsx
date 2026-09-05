/** The home screen: recent listening, fresh additions, and things to rediscover. */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AlbumCard, ArtistCard, CardSkeleton, Shelf } from '../components/Cards';
import { Page } from '../components/Page';
import { Artwork } from '../components/Artwork';
import { PlayIcon, ShuffleIcon, SparkleIcon } from '../components/Icons';
import { albumArtist } from '../lib/format';
import { getAlbumList, getRandomSongs, getStarred } from '../lib/subsonic';
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

  const shuffleEverything = async () => {
    const songs = await getRandomSongs({ size: 200 });
    if (songs.length) actions.playQueue(songs, 0, { kind: 'Station', name: 'Your Library' });
  };

  return (
    <Page title={greeting()} subtitle="Everything in your library, straight from the source." onMenuClick={onMenuClick}>
      {spotlight && (
        <section className="fz-section">
          <div
            ref={glass.ref}
            onPointerMove={glass.onPointerMove}
            onPointerLeave={glass.onPointerLeave}
            className="fz-glass fz-glass--liquid fz-glass--interactive fz-glass--tracked"
            style={{
              display: 'flex',
              gap: 22,
              padding: 20,
              borderRadius: 'var(--radius-xl)',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/album/${encodeURIComponent(spotlight.id)}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/album/${encodeURIComponent(spotlight.id)}`);
            }}
          >
            <div className="fz-glass-refraction" />
            <Artwork
              coverArt={spotlight.coverArt}
              name={spotlight.name}
              size={400}
              className=""
            />
            <div style={{ minWidth: 0, position: 'relative', zIndex: 3, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                Pick up where you left off
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.6px', marginTop: 4 }} className="fz-truncate">
                {spotlight.name}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)' }} className="fz-truncate">
                {albumArtist(spotlight)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button type="button" className="fz-btn fz-btn--solid" onClick={(event) => { event.stopPropagation(); navigate(`/album/${encodeURIComponent(spotlight.id)}`); }}>
                  <PlayIcon /> Open
                </button>
                <button type="button" className="fz-btn" onClick={(event) => { event.stopPropagation(); void shuffleEverything(); }}>
                  <ShuffleIcon /> Shuffle Library
                </button>
              </div>
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
