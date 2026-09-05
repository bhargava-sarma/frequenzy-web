/** One artist: hero image, top songs, discography and a short biography. */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { AlbumCard, ArtistCard, Shelf } from '../components/Cards';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { HeartIcon, PlayIcon, ShuffleIcon } from '../components/Icons';
import { formatCount } from '../lib/format';
import { coverArtUrl, getAlbum, getArtist, getArtistInfo, getTopSongs } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import type { Song } from '../lib/types';

export function ArtistDetail() {
  const { id = '' } = useParams();
  const artistId = decodeURIComponent(id);
  const { actions } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();

  const artist = useAsync((signal) => getArtist(artistId, signal), [artistId]);
  const info = useAsync((signal) => getArtistInfo(artistId, signal), [artistId]);
  const topSongs = useAsync(
    (signal) => (artist.data?.name ? getTopSongs(artist.data.name, 10, signal) : Promise.resolve([])),
    [artist.data?.name],
  );

  const albums = useMemo(
    () => (artist.data?.album ?? []).slice().sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    [artist.data],
  );

  const starred = isStarred('artist', artistId);
  const heroImage = info.data?.largeImageUrl || (artist.data?.coverArt ? coverArtUrl(artist.data.coverArt, 1200) : '');

  /** Play everything: fetch each album's tracks, in release order. */
  const playAll = async (shuffle: boolean) => {
    const loaded = await Promise.all(albums.map((album) => getAlbum(album.id).catch(() => null)));
    const songs = loaded.flatMap((album) => album?.song ?? []) as Song[];
    if (songs.length === 0) return;
    const order = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    actions.playQueue(order, 0, { kind: 'Artist', name: artist.data?.name ?? '', id: artistId });
  };

  const name = artist.data?.name ?? 'Artist';

  return (
    <Page
      title={name}
      hero={
        <div className="fz-artist-hero">
          {heroImage && <img className="fz-artist-hero__bg" src={heroImage} alt="" />}
          <div className="fz-artist-hero__veil" />
          <div style={{ position: 'relative', width: '100%' }}>
            <h1 className="fz-artist-hero__name fz-truncate">{name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
              <button type="button" className="fz-btn fz-btn--solid" onClick={() => void playAll(false)}>
                <PlayIcon /> Play
              </button>
              <button type="button" className="fz-btn" onClick={() => void playAll(true)}>
                <ShuffleIcon /> Shuffle
              </button>
              <button
                type="button"
                className={`fz-icon-btn ${starred ? 'is-on' : ''}`}
                aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
                onClick={() => void toggleStar('artist', artistId)}
              >
                <HeartIcon filled={starred} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
                {formatCount(artist.data?.albumCount ?? albums.length, 'album')}
              </span>
            </div>
          </div>
        </div>
      }
    >
      {(topSongs.data?.length ?? 0) > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Top Songs</h2></div>
          <TrackList songs={topSongs.data ?? []} context={{ kind: 'Artist', name, id: artistId }} />
        </section>
      )}

      {albums.length > 0 && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">Albums</h2></div>
          <div className="fz-grid">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} subtitle={album.year ? String(album.year) : undefined} />
            ))}
          </div>
        </section>
      )}

      {info.data?.biography && (
        <section className="fz-section">
          <div className="fz-section__head"><h2 className="fz-section__title">About</h2></div>
          <p
            style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)', maxWidth: 720 }}
            // Last.fm biographies arrive with a trailing link; strip the markup.
            dangerouslySetInnerHTML={{ __html: info.data.biography.replace(/<a\b[^>]*>.*?<\/a>/gi, '').trim() }}
          />
        </section>
      )}

      {(info.data?.similarArtist?.length ?? 0) > 0 && (
        <Shelf title="Similar Artists">
          {(info.data?.similarArtist ?? []).slice(0, 16).map((similar) => (
            <ArtistCard key={similar.id} artist={similar} />
          ))}
        </Shelf>
      )}
    </Page>
  );
}
