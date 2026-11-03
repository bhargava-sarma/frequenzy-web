/**
 * The library: albums, artists, songs, genres, playlists, favourites, recent
 * additions and the local history. They share enough structure to share a file.
 */

import { memo, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, Grid, PlaylistCard, SkeletonCards, Tile } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { Segmented, Spinner } from '../components/controls';
import { ChevronRightIcon, HeartIcon, HistoryIcon, PlayIcon, PlaylistIcon, PlusIcon, ShuffleIcon, TrashIcon } from '../components/Icons';
import { Empty, ErrorState, Page, Section } from '../components/Page';
import { Toolbar, type SortOption } from '../components/Toolbar';
import { TrackList } from '../components/TrackList';
import { albumArtist, formatCount, formatDurationLong } from '../lib/format';
import { clearHistory, removeFromHistory } from '../lib/history';
import { navigate } from '../lib/nav';
import { useAlbumList, useArtistIndex, useGenreSongs, useGenres, useSearch, useStarredItems } from '../lib/queries';
import { artistCover, totalDuration } from '../lib/song';
import { getAlbumList, getRandomSongs, getSongsPage, type AlbumListType } from '../lib/subsonic';
import type { Album, Artist } from '../lib/types';
import { useHistory } from '../hooks/useData';
import { useDebounced } from '../hooks/useDebounced';
import { usePaged } from '../hooks/usePaged';
import { useItemMenu } from '../hooks/useItemMenu';
import * as act from '../state/actions';
import { usePlaylists, usePlaylistsLoaded } from '../state/library';
import { albumHeader, albumMenu, artistHeader, artistMenu } from '../state/menus';
import { useSetting } from '../state/settings';
import { ui } from '../state/ui';

/* ----------------------------------------------------------- shared rows */

const AlbumRow = memo(function AlbumRow({ album }: { album: Album }) {
  const menu = useItemMenu(() => ({ entries: albumMenu(album), header: albumHeader(album) }));
  return (
    <button
      type="button"
      className="lrow"
      onClick={() => {
        if (menu.consumeClick()) return;
        navigate(`/album/${encodeURIComponent(album.id)}`);
      }}
      {...menu.handlers}
    >
      <Artwork coverArt={album.coverArt} name={album.name} size={44} className="lrow__art" />
      <span className="lrow__text">
        <span className="lrow__title truncate">{album.name}</span>
        <span className="lrow__sub truncate">
          {albumArtist(album)}
          {album.year ? ` · ${album.year}` : ''}
          {album.songCount ? ` · ${album.songCount} songs` : ''}
        </span>
      </span>
      <ChevronRightIcon className="lrow__chev" />
    </button>
  );
});

const ArtistRow = memo(function ArtistRow({ artist }: { artist: Artist }) {
  const menu = useItemMenu(() => ({ entries: artistMenu(artist), header: artistHeader(artist) }));
  return (
    <button
      type="button"
      className="lrow"
      onClick={() => {
        if (menu.consumeClick()) return;
        navigate(`/artist/${encodeURIComponent(artist.id)}`);
      }}
      {...menu.handlers}
    >
      <Artwork coverArt={artistCover(artist)} name={artist.name} size={44} round className="lrow__art" />
      <span className="lrow__text">
        <span className="lrow__title truncate">{artist.name}</span>
        <span className="lrow__sub">{formatCount(artist.albumCount, 'album')}</span>
      </span>
      <ChevronRightIcon className="lrow__chev" />
    </button>
  );
});

function AlbumCollection({ albums, loading, sentinel, more }: { albums: Album[]; loading: boolean; sentinel?: RefObject<HTMLDivElement>; more?: boolean }) {
  const view = useSetting('libraryView');
  return (
    <>
      {view === 'list' ? (
        <div className="lrows">
          {albums.map((album) => (
            <AlbumRow key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <Grid>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
          {loading && <SkeletonCards count={albums.length ? 6 : 18} />}
        </Grid>
      )}
      {view === 'list' && loading && (
        <div className="list-loading">
          <Spinner />
        </div>
      )}
      {sentinel && more && <div ref={sentinel} className="sentinel" aria-hidden="true" />}
    </>
  );
}

/* ------------------------------------------------------------------ albums */

type AlbumSort = 'alphabeticalByName' | 'alphabeticalByArtist' | 'newest' | 'recent' | 'frequent' | 'highest' | 'byYear' | 'random';

const ALBUM_SORTS: SortOption<AlbumSort>[] = [
  { id: 'alphabeticalByName', label: 'title' },
  { id: 'alphabeticalByArtist', label: 'artist' },
  { id: 'newest', label: 'recently added' },
  { id: 'recent', label: 'recently played' },
  { id: 'frequent', label: 'most played' },
  { id: 'highest', label: 'top rated' },
  { id: 'byYear', label: 'year' },
  { id: 'random', label: 'random' },
];

const SORT_KEY = 'frequenzy.albumSort.v1';

function rememberedSort(): AlbumSort {
  try {
    const value = localStorage.getItem(SORT_KEY) as AlbumSort | null;
    return value && ALBUM_SORTS.some((s) => s.id === value) ? value : 'alphabeticalByName';
  } catch {
    return 'alphabeticalByName';
  }
}

const PAGE = 120;

export function Albums() {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('sort') as AlbumSort | null;
  const sort: AlbumSort = fromUrl && ALBUM_SORTS.some((s) => s.id === fromUrl) ? fromUrl : rememberedSort();
  const [filter, setFilter] = useState('');
  const term = useDebounced(filter.trim(), 260);

  const setSort = (next: AlbumSort) => {
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      /* ignore */
    }
    setParams(next === 'alphabeticalByName' ? {} : { sort: next }, { replace: true });
  };

  const thisYear = new Date().getFullYear();
  const paged = usePaged<Album>(
    term ? null : `albums:${sort}`,
    (offset) =>
      getAlbumList(
        sort as AlbumListType,
        sort === 'byYear' ? { size: PAGE, offset, fromYear: thisYear + 1, toYear: 1 } : { size: PAGE, offset },
      ),
    PAGE,
  );
  // A filter searches the server, so it finds albums that are not loaded yet.
  const searched = useSearch(term, { artistCount: 0, albumCount: 300, songCount: 0 }, 'albums');
  const albums = term ? (searched.data?.album ?? []) : paged.items;
  const loading = term ? searched.loading : paged.loading;

  return (
    <Page
      title="albums"
      eyebrow="library"
      meta={term ? `${albums.length} matching “${term}”` : paged.items.length ? `${paged.items.length.toLocaleString()}${paged.done ? '' : '+'} albums` : undefined}
      onRefresh={() => (term ? searched.reload() : paged.reload())}
      toolbar={
        <Toolbar
          filter={filter}
          onFilter={setFilter}
          placeholder="find an album"
          sorts={ALBUM_SORTS}
          sort={sort}
          onSort={setSort}
          view
          size
        >
          <button type="button" className="key key--sm" onClick={() => void act.playRandomAlbum()}>
            <ShuffleIcon /> random
          </button>
        </Toolbar>
      }
    >
      {(term ? searched.error : paged.error && paged.items.length === 0) ? (
        <ErrorState error={term ? searched.error : new Error('The album list did not load.')} onRetry={() => (term ? void searched.reload() : void paged.reload())} />
      ) : !loading && albums.length === 0 ? (
        <Empty title={term ? `no albums match “${term}”` : 'no albums yet'} />
      ) : (
        <AlbumCollection albums={albums} loading={loading} sentinel={term ? undefined : paged.sentinel} more={!paged.done} />
      )}
    </Page>
  );
}

/* ------------------------------------------------------------ recently added */

export function RecentlyAdded() {
  const paged = usePaged<Album>('albums:newest', (offset) => getAlbumList('newest', { size: PAGE, offset }), PAGE);
  return (
    <Page title="recently added" eyebrow="library" meta="the newest arrivals on the server" onRefresh={paged.reload} toolbar={<Toolbar view size />}>
      {paged.error && paged.items.length === 0 ? (
        <ErrorState error={new Error('The list did not load.')} onRetry={() => void paged.reload()} />
      ) : (
        <AlbumCollection albums={paged.items} loading={paged.loading} sentinel={paged.sentinel} more={!paged.done} />
      )}
    </Page>
  );
}

/* ------------------------------------------------------------------ artists */

export function Artists() {
  const index = useArtistIndex();
  const [filter, setFilter] = useState('');
  const view = useSetting('libraryView');
  const term = filter.trim().toLowerCase();

  const groups = useMemo(
    () =>
      (index.data ?? [])
        .map((group) => ({
          name: group.name,
          artists: term ? group.artist.filter((a) => a.name.toLowerCase().includes(term)) : group.artist,
        }))
        .filter((group) => group.artists.length > 0),
    [index.data, term],
  );
  const total = groups.reduce((sum, group) => sum + group.artists.length, 0);

  const jump = (letter: string) => {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <Page
      title="artists"
      eyebrow="library"
      meta={total ? `${total.toLocaleString()} artists` : undefined}
      onRefresh={index.reload}
      toolbar={<Toolbar filter={filter} onFilter={setFilter} placeholder="find an artist" view size />}
    >
      {index.error && !index.data ? (
        <ErrorState error={index.error} onRetry={() => void index.reload()} />
      ) : index.loading ? (
        <Grid tight>
          <SkeletonCards count={18} round />
        </Grid>
      ) : groups.length === 0 ? (
        <Empty title={term ? `no artists match “${filter}”` : 'no artists yet'} />
      ) : (
        <div className="letters">
          {groups.length > 4 && (
            <nav className="alpha" aria-label="Jump to letter">
              {groups.map((group) => (
                <button key={group.name} type="button" onClick={() => jump(group.name)}>
                  {group.name}
                </button>
              ))}
            </nav>
          )}
          {groups.map((group) => (
            <section key={group.name} id={`letter-${group.name}`} className="letter">
              <div className="letter__head">
                <span className="letter__mark">{group.name}</span>
                <span className="section__rule" />
                <span className="meta">{group.artists.length}</span>
              </div>
              {view === 'list' ? (
                <div className="lrows">
                  {group.artists.map((artist) => (
                    <ArtistRow key={artist.id} artist={artist} />
                  ))}
                </div>
              ) : (
                <Grid tight>
                  {group.artists.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </Grid>
              )}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

/* -------------------------------------------------------------------- songs */

const SONG_PAGE = 200;

export function Songs() {
  const paged = usePaged('songs:all', (offset) => getSongsPage(offset, SONG_PAGE), SONG_PAGE);
  const context = useMemo(() => ({ kind: 'Library', name: 'songs', route: '/library/songs' }), []);

  return (
    <Page
      title="songs"
      eyebrow="library"
      meta={paged.items.length ? `${paged.items.length.toLocaleString()}${paged.done ? '' : '+'} songs` : undefined}
      onRefresh={paged.reload}
      toolbar={
        <Toolbar>
          <button type="button" className="key key--sm key--primary" disabled={!paged.items.length} onClick={() => act.playSongs(paged.items, 0, context, { shuffle: false })}>
            <PlayIcon /> play
          </button>
          <button
            type="button"
            className="key key--sm"
            onClick={() =>
              void getRandomSongs({ size: 500 })
                .then((songs) => act.playSongs(songs, 0, { kind: 'Library', name: 'every song, shuffled' }, { shuffle: false }))
                .catch(() => ui.error("couldn't reach the library"))
            }
          >
            <ShuffleIcon /> shuffle all
          </button>
        </Toolbar>
      }
    >
      {paged.error && paged.items.length === 0 ? (
        <ErrorState error={new Error('The song list did not load.')} onRetry={() => void paged.reload()} />
      ) : paged.items.length === 0 && paged.loading ? (
        <ListSkeleton />
      ) : (
        <>
          <TrackList songs={paged.items} context={context} showPlays sortable={paged.done} />
          {!paged.done && (
            <div ref={paged.sentinel} className="list-loading">
              <Spinner />
            </div>
          )}
        </>
      )}
    </Page>
  );
}

export function ListSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="list-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="list-skeleton__row">
          <div className="skeleton list-skeleton__art" />
          <div className="list-skeleton__text">
            <div className="skeleton" style={{ height: 11, width: `${40 + ((i * 17) % 40)}%` }} />
            <div className="skeleton" style={{ height: 9, width: `${20 + ((i * 11) % 30)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- genres */

export function Genres() {
  const genres = useGenres();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'songs' | 'albums' | 'name'>('songs');
  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = (genres.data ?? []).filter((g) => !term || g.value.toLowerCase().includes(term));
    if (sort === 'name') return [...list].sort((a, b) => a.value.localeCompare(b.value));
    if (sort === 'albums') return [...list].sort((a, b) => (b.albumCount ?? 0) - (a.albumCount ?? 0));
    return [...list].sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0));
  }, [filter, genres.data, sort]);

  return (
    <Page
      title="genres"
      eyebrow="library"
      meta={genres.data ? `${genres.data.length} genres` : undefined}
      onRefresh={genres.reload}
      toolbar={
        <Toolbar
          filter={filter}
          onFilter={setFilter}
          placeholder="find a genre"
          sorts={[
            { id: 'songs', label: 'most songs' },
            { id: 'albums', label: 'most albums' },
            { id: 'name', label: 'name' },
          ]}
          sort={sort}
          onSort={setSort}
        />
      }
    >
      {genres.error && !genres.data ? (
        <ErrorState error={genres.error} onRetry={() => void genres.reload()} />
      ) : genres.loading ? (
        <div className="tiles">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton tile-skeleton" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty title={filter ? `no genres match “${filter}”` : 'no genres yet'} />
      ) : (
        <div className="tiles">
          {shown.map((genre, i) => (
            <Tile
              key={genre.value}
              index={i + 1}
              title={genre.value}
              subtitle={`${(genre.songCount ?? 0).toLocaleString()} songs · ${genre.albumCount ?? 0} albums`}
              onClick={() => navigate(`/genre/${encodeURIComponent(genre.value)}`)}
              onPlay={() =>
                void getRandomSongs({ size: 200, genre: genre.value })
                  .then((songs) => act.playSongs(songs, 0, { kind: 'Genre', name: genre.value, route: `/genre/${encodeURIComponent(genre.value)}` }, { shuffle: false }))
                  .catch(() => ui.error("couldn't reach the library"))
              }
            />
          ))}
        </div>
      )}
    </Page>
  );
}

export function GenreDetail({ genre }: { genre: string }) {
  const songs = useGenreSongs(genre);
  const albums = useAlbumList('byGenre', { size: 60, genre });
  const context = useMemo(() => ({ kind: 'Genre', name: genre, route: `/genre/${encodeURIComponent(genre)}` }), [genre]);
  const list = songs.data ?? [];

  return (
    <Page
      title={genre}
      eyebrow="genre"
      meta={songs.data ? `${list.length.toLocaleString()} songs · ${formatDurationLong(totalDuration(list))}` : undefined}
      onRefresh={() => Promise.all([songs.reload(), albums.reload()])}
      toolbar={
        <Toolbar>
          <button type="button" className="key key--primary" disabled={!list.length} onClick={() => act.playSongs(list, 0, context, { shuffle: false })}>
            <PlayIcon /> play
          </button>
          <button type="button" className="key" disabled={!list.length} onClick={() => act.playSongs(list, 0, context, { shuffle: true })}>
            <ShuffleIcon /> shuffle
          </button>
        </Toolbar>
      }
    >
      {(albums.loading || (albums.data?.length ?? 0) > 0) && (
        <Section index={1} title="albums">
          <Grid>{albums.loading ? <SkeletonCards count={6} /> : (albums.data ?? []).map((album) => <AlbumCard key={album.id} album={album} />)}</Grid>
        </Section>
      )}
      <Section index={2} title="songs">
        {songs.error && !songs.data ? (
          <ErrorState error={songs.error} onRetry={() => void songs.reload()} />
        ) : songs.loading ? (
          <ListSkeleton />
        ) : (
          <TrackList songs={list} context={context} sortable />
        )}
      </Section>
    </Page>
  );
}

/* ---------------------------------------------------------------- playlists */

export function Playlists() {
  const playlists = usePlaylists();
  const loaded = usePlaylistsLoaded();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'name' | 'changed' | 'songs'>('changed');
  const view = useSetting('libraryView');

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = playlists.filter((p) => !term || p.name.toLowerCase().includes(term));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'songs') return [...list].sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0));
    return [...list].sort((a, b) => (b.changed ?? '').localeCompare(a.changed ?? ''));
  }, [filter, playlists, sort]);

  return (
    <Page
      title="playlists"
      eyebrow="library"
      meta={playlists.length ? formatCount(playlists.length, 'playlist') : undefined}
      toolbar={
        <Toolbar
          filter={filter}
          onFilter={setFilter}
          placeholder="find a playlist"
          sorts={[
            { id: 'changed', label: 'recently changed' },
            { id: 'name', label: 'name' },
            { id: 'songs', label: 'most songs' },
          ]}
          sort={sort}
          onSort={setSort}
          view
          size
        >
          <button type="button" className="key key--sm key--primary" onClick={() => act.promptNewPlaylist()}>
            <PlusIcon /> new
          </button>
        </Toolbar>
      }
    >
      {!loaded ? (
        <Grid>
          <SkeletonCards count={8} />
        </Grid>
      ) : playlists.length === 0 ? (
        <Empty
          icon={<PlaylistIcon />}
          title="no playlists yet"
          action={
            <button type="button" className="key key--primary" onClick={() => act.promptNewPlaylist()}>
              <PlusIcon /> new playlist
            </button>
          }
        >
          Make one here, or from any song's ⋯ menu.
        </Empty>
      ) : view === 'list' ? (
        <div className="lrows">
          {shown.map((playlist) => (
            <button key={playlist.id} type="button" className="lrow" onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`)}>
              <Artwork coverArt={playlist.coverArt} name={playlist.name} size={44} className="lrow__art" />
              <span className="lrow__text">
                <span className="lrow__title truncate">{playlist.name}</span>
                <span className="lrow__sub truncate">
                  {formatCount(playlist.songCount, 'song')}
                  {playlist.duration ? ` · ${formatDurationLong(playlist.duration)}` : ''}
                </span>
              </span>
              <ChevronRightIcon className="lrow__chev" />
            </button>
          ))}
        </div>
      ) : (
        <Grid>
          {shown.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </Grid>
      )}
    </Page>
  );
}

/* --------------------------------------------------------------- favourites */

type FavTab = 'songs' | 'albums' | 'artists';

export function Favourites() {
  const starred = useStarredItems();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as FavTab | null;
  const tab: FavTab = requested === 'albums' || requested === 'artists' ? requested : 'songs';
  const context = useMemo(() => ({ kind: 'Library', name: 'favourites', route: '/library/favourites' }), []);
  const songs = starred.data?.song ?? [];
  const albums = starred.data?.album ?? [];
  const artists = starred.data?.artist ?? [];

  let body: ReactNode;
  if (starred.error && !starred.data) body = <ErrorState error={starred.error} onRetry={() => void starred.reload()} />;
  else if (starred.loading) body = tab === 'songs' ? <ListSkeleton /> : <Grid><SkeletonCards count={12} round={tab === 'artists'} /></Grid>;
  else if (tab === 'songs')
    body = songs.length ? (
      <TrackList songs={songs} context={context} sortable />
    ) : (
      <Empty icon={<HeartIcon />} title="no favourite songs">Tap the heart on any song to keep it here.</Empty>
    );
  else if (tab === 'albums')
    body = albums.length ? (
      <Grid>{albums.map((album) => <AlbumCard key={album.id} album={album} />)}</Grid>
    ) : (
      <Empty icon={<HeartIcon />} title="no favourite albums" />
    );
  else
    body = artists.length ? (
      <Grid tight>{artists.map((artist) => <ArtistCard key={artist.id} artist={artist} />)}</Grid>
    ) : (
      <Empty icon={<HeartIcon />} title="no favourite artists" />
    );

  return (
    <Page
      title="favourites"
      eyebrow="library"
      meta={starred.data ? `${songs.length} songs · ${albums.length} albums · ${artists.length} artists` : undefined}
      onRefresh={starred.reload}
      toolbar={
        <Toolbar>
          <Segmented<FavTab>
            label="Show"
            value={tab}
            onChange={(value) => setParams(value === 'songs' ? {} : { tab: value }, { replace: true })}
            options={[
              { value: 'songs', label: `songs ${songs.length}` },
              { value: 'albums', label: `albums ${albums.length}` },
              { value: 'artists', label: `artists ${artists.length}` },
            ]}
          />
          {tab === 'songs' && songs.length > 0 && (
            <div className="toolbar__group">
              <button type="button" className="key key--sm key--primary" onClick={() => act.playSongs(songs, 0, context, { shuffle: false })}>
                <PlayIcon /> play
              </button>
              <button type="button" className="key key--sm" onClick={() => act.playSongs(songs, 0, context, { shuffle: true })}>
                <ShuffleIcon /> shuffle
              </button>
            </div>
          )}
        </Toolbar>
      }
    >
      {body}
    </Page>
  );
}

/* ------------------------------------------------------------------ history */

export function History() {
  const entries = useHistory();
  const songs = useMemo(() => entries.map((entry) => entry.song), [entries]);
  const context = useMemo(() => ({ kind: 'Library', name: 'history', route: '/library/history' }), []);

  return (
    <Page
      title="history"
      eyebrow="played on this device"
      meta={songs.length ? `${songs.length} tracks` : undefined}
      toolbar={
        songs.length > 0 ? (
          <Toolbar>
            <button type="button" className="key key--sm key--primary" onClick={() => act.playSongs(songs, 0, context, { shuffle: false })}>
              <PlayIcon /> play
            </button>
            <button
              type="button"
              className="key key--sm"
              onClick={() =>
                ui.openDialog({
                  type: 'confirm',
                  title: 'clear history',
                  message: 'Forget every track played on this device? Listening stats are kept.',
                  confirmLabel: 'clear',
                  danger: true,
                  onConfirm: () => {
                    clearHistory();
                    ui.toast('history cleared');
                  },
                })
              }
            >
              <TrashIcon /> clear
            </button>
          </Toolbar>
        ) : undefined
      }
    >
      {songs.length === 0 ? (
        <Empty icon={<HistoryIcon />} title="nothing played yet">
          Everything you listen to on this device shows up here.
        </Empty>
      ) : (
        <TrackList
          songs={songs}
          context={context}
          onRemove={(indices) => {
            for (const i of indices) {
              const song = songs[i];
              if (song) removeFromHistory(song.id);
            }
          }}
          removeLabel="forget"
        />
      )}
    </Page>
  );
}
