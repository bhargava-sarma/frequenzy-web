/** Everything kept on this device, and what it costs in storage. */

import { useEffect, useState } from 'react';

import { Page } from '../components/Page';
import { TrackList } from '../components/TrackList';
import { DownloadIcon, TrashIcon } from '../components/Icons';
import { formatBytes } from '../lib/format';
import {
  getDownloads, isSupported, removeAllDownloads, storageEstimate, subscribeDownloads,
  totalBytes, type DownloadRecord,
} from '../lib/downloads';
import { usePlayer } from '../state/player';

export function Downloads({ onMenuClick }: { onMenuClick?: () => void }) {
  const { actions } = usePlayer();
  const [records, setRecords] = useState<DownloadRecord[]>(getDownloads);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setRecords(getDownloads());
      void storageEstimate().then(setEstimate);
    };
    refresh();
    return subscribeDownloads(refresh);
  }, []);

  const songs = records.map((record) => record.song);
  const used = totalBytes();

  if (!isSupported()) {
    return (
      <Page title="Downloaded" onMenuClick={onMenuClick}>
        <div className="fz-empty">
          <DownloadIcon />
          <div className="fz-empty__title">Offline storage unavailable</div>
          <div>This browser does not expose the Cache API, so downloads are off.</div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Downloaded"
      subtitle={songs.length ? `${songs.length} tracks · ${formatBytes(used)} on this device` : undefined}
      onMenuClick={onMenuClick}
      actions={
        songs.length > 0 ? (
          <button type="button" className="fz-btn" onClick={() => void removeAllDownloads()}>
            <TrashIcon /> Remove All
          </button>
        ) : undefined
      }
    >
      {songs.length === 0 ? (
        <div className="fz-empty">
          <DownloadIcon />
          <div className="fz-empty__title">Nothing downloaded</div>
          <div>Download an album or a track to play it with no server in reach.</div>
        </div>
      ) : (
        <>
          {estimate && estimate.quota > 0 && (
            <div className="fz-storage">
              <div className="fz-storage__bar">
                <div
                  className="fz-storage__fill"
                  style={{ width: `${Math.min(100, (estimate.usage / estimate.quota) * 100)}%` }}
                />
              </div>
              <div className="fz-storage__label">
                {formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)} available
              </div>
            </div>
          )}
          <TrackList songs={songs} context={{ kind: 'Library', name: 'Downloaded' }} />
        </>
      )}
    </Page>
  );
}
