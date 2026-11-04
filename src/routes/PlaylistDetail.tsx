/**
 * One playlist: reorder by dragging, remove by swiping or selecting, filter,
 * and everything else from the menu.
 *
 * Edits are optimistic — the list changes the moment you let go — and they
 * reach the server strictly one after another. Subsonic edits playlists by
 * index, so two edits racing each other would each be computed against an
 * order the other had already changed.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { Artwork } from '../components/Artwork';
import { DownloadIcon, EllipsisIcon, FilterIcon, PencilIcon, PlayIcon, ShuffleIcon, CheckIcon, CloseIcon } from '../components/Icons';
import { Empty, ErrorState, Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { isDownloaded } from '../lib/downloads';
import { formatCount, formatDurationLong } from '../lib/format';
import { invalidateQueries } from '../lib/query';
import { usePlaylistData } from '../lib/queries';
import { totalDuration } from '../lib/song';
import { replacePlaylistSongs, updatePlaylist } from '../lib/subsonic';
import type { Song } from '../lib/types';
import { useDownloadsVersion } from '../hooks/useData';
import * as act from '../state/actions';
import { library } from '../state/library';
import { playlistHeader, playlistMenu } from '../state/menus';
import { ui } from '../state/ui';
import { DetailSkeleton } from './AlbumDetail';
import { ListSkeleton } from './Library';

export function PlaylistDetail({ id }: { id: string }) {
  const playlist = usePlaylistData(id);
  const [local, setLocal] = useState<Song[] | null>(null);
  const [filter, setFilter] = useState('');
  const [filtering, setFiltering] = useState(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  useDownloadsVersion();

  const server = playlist.data?.entry;
  // Once the server has caught up and nothing is in flight, its order wins.
  useEffect(() => {
    if (pending.current === 0) setLocal(null);
  }, [server]);

  const songs = useMemo(() => local ?? server ?? [], [local, server]);
  const data = playlist.data;
  const context = useMemo(() => act.playlistContext({ id, name: data?.name ?? 'playlist' }), [data?.name, id]);

  const term = filter.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      term
        ? songs.filter(
            (s) =>
              s.title.toLowerCase().includes(term) ||
              (s.artist ?? '').toLowerCase().includes(term) ||
              (s.album ?? '').toLowerCase().includes(term),
          )
        : songs,
    [songs, term],
  );

  /** Run edits strictly in order; on failure, fall back to the server's copy. */
  const enqueue = (work: () => Promise<unknown>, failure: string) => {
    pending.current += 1;
    chain.current = chain.current
      .then(work)
      .catch(() => {
        ui.error(failure);
        setLocal(null);
      })
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) {
          invalidateQueries(`playlist:${id}`);
          void library.loadPlaylists();
        }
      });
  };

  const reorder = (from: number, to: number) => {
    const next = [...songs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setLocal(next);
    enqueue(() => replacePlaylistSongs(id, next.map((s) => s.id)), "couldn't save the new order");
  };

  /** `indices` are positions in the (unfiltered) list, highest first. */
  const remove = (indices: number[]) => {
    if (indices.length === 0) return;
    const drop = new Set(indices);
    const removed = songs.filter((_, i) => drop.has(i));
    const next = songs.filter((_, i) => !drop.has(i));
    setLocal(next);
    enqueue(() => updatePlaylist(id, { songIndexToRemove: [...indices].sort((a, b) => b - a) }), "couldn't remove from the playlist");
    ui.toast(removed.length === 1 ? `removed “${removed[0].title}”` : `removed ${removed.length} songs`, {
      action: {
        label: 'undo',
        run: () => {
          // Put them back where they were, then rewrite the playlist in that order.
          const restored = [...next];
          const sorted = [...indices].sort((a, b) => a - b);
          for (const index of sorted) restored.splice(index, 0, songs[index]);
          setLocal(restored);
          enqueue(() => replacePlaylistSongs(id, restored.map((s) => s.id)), "couldn't undo");
        },
      },
    });
  };

  // Filtering shows a subset; removing from it maps back to real positions.
  const removeFiltered = (indices: number[]) => {
    if (!term) {
      remove(indices);
      return;
    }
    const positions = new Map<Song, number>();
    songs.forEach((song, i) => positions.set(song, i));
    remove(indices.map((i) => positions.get(filtered[i])!).filter((n) => n !== undefined));
  };

  if (playlist.loading && !local) {
    return (
      <Page title="playlist" head={<DetailSkeleton />}>
        <ListSkeleton />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page title="playlist">
        {playlist.error ? <ErrorState error={playlist.error} onRetry={() => void playlist.reload()} /> : <Empty title="playlist not found" />}
      </Page>
    );
  }

  const duration = totalDuration(songs);
  const offline = songs.length > 0 && songs.every((s) => isDownloaded(s.id));

  return (
    <Page
      title={data.name}
      onRefresh={() => playlist.reload()}
      head={
        <div className="detail">
          <Artwork coverArt={data.coverArt} name={data.name} size={300} className="detail__art" eager />
          <div className="detail__info">
            <div className="label">
              playlist · {data.public ? 'public' : 'private'}
              {data.owner ? ` · ${data.owner}` : ''}
            </div>
            <h1 className="detail__title">{data.name}</h1>
            <button type="button" className="detail__desc" onClick={() => act.editPlaylistDescription(data)}>
              {data.comment ? data.comment : <span className="detail__desc-empty"><PencilIcon /> add a description</span>}
            </button>
            <div className="detail__meta meta">
              <span>{formatCount(songs.length, 'song')}</span>
              {duration > 0 && <span>{formatDurationLong(duration)}</span>}
              {offline && <span className="tag">offline</span>}
            </div>
            <div className="detail__keys">
              <div className="detail__primary">
                <button type="button" className="key key--primary key--lg" disabled={!songs.length} onClick={() => act.playSongs(songs, 0, context, { shuffle: false })}>
                  <PlayIcon /> play
                </button>
                <button type="button" className="key key--lg" disabled={!songs.length} onClick={() => act.playSongs(songs, 0, context, { shuffle: true })}>
                  <ShuffleIcon /> shuffle
                </button>
              </div>
              <div className="detail__secondary">
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label={offline ? 'Remove download' : 'Download'}
                  disabled={!songs.length}
                  onClick={() => (offline ? void act.removeDownloadsFor(songs) : act.download(songs))}
                >
                  {offline ? <CheckIcon /> : <DownloadIcon />}
                </button>
                {songs.length > 12 && (
                  <button
                    type="button"
                    className={`key key--lg key--icon ${filtering ? 'is-on' : ''}`}
                    aria-label="Filter this playlist"
                    aria-pressed={filtering}
                    onClick={() => {
                      setFiltering((v) => !v);
                      setFilter('');
                    }}
                  >
                    <FilterIcon />
                  </button>
                )}
                <button
                  type="button"
                  className="key key--lg key--icon"
                  aria-label="More"
                  onClick={(event) => ui.openMenu(playlistMenu(data), event.currentTarget, playlistHeader(data))}
                >
                  <EllipsisIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
      toolbar={
        filtering ? (
          <div className="toolbar">
            <div className="input toolbar__filter">
              <FilterIcon />
              <input
                autoFocus
                value={filter}
                placeholder="filter this playlist"
                aria-label="Filter this playlist"
                onChange={(event) => setFilter(event.target.value)}
              />
              {filter && (
                <button type="button" className="ibtn ibtn--sm" aria-label="Clear" onClick={() => setFilter('')}>
                  <CloseIcon />
                </button>
              )}
            </div>
            {term && <span className="meta">{filtered.length} of {songs.length}</span>}
          </div>
        ) : undefined
      }
    >
      <TrackList
        songs={filtered}
        context={context}
        playlistId={id}
        sortable
        onRemove={removeFiltered}
        removeLabel="remove"
        onReorder={term ? undefined : reorder}
        emptyText={term ? `nothing in this playlist matches “${filter}”` : 'this playlist is empty — add songs from any ⋯ menu, or drag them onto it in the sidebar.'}
      />
    </Page>
  );
}
