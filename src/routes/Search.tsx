/** Search across artists, albums and songs, debounced as you type. */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, CardSkeleton } from '../components/Cards';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { SearchIcon } from '../components/Icons';
import { search } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';

type Tab = 'all' | 'songs' | 'albums' | 'artists';

export function Search({ onMenuClick }: { onMenuClick?: () => void }) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => setDraft(query), [query]);

  // Debounce so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    if (draft === query) return;
    const handle = setTimeout(() => {
      setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true });
    }, 260);
    return () => clearTimeout(handle);
  }, [draft, query, setParams]);

  const results = useAsync(
    (signal) => search(query, { artistCount: 20, albumCount: 40, songCount: 60 }, signal),
    [query],
    { skip: query.trim().length === 0 },
  );

  const hasResults =
    (results.data?.song.length ?? 0) + (results.data?.album.length ?? 0) + (results.data?.artist.length ?? 0) > 0;

  return (
    <Page
      title={query ? `Results for “${query}”` : 'Search'}
      subtitle={query ? undefined : 'Find anything in your library.'}
      onMenuClick={onMenuClick}
    >
      <div style={{ maxWidth: 460, marginBottom: 22 }}>
        <div className="fz-input" style={{ height: 36 }}>
          <SearchIcon />
          <input
            type="search"
            autoFocus
            value={draft}
            placeholder="Artists, albums, songs"
            aria-label="Search"
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
      </div>

      {query && hasResults && (
        <div className="fz-segmented" style={{ marginBottom: 20 }}>
          {(['all', 'songs', 'albums', 'artists'] as Tab[]).map((value) => (
            <button key={value} type="button" className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      )}

      {results.loading && (
        <div className="fz-grid">
          {Array.from({ length: 10 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {query && !results.loading && !hasResults && (
        <div className="fz-empty">
          <SearchIcon />
          <div className="fz-empty__title">No results</div>
          <div>Nothing in your library matches “{query}”.</div>
        </div>
      )}

      {results.data && (tab === 'all' || tab === 'artists') && results.data.artist.length > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Artists</h2></div>
          <div className="fz-grid fz-grid--tight">
            {results.data.artist.slice(0, tab === 'all' ? 8 : undefined).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        </section>
      )}

      {results.data && (tab === 'all' || tab === 'albums') && results.data.album.length > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Albums</h2></div>
          <div className="fz-grid">
            {results.data.album.slice(0, tab === 'all' ? 10 : undefined).map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {results.data && (tab === 'all' || tab === 'songs') && results.data.song.length > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Songs</h2></div>
          <TrackList
            songs={tab === 'all' ? results.data.song.slice(0, 12) : results.data.song}
            context={{ kind: 'Search', name: query }}
          />
        </section>
      )}
    </Page>
  );
}
