/** One artist: top songs, the discography by kind of release, similar artists, a biography. */

import { useMemo, useState } from 'react';

import { AlbumCard, ArtistCard, Grid, Shelf } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { EllipsisIcon, HeartIcon, LinkIcon, PlayIcon, RadioIcon, ShuffleIcon } from '../components/Icons';
import { Empty, ErrorState, Page, Section } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { formatCount } from '../lib/format';
import { useArtist, useArtistInfo, useTopSongs } from '../lib/queries';
import { artistCover } from '../lib/song';
import type { Album } from '../lib/types';
import * as act from '../state/actions';
import { useIsStarred } from '../state/library';
import { artistHeader, artistMenu } from '../state/menus';
import { ui } from '../state/ui';
import { DetailSkeleton } from './AlbumDetail';
import { ListSkeleton } from './Library';

/** Last.fm biographies arrive as HTML; only the words are wanted, never the markup. */
function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a').forEach((a) => {
    if (/read more|last\.fm/i.test(a.textContent ?? '')) a.remove();
  });
  return (doc.body.textContent ?? '').replace(/[ \t]+\n/g, '\n').trim();
}

const KINDS: [string, string][] = [
  ['album', 'albums'],
  ['ep', 'eps'],
  ['single', 'singles'],
  ['compilation', 'compilations'],
  ['live', 'live'],
  ['other', 'other'],
];

function kindOf(album: Album): string {
  const types = (album.releaseTypes ?? []).map((t) => t.toLowerCase());
  if (types.includes('compilation') || album.isCompilation) return 'compilation';
  if (types.includes('live')) return 'live';
  if (types.includes('single')) return 'single';
  if (types.includes('ep')) return 'ep';
  if (types.length === 0 || types.includes('album')) return 'album';
  return 'other';
}

export function ArtistDetail({ id }: { id: string }) {
  const artist = useArtist(id);
  const info = useArtistInfo(id);
  const top = useTopSongs(artist.data?.name, 20);
  const starred = useIsStarred('artist', id);
  const [showAllTop, setShowAllTop] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  const data = artist.data;
  const name = data?.name ?? 'artist';
  const context = useMemo(() => act.artistContext({ id, name }), [id, name]);

  const groups = useMemo(() => {
    const albums = [...(data?.album ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    const map = new Map<string, Album[]>();
    for (const album of albums) {
      const kind = kindOf(album);
      if (!map.has(kind)) map.set(kind, []);
      map.get(kind)!.push(album);
    }
    return KINDS.filter(([kind]) => map.has(kind)).map(([kind, label]) => ({ kind, label, albums: map.get(kind)! }));
  }, [data?.album]);

  if (artist.loading) {
    return (
      <Page title="artist" head={<DetailSkeleton round />}>
        <ListSkeleton rows={6} />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page title="artist">
        {artist.error ? <ErrorState error={artist.error} onRetry={() => void artist.reload()} /> : <Empty title="artist not found" />}
      </Page>
    );
  }

  const bio = info.data?.biography ? plainText(info.data.biography) : '';
  const topSongs = top.data ?? [];
  const songCount = (data.album ?? []).reduce((sum, album) => sum + (album.songCount ?? 0), 0);
  const image = info.data?.largeImageUrl;

  let section = 0;

  return (
    <Page
      title={name}
      onRefresh={() => Promise.all([artist.reload(), info.reload(), top.reload()])}
      head={
        <div className="detail detail--artist">
          {image ? (
            <div className="art art--round detail__art is-loaded">
              <img src={image} alt="" draggable={false} loading="eager" decoding="async" />
            </div>
          ) : (
            <Artwork coverArt={artistCover(data)} name={name} size={300} round className="detail__art" eager />
          )}
          <div className="detail__info">
            <div className="label">artist</div>
            <h1 className="detail__title">{name}</h1>
            <div className="detail__meta meta">
              <span>{formatCount(data.albumCount ?? data.album?.length ?? 0, 'release')}</span>
              {songCount > 0 && <span>{formatCount(songCount, 'song')}</span>}
            </div>
            <div className="detail__keys">
              <div className="detail__primary">
                <button type="button" className="key key--primary key--lg" onClick={() => void act.playArtist(data)}>
                  <PlayIcon /> play
                </button>
                <button type="button" className="key key--lg" onClick={() => void act.playArtist(data, { shuffle: true })}>
                  <ShuffleIcon /> shuffle
                </button>
              </div>
              <div className="detail__secondary">
                <button type="button" className="key key--lg" onClick={() => void act.startRadio({ kind: 'artist', id, name })}>
                  <RadioIcon /> station
                </button>
                <button
                  type="button"
                  className={`key key--lg key--icon ${starred ? 'is-on' : ''}`}
                  aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
                  aria-pressed={starred}
                  onClick={() => void act.toggleFavourite('artist', id)}
                >
                  <HeartIcon filled={starred} />
                </button>
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label="More"
                  onClick={(event) => ui.openMenu(artistMenu(data), event.currentTarget, artistHeader(data))}
                >
                  <EllipsisIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {topSongs.length > 0 && (
        <Section
          index={++section}
          title="top songs"
          action={
            topSongs.length > 5 ? (
              <button type="button" className="section__link" onClick={() => setShowAllTop((v) => !v)}>
                {showAllTop ? 'fewer' : `all ${topSongs.length}`}
              </button>
            ) : undefined
          }
        >
          <TrackList songs={showAllTop ? topSongs : topSongs.slice(0, 5)} context={context} queue={{ songs: topSongs, offset: 0 }} />
        </Section>
      )}

      {groups.map((group) => (
        <Section key={group.kind} index={++section} title={group.label} action={<span className="meta">{group.albums.length}</span>}>
          {group.albums.length > 6 ? (
            <Grid>
              {group.albums.map((album) => (
                <AlbumCard key={album.id} album={album} subtitle={album.year ? String(album.year) : undefined} />
              ))}
            </Grid>
          ) : (
            <Shelf>
              {group.albums.map((album) => (
                <AlbumCard key={album.id} album={album} subtitle={album.year ? String(album.year) : undefined} />
              ))}
            </Shelf>
          )}
        </Section>
      ))}

      {(info.data?.similarArtist?.length ?? 0) > 0 && (
        <Section index={++section} title="similar artists">
          <Shelf>
            {info.data!.similarArtist!.slice(0, 16).map((similar) => (
              <ArtistCard key={similar.id} artist={similar} />
            ))}
          </Shelf>
        </Section>
      )}

      {bio && (
        <Section index={++section} title="about">
          <div className={`notes ${bioOpen ? 'is-open' : ''}`}>
            <p>{bio}</p>
            {bio.length > 320 && (
              <button type="button" className="section__link" onClick={() => setBioOpen((v) => !v)}>
                {bioOpen ? 'less' : 'more'}
              </button>
            )}
          </div>
          <div className="links">
            {info.data?.lastFmUrl && (
              <a className="key key--sm" href={info.data.lastFmUrl} target="_blank" rel="noreferrer noopener">
                <LinkIcon /> last.fm
              </a>
            )}
            {info.data?.musicBrainzId && (
              <a
                className="key key--sm"
                href={`https://musicbrainz.org/artist/${encodeURIComponent(info.data.musicBrainzId)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <LinkIcon /> musicbrainz
              </a>
            )}
          </div>
        </Section>
      )}
    </Page>
  );
}
