/**
 * The spec sheet for a track — the technical truth about the file, laid out
 * the way the back of a piece of hardware lists its specifications.
 */

import { Artwork } from './Artwork';
import { Stars } from './controls';
import { AlbumIcon, ArtistIcon, CopyIcon, PlayIcon, RadioIcon } from './Icons';
import { formatLabel } from './player/Display';
import { copyText } from '../lib/clipboard';
import { formatBytes, formatTime, qualityBadge, songArtist } from '../lib/format';
import { useQuery } from '../lib/query';
import { getSong } from '../lib/subsonic';
import type { Song } from '../lib/types';
import * as act from '../state/actions';
import { useRating } from '../state/library';
import { usePlayer } from '../state/player';
import { ui } from '../state/ui';

function Spec({ label, value, mono = true }: { label: string; value: string | number | undefined | null; mono?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="spec__row">
      <dt className="label">{label}</dt>
      <dd className={mono ? 'mono' : ''}>{value}</dd>
    </div>
  );
}

function gain(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} dB`;
}

export function TrackDetails({ song: initial, compact }: { song: Song; compact?: boolean }) {
  // Queue entries are stored trimmed; fetch the full record for paths and the rest.
  const full = useQuery(initial.isRadio ? null : `song:${initial.id}`, () => getSong(initial.id), { staleTime: 5 * 60_000 });
  const song = { ...initial, ...(full.data ?? {}) };
  const rating = useRating(song);
  const isCurrent = usePlayer((s) => s.current?.id === song.id);
  const source = usePlayer((s) => s.source);
  const badge = qualityBadge(song);

  if (song.isRadio) {
    return (
      <div className="details">
        <div className="details__head">
          <div className="details__text">
            <div className="details__title">{song.title}</div>
            <div className="details__sub">internet radio</div>
          </div>
        </div>
        <dl className="spec">
          <Spec label="stream" value={song.streamUrl} />
        </dl>
      </div>
    );
  }

  return (
    <div className={`details ${compact ? 'details--compact' : ''}`}>
      <div className="details__head">
        <Artwork coverArt={song.coverArt} name={song.title} size={compact ? 64 : 84} className="details__art" />
        <div className="details__text">
          <div className="details__title">{song.title}</div>
          <div className="details__sub truncate">{songArtist(song)}</div>
          {song.album && <div className="details__sub truncate">{song.album}</div>}
          <div className="details__tags">
            {badge && <span className={`tag ${badge.lossless ? 'tag--accent' : ''}`}>{badge.label}</span>}
            {song.year && <span className="tag">{song.year}</span>}
          </div>
        </div>
      </div>

      <div className="details__rating">
        <span className="label">rating</span>
        <Stars value={rating} onChange={(value) => void act.rateSong(song, value)} />
      </div>

      <dl className="spec">
        <Spec label="format" value={formatLabel(song, null)} />
        <Spec label="sample rate" value={song.samplingRate ? `${(song.samplingRate / 1000).toFixed(1)} kHz` : undefined} />
        <Spec label="bit depth" value={song.bitDepth ? `${song.bitDepth}-bit` : undefined} />
        <Spec label="channels" value={song.channelCount} />
        <Spec label="bit rate" value={song.bitRate ? `${song.bitRate} kbps` : undefined} />
        <Spec label="size" value={formatBytes(song.size)} />
        <Spec label="length" value={formatTime(song.duration)} />
        <Spec label="track" value={song.track ? `${song.track}${song.discNumber ? ` · disc ${song.discNumber}` : ''}` : undefined} />
        <Spec label="genre" value={song.genre ?? song.genres?.map((g) => g.name).join(', ')} mono={false} />
        <Spec label="bpm" value={song.bpm || undefined} />
        <Spec label="plays" value={song.playCount ?? 0} />
        <Spec label="track gain" value={gain(song.replayGain?.trackGain)} />
        <Spec label="album gain" value={gain(song.replayGain?.albumGain)} />
        <Spec label="added" value={song.created ? new Date(song.created).toLocaleDateString() : undefined} />
        {isCurrent && <Spec label="playing as" value={source?.kind === 'offline' ? 'from this device' : formatLabel(song, source)} />}
        <Spec label="path" value={song.path} />
      </dl>

      <div className="details__keys">
        <button type="button" className="key key--sm" onClick={() => act.playSongs([song], 0)}>
          <PlayIcon /> play
        </button>
        {song.albumId && (
          <button type="button" className="key key--sm" onClick={() => { ui.closeDialog(); act.goToAlbum(song); }}>
            <AlbumIcon /> album
          </button>
        )}
        {song.artistId && (
          <button type="button" className="key key--sm" onClick={() => { ui.closeDialog(); act.goToArtist(song); }}>
            <ArtistIcon /> artist
          </button>
        )}
        <button
          type="button"
          className="key key--sm"
          onClick={() => void act.startRadio({ kind: 'song', id: song.id, name: song.title, genre: song.genre, song })}
        >
          <RadioIcon /> station
        </button>
        {song.path && (
          <button
            type="button"
            className="key key--sm"
            onClick={() => void copyText(song.path!).then((ok) => (ok ? ui.toast('path copied') : ui.error("couldn't copy")))}
          >
            <CopyIcon /> path
          </button>
        )}
      </div>
    </div>
  );
}
