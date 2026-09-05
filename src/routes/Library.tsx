/**
 * The library sections: recently added, artists, albums, songs, genres and
 * favourites. They share enough structure to live in one file.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, CardSkeleton } from '../components/Cards';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { HeartIcon, PlayIcon, ShuffleIcon } from '../components/Icons';
import { hashHue } from '../lib/format';
import {
  getAlbumList, getArtists, getGenres, getRandomSongs, getSongsByGenre, getStarred,
} from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { usePlayer } from '../state/player';

type AlbumSort = 'alphabeticalByName' | 'alphabeticalByArtist' | 'newest' | 'frequent' | 'recent' | 'highest';

const SORTS: { id: AlbumSort; label: string }[] = [
  { id: 'alphabeticalByName', label: 'Title' },
  { id: 'alphabeticalByArtist', label: 'Artist' },
  { id: 'newest', label: 'Recently Added' },
  { id: 'recent', label: 'Recently Played' },
  { id: 'frequent', label: 'Most Played' },
];

/* ------------------------------------------------------------------- albums */

export function LibraryAlbums({ onMenuClick }: { onMenuClick?: () => void }) {
  const [sort, setSort] = useState<AlbumSort>('alphabeticalByName');
  const albums = useAsync((signal) => getAlbumList(sort, { size: 500 }, signal), [sort]);

  return (
    <Page
      title="Albums"
      subtitle={albums.data ? `${albums.data.length.toLocaleString()} albums` : undefined}
      onMenuClick={onMenuClick}
      actions={
        <div className="fz-segmented">
          {SORTS.map((option) => (
            <button key={option.id} type="button" className={sort === option.id ? 'is-active' : ''} onClick={() => setSort(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="fz-grid">
        {albums.loading
          ? Array.from({ length: 20 }, (_, i) => <CardSkeleton key={i} />)
          : (albums.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}
      </div>
    </Page>
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
  const indexes = useAsync((signal) => getArtists(signal), []);
  const total = useMemo(
    () => (indexes.data ?? []).reduce((sum, group) => sum + group.artist.length, 0),
    [indexes.data],
  );

  return (
    <Page title="Artists" subtitle={total ? `${total.toLocaleString()} artists` : undefined} onMenuClick={onMenuClick}>
      {indexes.loading && (
        <div className="fz-grid fz-grid--tight">
          {Array.from({ length: 18 }, (_, i) => <CardSkeleton key={i} rounded />)}
        </div>
      )}
      {(indexes.data ?? []).map((group) => (
        <section key={group.name} className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">{group.name}</h2></div>
          <div className="fz-grid fz-grid--tight">
            {group.artist.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}
          </div>
        </section>
      ))}
    </Page>
  );
}

/* -------------------------------------------------------------------- songs */

export function LibrarySongs({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const songs = useAsync((signal) => getRandomSongs({ size: 500 }, signal), []);

  return (
    <Page
      title="Songs"
      subtitle="A rolling sample of your library — reload for a different cut."
      onMenuClick={onMenuClick}
      actions={
        <button
          type="button"
          className="fz-btn fz-btn--accent"
          onClick={() => songs.data && actions.playQueue(songs.data, 0, { kind: 'Station', name: 'Songs' })}
        >
          <ShuffleIcon /> Shuffle
        </button>
      }
    >
      {songs.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="fz-skeleton" style={{ height: 40 }} />)}
        </div>
      ) : (
        <TrackList songs={songs.data ?? []} context={{ kind: 'Library', name: 'Songs' }} />
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
