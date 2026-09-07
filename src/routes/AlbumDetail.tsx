/** One album: cover, credits, the track list, and everything else by that artist. */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AlbumCard, Shelf } from '../components/Cards';
import { Artwork } from '../components/Artwork';
import { DownloadButton } from '../components/DownloadButton';
import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { useContextMenu } from '../components/ContextMenu';
import { EllipsisIcon, HeartIcon, PlayIcon, ShuffleIcon } from '../components/Icons';
import { albumArtist, formatDurationLong, formatCount, qualityBadge } from '../lib/format';
import { getAlbum, getArtist } from '../lib/subsonic';
import { useAsync } from '../hooks/useAsync';
import { useDialogs } from '../state/dialogs';
import { useLibrary } from '../state/library';
import { usePlayer } from '../state/player';
import { useMediaMenu } from '../hooks/useMediaMenu';

export function AlbumDetail() {
  const { id = '' } = useParams();
  const albumId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { actions } = usePlayer();
  const { isStarred, toggleStar } = useLibrary();
  const { addToPlaylist } = useDialogs();
  const { albumMenu } = useMediaMenu();
  const { openAt, menu } = useContextMenu();

  const album = useAsync((signal) => getAlbum(albumId, signal), [albumId]);
  const artist = useAsync(
    (signal) => (album.data?.artistId ? getArtist(album.data.artistId, signal) : Promise.resolve(null)),
    [album.data?.artistId],
  );

  const songs = useMemo(() => album.data?.song ?? [], [album.data]);
  const context = { kind: 'Album', name: album.data?.name ?? '', id: albumId };
  const starred = isStarred('album', albumId);

  /** Multi-disc albums get a heading per disc, the way Music does. */
  const discs = useMemo(() => {
    const map = new Map<number, typeof songs>();
    for (const song of songs) {
      const disc = song.discNumber ?? 1;
      if (!map.has(disc)) map.set(disc, []);
      map.get(disc)!.push(song);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [songs]);

  const badge = qualityBadge(songs[0]);
  const otherAlbums = (artist.data?.album ?? []).filter((a) => a.id !== albumId);

  if (album.loading) {
    return (
      <Page title="Album">
        <div className="fz-detail-head">
          <div className="fz-skeleton" style={{ width: 232, height: 232, borderRadius: 'var(--radius-lg)' }} />
          <div style={{ flex: 1, alignSelf: 'flex-end' }}>
            <div className="fz-skeleton" style={{ height: 28, width: '46%', marginBottom: 10 }} />
            <div className="fz-skeleton" style={{ height: 18, width: '30%' }} />
          </div>
        </div>
      </Page>
    );
  }

  if (!album.data) {
    return (
      <Page title="Album">
        <div className="fz-empty"><div className="fz-empty__title">Album not found</div></div>
      </Page>
    );
  }

  const data = album.data;

  return (
    <Page title={data.name} showTitle={false}>
      <div className="fz-detail-head">
        <Artwork coverArt={data.coverArt} name={data.name} size={600} className="fz-detail-head__art" />
        <div className="fz-detail-head__info">
          <h1 className="fz-detail-head__title">{data.name}</h1>
          <div
            className="fz-detail-head__artist"
            role="button"
            tabIndex={0}
            onClick={() => data.artistId && navigate(`/artist/${encodeURIComponent(data.artistId)}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && data.artistId) navigate(`/artist/${encodeURIComponent(data.artistId)}`);
            }}
          >
            {albumArtist(data)}
          </div>
          <div className="fz-detail-head__meta">
            {[data.genre, data.year, formatCount(data.songCount, 'song'), formatDurationLong(data.duration)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {badge?.lossless && (
            <div style={{ marginTop: 8 }}>
              <span className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : 'fz-badge--lossless'}`}>
                {badge.label} · {badge.detail}
              </span>
            </div>
          )}

          <div className="fz-detail-head__actions">
            <button type="button" className="fz-btn fz-btn--solid" onClick={() => actions.playQueue(songs, 0, context)}>
              <PlayIcon /> Play
            </button>
            <button
              type="button"
              className="fz-btn"
              onClick={() => {
                const order = [...songs].sort(() => Math.random() - 0.5);
                actions.playQueue(order, 0, context);
              }}
            >
              <ShuffleIcon /> Shuffle
            </button>
            <button
              type="button"
              className={`fz-icon-btn ${starred ? 'is-on' : ''}`}
              aria-label={starred ? 'Remove from Favourites' : 'Add to Favourites'}
              onClick={() => void toggleStar('album', albumId)}
            >
              <HeartIcon filled={starred} />
            </button>
            <DownloadButton songs={songs} />
            <button
              type="button"
              className="fz-icon-btn"
              aria-label="More options"
              onClick={(event) => openAt(event.currentTarget, albumMenu(data, songs, addToPlaylist))}
            >
              <EllipsisIcon />
            </button>
          </div>
        </div>
      </div>

      {discs.map(([disc, discSongs]) => (
        <section key={disc} className="fz-section">
          {discs.length > 1 && (
            <div className="fz-section__head">
              <h2 className="fz-section__title" style={{ fontSize: 15 }}>Disc {disc}</h2>
            </div>
          )}
          <TrackList songs={discSongs} context={context} variant="numbered" showAlbum={false} />
        </section>
      ))}

      {otherAlbums.length > 0 && (
        <Shelf title={`More by ${albumArtist(data)}`}>
          {otherAlbums.map((other) => <AlbumCard key={other.id} album={other} />)}
        </Shelf>
      )}
      {menu}
    </Page>
  );
}
