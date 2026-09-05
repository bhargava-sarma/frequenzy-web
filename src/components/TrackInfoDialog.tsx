/** "Get Info" — the technical truth about a file, including what we stream. */

import { Dialog } from './Dialog';
import { Artwork } from './Artwork';
import { formatBytes, formatTime, qualityBadge, songArtist } from '../lib/format';
import { streamUrl } from '../lib/subsonic';
import type { Song } from '../lib/types';
import { useSettings } from '../state/settings';

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 14, fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--separator)' }}>
      <span style={{ width: 118, flex: 'none', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

export function TrackInfoDialog({ song, onClose }: { song: Song; onClose: () => void }) {
  const { settings } = useSettings();
  const badge = qualityBadge(song);
  const streaming = settings.allowTranscoding ? 'Server default (transcoding allowed)' : 'Original file, bit-for-bit';

  return (
    <Dialog title="Track Info" onClose={onClose} actions={<button type="button" className="fz-btn fz-btn--solid" onClick={onClose}>Done</button>}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Artwork coverArt={song.coverArt} name={song.title} size={160} className="" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }} className="fz-truncate">{song.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }} className="fz-truncate">{songArtist(song)}</div>
          {badge && (
            <span className={`fz-badge ${badge.hiRes ? 'fz-badge--hires' : badge.lossless ? 'fz-badge--lossless' : ''}`} style={{ marginTop: 6 }}>
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto' }} className="fz-scroll">
        <Row label="Album" value={song.album ?? ''} />
        <Row label="Track" value={song.track ? String(song.track) : ''} />
        <Row label="Disc" value={song.discNumber ? String(song.discNumber) : ''} />
        <Row label="Year" value={song.year ? String(song.year) : ''} />
        <Row label="Genre" value={song.genre ?? song.genres?.map((g) => g.name).join(', ') ?? ''} />
        <Row label="Duration" value={formatTime(song.duration)} />
        <Row label="Format" value={(song.suffix ?? '').toUpperCase()} />
        <Row label="Sample rate" value={song.samplingRate ? `${(song.samplingRate / 1000).toFixed(1)} kHz` : ''} />
        <Row label="Bit depth" value={song.bitDepth ? `${song.bitDepth}-bit` : ''} />
        <Row label="Channels" value={song.channelCount ? String(song.channelCount) : ''} />
        <Row label="Bit rate" value={song.bitRate ? `${song.bitRate} kbps` : ''} />
        <Row label="File size" value={formatBytes(song.size)} />
        <Row label="Play count" value={song.playCount ? String(song.playCount) : '0'} />
        <Row label="Streaming as" value={streaming} />
        <Row label="Stream URL" value={streamUrl(song.id, { raw: !settings.allowTranscoding }).replace(/([?&])(t|s)=[^&]*/g, '$1$2=•••')} />
        <Row label="Path" value={song.path ?? ''} />
      </div>
    </Dialog>
  );
}
