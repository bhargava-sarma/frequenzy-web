/** Everything kept on this device, what is still arriving, and what it costs. */

import { useEffect, useMemo, useState } from 'react';

import { Artwork } from '../components/Artwork';
import { CloseIcon, DownloadIcon, HeartIcon, PlayIcon, ShuffleIcon, TrashIcon } from '../components/Icons';
import { Empty, Page, Section } from '../components/Page';
import { Toolbar } from '../components/Toolbar';
import { TrackList } from '../components/TrackList';
import {
  activeDownloads, cancelAllDownloads, cancelDownload, getDownloads, isSupported, removeAllDownloads, removeDownloads,
  storageEstimate, totalBytes,
} from '../lib/downloads';
import { formatBytes, songArtist } from '../lib/format';
import { getStarred } from '../lib/subsonic';
import { useDownloadsVersion } from '../hooks/useData';
import * as act from '../state/actions';
import { ui } from '../state/ui';

const SEGMENTS = 32;

export function Downloads() {
  const version = useDownloadsVersion();
  const records = useMemo(() => getDownloads(), [version]);
  const queue = useMemo(() => activeDownloads(), [version]);
  const songs = useMemo(() => records.map((r) => r.song), [records]);
  const used = useMemo(() => totalBytes(), [version]);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const context = useMemo(() => ({ kind: 'Library', name: 'downloads', route: '/library/downloads' }), []);

  useEffect(() => {
    void storageEstimate().then(setEstimate);
  }, [records.length]);

  if (!isSupported()) {
    return (
      <Page title="downloads" eyebrow="this device">
        <Empty icon={<DownloadIcon />} title="offline storage unavailable">
          This browser does not offer IndexedDB, so tracks cannot be kept on the device.
        </Empty>
      </Page>
    );
  }

  const share = estimate && estimate.quota > 0 ? Math.min(1, estimate.usage / estimate.quota) : 0;
  const lit = Math.max(estimate?.usage ? 1 : 0, Math.round(share * SEGMENTS));

  return (
    <Page
      title="downloads"
      eyebrow="this device"
      meta={songs.length ? `${songs.length} tracks · ${formatBytes(used)}` : undefined}
      toolbar={
        <Toolbar>
          {songs.length > 0 && (
            <>
              <button type="button" className="key key--sm key--primary" onClick={() => act.playSongs(songs, 0, context, { shuffle: false })}>
                <PlayIcon /> play
              </button>
              <button type="button" className="key key--sm" onClick={() => act.playSongs(songs, 0, context, { shuffle: true })}>
                <ShuffleIcon /> shuffle
              </button>
            </>
          )}
          <button
            type="button"
            className="key key--sm"
            onClick={() =>
              void getStarred()
                .then((result) => act.download(result.song))
                .catch(() => ui.error("couldn't reach the library"))
            }
          >
            <HeartIcon /> download favourites
          </button>
          {songs.length > 0 && (
            <button
              type="button"
              className="key key--sm key--danger"
              onClick={() =>
                ui.openDialog({
                  type: 'confirm',
                  title: 'remove all downloads',
                  message: `Delete ${songs.length} tracks (${formatBytes(used)}) from this device? They stay on the server.`,
                  confirmLabel: 'remove all',
                  danger: true,
                  onConfirm: () => void removeAllDownloads().then(() => ui.toast('downloads removed')),
                })
              }
            >
              <TrashIcon /> remove all
            </button>
          )}
        </Toolbar>
      }
    >
      {estimate && estimate.quota > 0 && (
        <div className="storage">
          <div className="storage__meter" aria-hidden="true">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <span key={i} className={i < lit ? 'is-on' : ''} />
            ))}
          </div>
          <div className="storage__label meta">
            {formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)} the browser allows
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <Section
          title="downloading"
          action={
            <button type="button" className="section__link" onClick={cancelAllDownloads}>
              cancel all
            </button>
          }
        >
          <div className="dlqueue">
            {queue.map(({ song, state }) => (
              <div key={song.id} className="dlrow">
                <Artwork coverArt={song.coverArt} name={song.title} size={36} className="dlrow__art" />
                <div className="dlrow__text">
                  <div className="truncate">{song.title}</div>
                  <div className="dlrow__sub truncate">
                    {songArtist(song)}
                    {state.status === 'downloading' && state.total > 0 ? ` · ${formatBytes(state.received)} of ${formatBytes(state.total)}` : ''}
                    {state.status === 'queued' ? ' · waiting' : ''}
                    {state.status === 'error' ? ` · failed: ${state.message}` : ''}
                  </div>
                  <div className="dlrow__bar">
                    <div style={{ transform: `scaleX(${state.status === 'downloading' ? state.progress : 0})` }} />
                  </div>
                </div>
                <button type="button" className="ibtn ibtn--sm" aria-label={`Cancel ${song.title}`} onClick={() => cancelDownload(song.id)}>
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {songs.length === 0 && queue.length === 0 ? (
        <Empty icon={<DownloadIcon />} title="nothing downloaded">
          Download an album, a playlist or a track from its ⋯ menu to play it with no server in reach.
        </Empty>
      ) : (
        songs.length > 0 && (
          <Section title="on this device">
            <TrackList
              songs={songs}
              context={context}
              sortable
              removeLabel="delete"
              onRemove={(indices) => {
                const ids = indices.map((i) => songs[i]?.id).filter((x): x is string => Boolean(x));
                void removeDownloads(ids).then(() => ui.toast(`removed ${ids.length} download${ids.length === 1 ? '' : 's'}`));
              }}
            />
          </Section>
        )
      )}
    </Page>
  );
}
