/** One album: the cover, its credits, the tracks, and more by the same artist. */

import { useMemo, useState } from 'react';

import { AlbumCard, Shelf } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import {
  DownloadIcon, EllipsisIcon, HeartIcon, PlayIcon, RadioIcon, ShuffleIcon, CheckIcon,
} from '../components/Icons';
import { Empty, ErrorState, Page, Section } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { albumArtist, formatDurationLong, qualityBadge } from '../lib/format';
import { navigate } from '../lib/nav';
import { useAlbum, useAlbumInfo, useArtist } from '../lib/queries';
import { useDownloadsVersion } from '../hooks/useData';
import { isDownloaded } from '../lib/downloads';
import type { Song } from '../lib/types';
import * as act from '../state/actions';
import { useIsStarred } from '../state/library';
import { albumHeader, albumMenu } from '../state/menus';
import { ui } from '../state/ui';
import { ListSkeleton } from './Library';

function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a').forEach((a) => {
    if (/read more|last\.fm/i.test(a.textContent ?? '')) a.remove();
  });
  return (doc.body.textContent ?? '').replace(/\s+\n/g, '\n').trim();
}

export function AlbumDetail({ id }: { id: string }) {
  const album = useAlbum(id);
  const info = useAlbumInfo(id);
  const artist = useArtist(album.data?.artistId);
  const starred = useIsStarred('album', id);
  const [notesOpen, setNotesOpen] = useState(false);
  useDownloadsVersion();

  const data = album.data;
  const songs = useMemo(() => data?.song ?? [], [data]);
  const context = useMemo(() => act.albumContext({ id, name: data?.name ?? '' }), [data?.name, id]);

  const discs = useMemo(() => {
    const map = new Map<number, Song[]>();
    for (const song of songs) {
      const disc = song.discNumber ?? 1;
      if (!map.has(disc)) map.set(disc, []);
      map.get(disc)!.push(song);
    }
    let offset = 0;
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([disc, list]) => {
        const entry = { disc, list, offset };
        offset += list.length;
        return entry;
      });
  }, [songs]);
  // Discs are queued as one album, in disc order.
  const ordered = useMemo(() => discs.flatMap((d) => d.list), [discs]);

  if (album.loading) {
    return (
      <Page title="album" head={<DetailSkeleton />}>
        <ListSkeleton />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page title="album">
        {album.error ? <ErrorState error={album.error} onRetry={() => void album.reload()} /> : <Empty title="album not found" />}
      </Page>
    );
  }

  const badge = qualityBadge(songs.find((s) => qualityBadge(s)?.hiRes) ?? songs[0]);
  const offline = songs.length > 0 && songs.every((s) => isDownloaded(s.id));
  const others = (artist.data?.album ?? []).filter((a) => a.id !== id).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const type = data.releaseTypes?.[0]?.toLowerCase() ?? (data.isCompilation ? 'compilation' : 'album');
  const notes = info.data?.notes ? plainText(info.data.notes) : '';
  const label = data.recordLabels?.map((l) => l.name).join(', ');

  return (
    <Page
      title={data.name}
      onRefresh={() => Promise.all([album.reload(), info.reload()])}
      head={
        <div className="detail">
          <Artwork coverArt={data.coverArt} name={data.name} size={300} className="detail__art" eager />
          <div className="detail__info">
            <div className="label">
              {type}
              {data.year ? ` · ${data.year}` : ''}
              {data.genre ? ` · ${data.genre}` : ''}
            </div>
            <h1 className="detail__title">{data.name}</h1>
            {data.artistId ? (
              <button type="button" className="detail__artist" onClick={() => navigate(`/artist/${encodeURIComponent(data.artistId!)}`)}>
                {albumArtist(data)}
              </button>
            ) : (
              <div className="detail__artist">{albumArtist(data)}</div>
            )}
            <div className="detail__meta meta">
              <span>{songs.length} songs</span>
              <span>{formatDurationLong(data.duration)}</span>
              {badge && <span className={`tag ${badge.lossless ? 'tag--accent' : ''}`}>{badge.hiRes ? `hi-res · ${badge.detail}` : badge.label}</span>}
              {offline && <span className="tag">offline</span>}
            </div>
            <div className="detail__keys">
              <div className="detail__primary">
                <button type="button" className="key key--primary key--lg" disabled={!songs.length} onClick={() => act.playSongs(ordered, 0, context, { shuffle: false })}>
                  <PlayIcon /> play
                </button>
                <button type="button" className="key key--lg" disabled={!songs.length} onClick={() => act.playSongs(ordered, 0, context, { shuffle: true })}>
                  <ShuffleIcon /> shuffle
                </button>
              </div>
              <div className="detail__secondary">
                <button
                  type="button"
                  className={`key key--lg key--icon ${starred ? 'is-on' : ''}`}
                  aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
                  aria-pressed={starred}
                  onClick={() => void act.toggleFavourite('album', id)}
                >
                  <HeartIcon filled={starred} />
                </button>
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label={offline ? 'Remove download' : 'Download'}
                  title={offline ? 'Downloaded — remove from this device' : 'Keep on this device'}
                  onClick={() => (offline ? void act.removeDownloadsFor(songs) : act.download(ordered))}
                >
                  {offline ? <CheckIcon /> : <DownloadIcon />}
                </button>
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label="Start a station"
                  title="Start a station from this album"
                  onClick={() => void act.startRadio({ kind: 'album', id, name: data.name, genre: data.genre })}
                >
                  <RadioIcon />
                </button>
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label="More"
                  onClick={(event) => ui.openMenu(albumMenu(data), event.currentTarget, albumHeader(data))}
                >
                  <EllipsisIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {discs.map(({ disc, list, offset }) => (
        <section key={disc} className="disc">
          {discs.length > 1 && (
            <div className="disc__head">
              <span className="label">disc {disc}</span>
              <span className="section__rule" />
              <span className="meta">{list.length} songs</span>
            </div>
          )}
          <TrackList
            songs={list}
            context={context}
            variant="album"
            showAlbum={false}
            albumArtistName={albumArtist(data)}
            queue={{ songs: ordered, offset }}
          />
        </section>
      ))}

      {(notes || label) && (
        <Section title="about">
          {notes && (
            <div className={`notes ${notesOpen ? 'is-open' : ''}`}>
              <p>{notes}</p>
              {notes.length > 320 && (
                <button type="button" className="section__link" onClick={() => setNotesOpen((v) => !v)}>
                  {notesOpen ? 'less' : 'more'}
                </button>
              )}
            </div>
          )}
          {label && <p className="meta notes__label">℗ {label}</p>}
        </Section>
      )}

      {others.length > 0 && (
        <Section title={`more by ${albumArtist(data)}`}>
          <Shelf>
            {others.map((other) => (
              <AlbumCard key={other.id} album={other} subtitle={other.year ? String(other.year) : undefined} />
            ))}
          </Shelf>
        </Section>
      )}
    </Page>
  );
}

export function DetailSkeleton({ round }: { round?: boolean }) {
  return (
    <div className="detail" aria-hidden="true">
      <div className={`skeleton detail__art ${round ? 'is-round' : ''}`} />
      <div className="detail__info">
        <div className="skeleton" style={{ height: 12, width: 120, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 34, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '30%' }} />
      </div>
    </div>
  );
}
