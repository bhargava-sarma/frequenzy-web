/** Download / downloaded / remove control for a single track or a whole album. */

import { useEffect, useState } from 'react';

import { CheckIcon, DownloadIcon } from './Icons';
import {
  downloadSongs, downloadState, isDownloaded, isSupported, removeDownload,
  subscribeDownloads,
} from '../lib/downloads';
import type { Song } from '../lib/types';

export function useDownloadTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeDownloads(() => setTick((n) => n + 1)), []);
  return tick;
}

export function DownloadButton({ songs, label }: { songs: Song[]; label?: string }) {
  useDownloadTick();
  if (!isSupported() || songs.length === 0) return null;

  const done = songs.every((song) => isDownloaded(song.id));
  const states = songs.map((song) => downloadState(song.id));
  const busy = states.some((state) => state.status === 'downloading');
  const progress =
    states.reduce((sum, state) => sum + (state.status === 'downloading' ? state.progress : state.status === 'done' ? 1 : 0), 0) /
    songs.length;

  const onClick = () => {
    if (busy) return;
    if (done) void Promise.all(songs.map((song) => removeDownload(song.id)));
    else void downloadSongs(songs);
  };

  return (
    <button
      type="button"
      className={`fz-btn ${done ? 'fz-btn--accent' : ''}`}
      onClick={onClick}
      disabled={busy}
      aria-label={done ? 'Remove download' : 'Download for offline'}
      title={done ? 'Downloaded — tap to remove' : 'Keep available offline'}
    >
      {busy ? (
        <span className="fz-download-ring" style={{ ['--p' as string]: `${Math.round(progress * 100)}%` }} />
      ) : done ? (
        <CheckIcon />
      ) : (
        <DownloadIcon />
      )}
      {label && <span>{busy ? `${Math.round(progress * 100)}%` : done ? 'Downloaded' : label}</span>}
    </button>
  );
}
