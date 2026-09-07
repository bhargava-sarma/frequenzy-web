/**
 * The library sections: recently added, artists, albums, songs, genres and
 * favourites. They share enough structure to live in one file.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Artwork } from '../components/Artwork';
import { AlbumCard, ArtistCard, CardSkeleton, PlaylistCard } from '../components/Cards';
import { LibraryToolbar, type SortOption } from '../components/LibraryToolbar';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import {
  ChevronRightIcon, HeartIcon, HistoryIcon, PlayIcon, PlaylistIcon, PlusIcon,
  ShuffleIcon,
} from '../components/Icons';
import { albumArtist, formatCount, hashHue } from '../lib/format';
import type { Album } from '../lib/types';
import { clearHistory, subscribeHistory, type HistoryEntry } from '../lib/history';
import {
  getAlbumList, getArtists, getGenres, getRandomSongs, getSongsByGenre, getStarred,
} from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useSettings } from '../state/settings';

type AlbumSort =
  | 'alphabeticalByName' | 'alphabeticalByArtist' | 'newest' | 'frequent'
  | 'recent' | 'highest' | 'byYear';

const ALBUM_SORTS: SortOption<AlbumSort>[] = [
  { id: 'alphabeticalByName', label: 'Title' },
  { id: 'alphabeticalByArtist', label: 'Artist' },
  { id: 'newest', label: 'Recently Added' },
  { id: 'recent', label: 'Recently Played' },
  { id: 'frequent', label: 'Most Played' },
  { id: 'highest', label: 'Rating' },
  { id: 'byYear', label: 'Year' },
];

/* ------------------------------------------------------------------- albums */

export function LibraryAlbums({ onMenuClick }: { onMenuClick?: () => void }) {
  const [sort, setSort] = useState<AlbumSort>('alphabeticalByName');
  const [filter, setFilter] = useState('');
  const { settings } = useSettings();

  const albums = useAsync(
    (signal) =>
      getAlbumList(
        sort,
        // byYear needs an explicit span, otherwise Navidrome returns nothing.
        sort === 'byYear' ? { size: 500, fromYear: 1900, toYear: new Date().getFullYear() + 1 } : { size: 500 },
        signal,
      ),
    [sort],
  );

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return albums.data ?? [];
    return (albums.data ?? []).filter(
      (album) =>
        album.name.toLowerCase().includes(term) || (album.artist ?? '').toLowerCase().includes(term),
    );
  }, [albums.data, filter]);

  return (
    <Page
      title="Albums"
      subtitle={albums.data ? `${shown.length.toLocaleString()} of ${albums.data.length.toLocaleString()} albums` : undefined}
      onMenuClick={onMenuClick}
      onRefresh={albums.reload}
      actions={
        <LibraryToolbar
          sorts={ALBUM_SORTS}
          sort={sort}
          onSortChange={setSort}
          filter={filter}
          onFilterChange={setFilter}
          filterPlaceholder="Filter albums"
          showViewToggle
        />
      }
    >
      {albums.loading ? (
        <div className="fz-grid">
          {Array.from({ length: 20 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="fz-empty">
          <div className="fz-empty__title">No albums match “{filter}”</div>
        </div>
      ) : settings.libraryView === 'list' ? (
        <AlbumRows albums={shown} />
      ) : (
        <div className="fz-grid">
          {shown.map((album) => <AlbumCard key={album.id} album={album} />)}
        </div>
      )}
    </Page>
  );
}

/** The list density for albums — artwork, title, artist, year. */
function AlbumRows({ albums }: { albums: Album[] }) {
  const navigate = useNavigate();
  return (
    <div className="fz-rows">
      {albums.map((album) => (
        <button
          key={album.id}
          type="button"
          className="fz-row"
          onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
        >
          <Artwork coverArt={album.coverArt} name={album.name} size={120} className="fz-row__art" />
          <span className="fz-row__text">
            <span className="fz-row__title fz-truncate">{album.name}</span>
            <span className="fz-row__sub fz-truncate">
              {albumArtist(album)}
              {album.year ? ` · ${album.year}` : ''}
            </span>
          </span>
          <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flex: 'none' }} />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ recently added */

export function LibraryRecent({ onMenuClick }: { onMenuClick?: () => void }) {
  const albums = useAsync((signal) => getAlbumList('newest', { size: 200 }, signal), []);
  return (
    <Page title="Recently Added" subtitle="The newest arrivals on your server." onMenuClick={onMenuClick}>
      <div className="fz-grid">
        {albums.loading
          ? Array.from({ length: 20 }, (_, i) => <CardSkeleton key={i} />)
          : (albums.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ artists */

export function LibraryArtists({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [filter, setFilter] = useState('');
  const indexes = useAsync((signal) => getArtists(signal), []);

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (indexes.data ?? [])
      .map((group) => ({
        name: group.name,
        artist: term ? group.artist.filter((a) => a.name.toLowerCase().includes(term)) : group.artist,
      }))
      .filter((group) => group.artist.length > 0);
  }, [filter, indexes.data]);

  const total = useMemo(() => groups.reduce((sum, group) => sum + group.artist.length, 0), [groups]);

  const jumpTo = (letter: string) => {
    document.getElementById(`fz-index-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Page
      title="Artists"
      subtitle={total ? `${total.toLocaleString()} artists` : undefined}
      onMenuClick={onMenuClick}
      actions={
        <LibraryToolbar
          filter={filter}
          onFilterChange={setFilter}
          filterPlaceholder="Filter artists"
          showViewToggle
        />
      }
    >
      {indexes.loading && (
        <div className="fz-grid fz-grid--tight">
          {Array.from({ length: 18 }, (_, i) => <CardSkeleton key={i} rounded />)}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.name} className="fz-section" id={`fz-index-${group.name}`}>
          <div className="fz-section__head"><h2 className="fz-section__title">{group.name}</h2></div>
          {settings.libraryView === 'list' ? (
            <div className="fz-rows">
              {group.artist.map((artist) => (
                <button
                  key={artist.id}
                  type="button"
                  className="fz-row"
                  onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
                >
                  <Artwork
                    coverArt={artist.coverArt ?? artist.id}
                    name={artist.name}
                    size={120}
                    rounded
                    className="fz-row__art fz-row__art--round"
                  />
                  <span className="fz-row__text">
                    <span className="fz-row__title fz-truncate">{artist.name}</span>
                    <span className="fz-row__sub">{formatCount(artist.albumCount, 'album')}</span>
                  </span>
                  <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-tertiary)', flex: 'none' }} />
                </button>
              ))}
            </div>
          ) : (
            <div className="fz-grid fz-grid--tight">
              {group.artist.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
            </div>
          )}
        </section>
      ))}

      {groups.length > 4 && (
        <nav className="fz-alpha" aria-label="Jump to letter">
          {groups.map((group) => (
            <button key={group.name} type="button" onClick={() => jumpTo(group.name)}>
              {group.name}
            </button>
          ))}
        </nav>
      )}

      {!indexes.loading && groups.length === 0 && (
        <div className="fz-empty">
          <div className="fz-empty__title">No artists match “{filter}”</div>
        </div>
      )}
    </Page>
  );
}

/* -------------------------------------------------------------------- songs */

type SongSort = 'title' | 'artist' | 'album' | 'year' | 'plays' | 'random';

const SONG_SORTS: SortOption<SongSort>[] = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'album', label: 'Album' },
  { id: 'year', label: 'Year' },
  { id: 'plays', label: 'Most Played' },
  { id: 'random', label: 'Shuffled' },
];

export function LibrarySongs({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const [sort, setSort] = useState<SongSort>('title');
  const [filter, setFilter] = useState('');
  const songs = useAsync((signal) => getRandomSongs({ size: 500 }, signal), []);

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = (songs.data ?? []).filter(
      (song) =>
        !term ||
        song.title.toLowerCase().includes(term) ||
        (song.artist ?? '').toLowerCase().includes(term) ||
        (song.album ?? '').toLowerCase().includes(term),
    );
    const by = (get: (s: (typeof list)[number]) => string) => (a: typeof list[number], b: typeof list[number]) =>
      get(a).localeCompare(get(b), undefined, { sensitivity: 'base' });
    switch (sort) {
      case 'title': return [...list].sort(by((s) => s.title));
      case 'artist': return [...list].sort(by((s) => s.artist ?? ''));
      case 'album': return [...list].sort(by((s) => s.album ?? ''));
      case 'year': return [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case 'plays': return [...list].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
      default: return list;
    }
  }, [filter, songs.data, sort]);

  return (
    <Page
      title="Songs"
      subtitle={songs.data ? `${shown.length.toLocaleString()} songs` : undefined}
      onMenuClick={onMenuClick}
      actions={
        <>
          <LibraryToolbar
            sorts={SONG_SORTS}
            sort={sort}
            onSortChange={setSort}
            filter={filter}
            onFilterChange={setFilter}
            filterPlaceholder="Filter songs"
          />
          <button
            type="button"
            className="fz-btn fz-btn--accent"
            onClick={() =>
              shown.length && actions.playQueue([...shown].sort(() => Math.random() - 0.5), 0, { kind: 'Library', name: 'Songs' })
            }
          >
            <ShuffleIcon /> Shuffle
          </button>
        </>
      }
    >
      {songs.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="fz-skeleton" style={{ height: 40 }} />)}
        </div>
      ) : (
        <TrackList songs={shown} context={{ kind: 'Library', name: 'Songs' }} />
      )}
    </Page>
  );
}

/* ------------------------------------------------------------------- genres */

export function LibraryGenres({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const genres = useAsync((signal) => getGenres(signal), []);
  const sorted = (genres.data ?? []).slice().sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0));

  return (
    <Page title="Genres" subtitle={`${sorted.length} genres in your library`} onMenuClick={onMenuClick}>
      <div className="fz-grid">
        {sorted.map((genre) => (
          <button
            key={genre.value}
            type="button"
            className="fz-card"
            onClick={() => navigate(`/genre/${encodeURIComponent(genre.value)}`)}
          >
            <div
              className="fz-card__art fz-art"
              style={{
                background: `linear-gradient(150deg, hsl(${hashHue(genre.value)} 64% 46%), hsl(${(hashHue(genre.value) + 60) % 360} 58% 26%))`,
                display: 'grid',
                placeItems: 'center',
                padding: 12,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#fff', textAlign: 'center', letterSpacing: '-0.3px' }}>
                {genre.value}
              </span>
            </div>
            <div className="fz-card__subtitle fz-truncate">
              {(genre.songCount ?? 0).toLocaleString()} songs
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}

/* -------------------------------------------------------------- genre detail */

export function GenreDetail() {
  const { name = '' } = useParams();
  const genre = decodeURIComponent(name);
  const { actions } = usePlayer();
  const songs = useAsync((signal) => getSongsByGenre(genre, 300, 0, signal), [genre]);
  const albums = useAsync((signal) => getAlbumList('byGenre', { size: 60, genre }, signal), [genre]);

  return (
    <Page
      title={genre}
      subtitle={songs.data ? `${songs.data.length.toLocaleString()} songs` : undefined}
      actions={
        <button
          type="button"
          className="fz-btn fz-btn--accent"
          onClick={() => songs.data && actions.playQueue(songs.data, 0, { kind: 'Genre', name: genre })}
        >
          <PlayIcon /> Play
        </button>
      }
    >
      {(albums.data?.length ?? 0) > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Albums</h2></div>
          <div className="fz-grid">
            {(albums.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
          </div>
        </section>
      )}
      <section className="fz-section">
        <div className="fz-section__head"><h2 className="fz-section__title">Songs</h2></div>
        <TrackList songs={songs.data ?? []} context={{ kind: 'Genre', name: genre }} />
      </section>
    </Page>
  );
}

/* --------------------------------------------------------------- favourites */

export function LibraryFavourites({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const starred = useAsync((signal) => getStarred(signal), []);
  const empty =
    !starred.loading &&
    (starred.data?.song.length ?? 0) === 0 &&
    (starred.data?.album.length ?? 0) === 0 &&
    (starred.data?.artist.length ?? 0) === 0;

  return (
    <Page
      title="Favourites"
      subtitle="Everything you have hearted."
      onMenuClick={onMenuClick}
      actions={
        (starred.data?.song.length ?? 0) > 0 ? (
          <button
            type="button"
            className="fz-btn fz-btn--accent"
            onClick={() => starred.data && actions.playQueue(starred.data.song, 0, { kind: 'Library', name: 'Favourites' })}
          >
            <PlayIcon /> Play
          </button>
        ) : undefined
      }
    >
      {empty && (
        <div className="fz-empty">
          <HeartIcon />
          <div className="fz-empty__title">No favourites yet</div>
          <div>Tap the heart on anything to keep it here.</div>
        </div>
      )}

      {(starred.data?.artist.length ?? 0) > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Artists</h2></div>
          <div className="fz-grid fz-grid--tight">
            {(starred.data?.artist ?? []).map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </div>
        </section>
      )}

      {(starred.data?.album.length ?? 0) > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Albums</h2></div>
          <div className="fz-grid">
            {(starred.data?.album ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
          </div>
        </section>
      )}

      {(starred.data?.song.length ?? 0) > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Songs</h2></div>
          <TrackList songs={starred.data?.song ?? []} context={{ kind: 'Library', name: 'Favourites' }} />
        </section>
      )}
    </Page>
  );
}

/* --------------------------------------------------------- recently played */

export function LibraryHistory({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => subscribeHistory(setEntries), []);

  const songs = entries.map((entry) => entry.song);

  return (
    <Page
      title="Recently Played"
      subtitle={songs.length ? `${songs.length} tracks` : undefined}
      onMenuClick={onMenuClick}
      actions={
        songs.length > 0 ? (
          <>
            <button
              type="button"
              className="fz-btn fz-btn--accent"
              onClick={() => actions.playQueue(songs, 0, { kind: 'Library', name: 'Recently Played' })}
            >
              <PlayIcon /> Play
            </button>
            <button type="button" className="fz-btn" onClick={clearHistory}>Clear</button>
          </>
        ) : undefined
      }
    >
      {songs.length === 0 ? (
        <div className="fz-empty">
          <HistoryIcon />
          <div className="fz-empty__title">Nothing played yet</div>
          <div>Everything you listen to shows up here.</div>
        </div>
      ) : (
        <TrackList songs={songs} context={{ kind: 'Library', name: 'Recently Played' }} />
      )}
    </Page>
  );
}

/* ----------------------------------------------------------------- playlists */

export function LibraryPlaylists({ onMenuClick }: { onMenuClick?: () => void }) {
  const { playlists, createPlaylist } = useLibrary();
  const { prompt } = useDialogs();

  return (
    <Page
      title="Playlists"
      subtitle={playlists.length ? formatCount(playlists.length, 'playlist') : undefined}
      onMenuClick={onMenuClick}
      actions={
        <button
          type="button"
          className="fz-btn fz-btn--accent"
          onClick={() =>
            prompt({
              title: 'New Playlist',
              label: 'Name',
              initialValue: 'New Playlist',
              confirmLabel: 'Create',
              onConfirm: (name) => void createPlaylist(name),
            })
          }
        >
          <PlusIcon /> New
        </button>
      }
    >
      {playlists.length === 0 ? (
        <div className="fz-empty">
          <PlaylistIcon />
          <div className="fz-empty__title">No playlists yet</div>
          <div>Build one from any song's ⋯ menu.</div>
        </div>
      ) : (
        <div className="fz-grid">
          {playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
        </div>
      )}
    </Page>
  );
}
