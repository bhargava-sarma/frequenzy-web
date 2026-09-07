/**
 * Search across artists, albums and songs.
 *
 * Queries are debounced, results are tabbed, and what you searched for is
 * remembered — on a phone the recent list is the whole screen until you type,
 * which is the only thing that makes search usable one-handed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, CardSkeleton } from '../components/Cards';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { CloseIcon, HistoryIcon, SearchIcon } from '../components/Icons';
import { search } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useIsCompact } from '../hooks/useLayout';

type Tab = 'all' | 'songs' | 'albums' | 'artists';

const RECENT_KEY = 'frequenzy.recentSearches.v1';
const RECENT_LIMIT = 12;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)));
  } catch {
    /* ignore */
  }
}

export function Search({ onMenuClick }: { onMenuClick?: () => void }) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<Tab>('all');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const compact = useIsCompact();

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

  const total = useMemo(
    () =>
      (results.data?.song.length ?? 0) + (results.data?.album.length ?? 0) + (results.data?.artist.length ?? 0),
    [results.data],
  );

  // Only remember searches that actually found something.
  useEffect(() => {
    const term = query.trim();
    if (!term || results.loading || total === 0) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())];
      saveRecent(next);
      return next.slice(0, RECENT_LIMIT);
    });
  }, [query, results.loading, total]);

  const removeRecent = useCallback((term: string) => {
    setRecent((prev) => {
      const next = prev.filter((item) => item !== term);
      saveRecent(next);
      return next;
    });
  }, []);

  const hasResults = total > 0;

  return (
    <Page
      title={query ? `Results for “${query}”` : 'Search'}
      subtitle={query ? undefined : 'Find anything in your library.'}
      onMenuClick={onMenuClick}
    >
      <div style={{ maxWidth: compact ? undefined : 460, marginBottom: 22 }}>
        <div className="fz-input" style={{ height: compact ? 40 : 36 }}>
          <SearchIcon />
          <input
            type="search"
            autoFocus={!compact}
            value={draft}
            placeholder="Artists, albums, songs"
            aria-label="Search"
            onChange={(event) => setDraft(event.target.value)}
          />
          {draft && (
            <button
              type="button"
              className="fz-icon-btn"
              style={{ width: 26, height: 26 }}
              aria-label="Clear search"
              onClick={() => setDraft('')}
            >
              <CloseIcon style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {!query && recent.length > 0 && (
        <section className="fz-section">
          <div className="fz-section__head">
            <h2 className="fz-section__title">Recently Searched</h2>
            <button
              type="button"
              className="fz-section__link"
              style={{ opacity: 1 }}
              onClick={() => {
                setRecent([]);
                saveRecent([]);
              }}
            >
              Clear
            </button>
          </div>
          <div className="fz-rows">
            {recent.map((term) => (
              <div key={term} className="fz-row" style={{ paddingRight: 4 }}>
                <span className="fz-linkrow__icon"><HistoryIcon /></span>
                <button
                  type="button"
                  className="fz-row__text"
                  style={{ textAlign: 'left' }}
                  onClick={() => setDraft(term)}
                >
                  <span className="fz-row__title fz-truncate">{term}</span>
                </button>
                <button
                  type="button"
                  className="fz-icon-btn"
                  aria-label={`Remove ${term} from recent searches`}
                  onClick={() => removeRecent(term)}
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
