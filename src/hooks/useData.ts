/** Small subscriptions to module-level sources that are not stores. */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useConnection } from './useConnection';
import { DEFAULT_PALETTE, extractPalette, type Palette } from '../lib/color';
import {
  downloadState, downloadsVersion, subscribeDownloads, type DownloadState,
} from '../lib/downloads';
import { subscribeHistory, type HistoryEntry, getHistory } from '../lib/history';
import { statsVersion, subscribeStats } from '../lib/stats';
import { coverArtUrl } from '../lib/subsonic';

/** Re-renders whenever anything about downloads changes. */
export function useDownloadsVersion(): number {
  return useSyncExternalStore(subscribeDownloads, downloadsVersion, downloadsVersion);
}

export function useDownloadState(songId: string | undefined): DownloadState {
  useDownloadsVersion();
  return songId ? downloadState(songId) : { status: 'idle' };
}

export function useHistory(): HistoryEntry[] {
  const [entries, setEntries] = useState<HistoryEntry[]>(getHistory);
  useEffect(() => subscribeHistory(setEntries), []);
  return entries;
}

export function useStatsVersion(): number {
  return useSyncExternalStore(subscribeStats, statsVersion, statsVersion);
}

/** The palette of a cover, for tinting the full player. */
export function useArtworkPalette(coverArt: string | undefined, enabled = true): Palette {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  useEffect(() => {
    if (!coverArt || !enabled) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    let alive = true;
    void extractPalette(coverArtUrl(coverArt, 128)).then((result) => {
      if (alive) setPalette(result);
    });
    return () => {
      alive = false;
    };
  }, [coverArt, enabled]);
  return palette;
}

export function useOnline(): boolean {
  const state = useConnection();
  return state.status !== 'offline';
}
