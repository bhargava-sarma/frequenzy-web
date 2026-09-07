/** Browse the whole library by release, decade and genre. */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AlbumCard, CardSkeleton, Shelf } from '../components/Cards';
import { Page } from '../components/Page';
import { getAlbumList, getGenres } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960];

export function Browse({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const [decade, setDecade] = useState<number | null>(null);

  const newest = useAsync((signal) => getAlbumList('newest', { size: 24 }, signal), []);
  const highest = useAsync((signal) => getAlbumList('highest', { size: 24 }, signal), []);
  const genres = useAsync((signal) => getGenres(signal), []);
  const byDecade = useAsync(
    (signal) =>
      decade === null
        ? Promise.resolve([])
        : getAlbumList('byYear', { size: 40, fromYear: decade, toYear: decade + 9 }, signal),
    [decade],
  );

  const topGenres = (genres.data ?? [])
    .filter((g) => (g.albumCount ?? 0) > 0)
    .sort((a, b) => (b.albumCount ?? 0) - (a.albumCount ?? 0))
    .slice(0, 24);

  return (
    <Page title="Browse" subtitle="Everything on the server, sorted every which way." onMenuClick={onMenuClick}>
      <Shelf title="New Releases" link="See All" onLink={() => navigate('/library/recent')}>
        {newest.loading
          ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
          : (newest.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
      </Shelf>

      <Shelf title="Top Rated" link="See All" onLink={() => navigate('/library/albums')}>
        {highest.loading
          ? Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
          : (highest.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
      </Shelf>

      <section className="fz-section">
        <div className="fz-section__head">
          <h2 className="fz-section__title">By Decade</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DECADES.map((year) => (
            <button
              key={year}
              type="button"
              className={`fz-btn ${decade === year ? 'fz-btn--solid' : ''}`}
              onClick={() => setDecade(decade === year ? null : year)}
            >
              {year}s
            </button>
          ))}
        </div>
        {decade !== null && (
          <div className="fz-grid fz-stagger" style={{ marginTop: 18 }}>
            {byDecade.loading
              ? Array.from({ length: 10 }, (_, i) => <CardSkeleton key={i} />)
              : (byDecade.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
            {!byDecade.loading && (byDecade.data?.length ?? 0) === 0 && (
              <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', fontSize: 13 }}>
                Nothing from the {decade}s in your library.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="fz-section">
        <div className="fz-section__head">
          <h2 className="fz-section__title">Genres</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {topGenres.map((genre) => (
            <button
              key={genre.value}
              type="button"
              className="fz-btn"
              onClick={() => navigate(`/genre/${encodeURIComponent(genre.value)}`)}
            >
              {genre.value}
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{genre.albumCount}</span>
            </button>
          ))}
        </div>
      </section>
    </Page>
  );
}
