/**
 * Search across artists, albums and songs.
 *
 * The query lives in the URL — replaced as you type rather than pushed, so
 * Back leaves search instead of stepping through every keystroke. What you
 * searched for is remembered; on a phone that list is the whole screen until
 * you type.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, Grid, SkeletonCards } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { Segmented } from '../components/controls';
import { CloseIcon, HistoryIcon, PlayIcon, SearchIcon } from '../components/Icons';
import { Empty, Page, Section } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { albumArtist } from '../lib/format';
import { navigate } from '../lib/nav';
import { useSearch } from '../lib/queries';
import { artistCover } from '../lib/song';
import * as act from '../state/actions';

type Tab = 'all' | 'songs' | 'albums' | 'artists';

const RECENT_KEY = 'frequenzy.recentSearches.v1';
const RECENT_LIMIT = 14;

function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
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

export function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [tab, setTab] = useState<Tab>('all');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const input = useRef<HTMLInputElement | null>(null);

  // Typing elsewhere (the palette, Back) changes the URL; follow it.
  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (draft.trim() === query) return;
    const handle = setTimeout(() => {
      setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true });
    }, 220);
    return () => clearTimeout(handle);
  }, [draft, query, setParams]);

  const results = useSearch(query, { artistCount: 24, albumCount: 48, songCount: 100 });
  const data = query ? results.data : undefined;
  const total = (data?.song.length ?? 0) + (data?.album.length ?? 0) + (data?.artist.length ?? 0);

  // Only remember searches that found something.
  useEffect(() => {
    const term = query.trim();
    if (!term || results.loading || total === 0) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_LIMIT);
      saveRecent(next);
      return next;
    });
  }, [query, results.loading, total]);

  const removeRecent = useCallback((term: string) => {
    setRecent((prev) => {
      const next = prev.filter((item) => item !== term);
      saveRecent(next);
      return next;
    });
  }, []);

  /** The single most likely thing you meant: an exact name match first. */
  const top = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    const artist = data.artist.find((a) => a.name.toLowerCase() === q) ?? null;
    if (artist) return { kind: 'artist' as const, artist };
    const album = data.album.find((a) => a.name.toLowerCase() === q) ?? null;
    if (album) return { kind: 'album' as const, album };
    if (data.artist[0]) return { kind: 'artist' as const, artist: data.artist[0] };
    if (data.album[0]) return { kind: 'album' as const, album: data.album[0] };
    return null;
  }, [data, query]);

  const context = useMemo(() => ({ kind: 'Search', name: query }), [query]);
  const songs = useMemo(() => (tab === 'all' ? (data?.song ?? []).slice(0, 10) : (data?.song ?? [])), [data, tab]);

  return (
    <Page root title={query ? `“${query}”` : 'search'} head={<div className="page-head"><h1 className="page-head__title">search</h1></div>}>
      <div className="search-box">
        <div className="input input--lg">
          <SearchIcon />
          <input
            ref={input}
            type="search"
            autoFocus
            value={draft}
            placeholder="artists, albums, songs"
            aria-label="Search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && draft) {
                event.stopPropagation();
                setDraft('');
              }
            }}
          />
          {draft && (
            <button
              type="button"
              className="ibtn ibtn--sm"
              aria-label="Clear search"
              onClick={() => {
                setDraft('');
                input.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        {query && total > 0 && (
          <Segmented<Tab>
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all' as Tab, label: 'all' },
              { value: 'songs' as Tab, label: `songs ${data?.song.length ?? 0}`, count: data?.song.length ?? 0 },
              { value: 'albums' as Tab, label: `albums ${data?.album.length ?? 0}`, count: data?.album.length ?? 0 },
              { value: 'artists' as Tab, label: `artists ${data?.artist.length ?? 0}`, count: data?.artist.length ?? 0 },
            ].filter((option) => option.count === undefined || option.count > 0)}
          />
        )}
      </div>

      {!query && recent.length > 0 && (
        <Section
          title="recent searches"
          action={
            <button
              type="button"
              className="section__link"
              onClick={() => {
                setRecent([]);
                saveRecent([]);
              }}
            >
              clear
            </button>
          }
        >
          <div className="recents">
            {recent.map((term) => (
              <div key={term} className="recents__row">
                <button type="button" className="recents__term" onClick={() => setDraft(term)}>
                  <HistoryIcon />
                  <span className="truncate">{term}</span>
                </button>
                <button type="button" className="ibtn ibtn--sm" aria-label={`Forget ${term}`} onClick={() => removeRecent(term)}>
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!query && recent.length === 0 && (
        <Empty icon={<SearchIcon />} title="find anything">
          Search the whole library by artist, album or song. Anywhere in the app, press <kbd className="kbd">/</kbd> or{' '}
          <kbd className="kbd">⌘K</kbd>.
        </Empty>
      )}

      {query && results.loading && (
        <Grid>
          <SkeletonCards count={6} />
        </Grid>
      )}

      {query && !results.loading && total === 0 && (
        <Empty icon={<SearchIcon />} title="no results">
          Nothing in the library matches “{query}”.
        </Empty>
      )}

      {data && tab === 'all' && top && (
        <Section title="top result">
          <div className="top-result">
            {top.kind === 'artist' ? (
              <button type="button" className="top-result__card" onClick={() => navigate(`/artist/${encodeURIComponent(top.artist.id)}`)}>
                <Artwork coverArt={artistCover(top.artist)} name={top.artist.name} size={96} round className="top-result__art" />
                <span className="top-result__text">
                  <span className="label">artist</span>
                  <span className="top-result__title truncate">{top.artist.name}</span>
                </span>
              </button>
            ) : (
              <button type="button" className="top-result__card" onClick={() => navigate(`/album/${encodeURIComponent(top.album.id)}`)}>
                <Artwork coverArt={top.album.coverArt} name={top.album.name} size={96} className="top-result__art" />
                <span className="top-result__text">
                  <span className="label">album · {albumArtist(top.album)}</span>
                  <span className="top-result__title truncate">{top.album.name}</span>
                </span>
              </button>
            )}
            <button
              type="button"
              className="key key--primary"
              onClick={() =>
                top.kind === 'artist' ? void act.playArtist(top.artist, { shuffle: true }) : void act.playAlbum(top.album)
              }
            >
              <PlayIcon /> play
            </button>
          </div>
        </Section>
      )}

      {data && (tab === 'all' || tab === 'songs') && data.song.length > 0 && (
        <Section
          title="songs"
          action={
            tab === 'all' && data.song.length > 10 ? (
              <button type="button" className="section__link" onClick={() => setTab('songs')}>
                all {data.song.length} →
              </button>
            ) : undefined
          }
        >
          <TrackList songs={songs} context={context} sortable={tab === 'songs'} />
        </Section>
      )}

      {data && (tab === 'all' || tab === 'artists') && data.artist.length > 0 && (
        <Section title="artists">
          <Grid tight>
            {data.artist.slice(0, tab === 'all' ? 8 : undefined).map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </Grid>
        </Section>
      )}

      {data && (tab === 'all' || tab === 'albums') && data.album.length > 0 && (
        <Section title="albums">
          <Grid>
            {data.album.slice(0, tab === 'all' ? 12 : undefined).map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Grid>
        </Section>
      )}

    </Page>
  );
}
