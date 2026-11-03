/** Every dialog, raised from anywhere through the UI store. */

import { useEffect, useMemo, useRef, useState } from 'react';

import { Artwork } from '../Artwork';
import { Spinner } from '../controls';
import { Dialog } from './Dialog';
import { CheckIcon, MoonIcon, PlusIcon, SearchIcon } from '../Icons';
import { TrackDetails } from '../TrackDetails';
import { formatCount, formatTime, songArtist } from '../../lib/format';
import { chooseLyrics, hasChosenLyrics, searchLyrics, type LyricsCandidate } from '../../lib/lyrics';
import type { Song } from '../../lib/types';
import * as act from '../../state/actions';
import { usePlaylists } from '../../state/library';
import { player, usePlayer } from '../../state/player';
import { SHORTCUTS } from '../../state/shortcuts';
import { ui, useUI, type DialogRequest } from '../../state/ui';

export function DialogHost() {
  const dialog = useUI((s) => s.dialog);
  if (!dialog) return null;
  return <DialogSwitch dialog={dialog} />;
}

function DialogSwitch({ dialog }: { dialog: DialogRequest }) {
  const close = () => ui.closeDialog();
  switch (dialog.type) {
    case 'addToPlaylist':
      return <AddToPlaylistDialog songs={dialog.songs} onClose={close} />;
    case 'prompt':
      return <PromptDialog request={dialog} onClose={close} />;
    case 'confirm':
      return (
        <Dialog
          title={dialog.title}
          onClose={close}
          actions={
            <>
              <button type="button" className="key" onClick={close}>
                cancel
              </button>
              <button
                type="button"
                className={`key ${dialog.danger ? 'key--danger' : 'key--primary'}`}
                onClick={() => {
                  close();
                  dialog.onConfirm();
                }}
              >
                {dialog.confirmLabel}
              </button>
            </>
          }
        >
          <p className="dialog__text">{dialog.message}</p>
        </Dialog>
      );
    case 'trackInfo':
      return (
        <Dialog title="track info" label="spec" onClose={close} wide>
          <TrackDetails song={dialog.song} />
        </Dialog>
      );
    case 'sleep':
      return <SleepDialog onClose={close} />;
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />;
    case 'lyricsSearch':
      return <LyricsSearchDialog song={dialog.song} onClose={close} />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------- add to playlist */

function AddToPlaylistDialog({ songs, onClose }: { songs: Song[]; onClose: () => void }) {
  const playlists = usePlaylists();
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? playlists.filter((p) => p.name.toLowerCase().includes(term)) : playlists;
  }, [filter, playlists]);

  return (
    <Dialog title="add to playlist" label={act.describe(songs)} onClose={onClose}>
      <div className="input">
        <SearchIcon />
        <input
          value={filter}
          placeholder="find a playlist"
          aria-label="Find a playlist"
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && shown[0]) {
              onClose();
              void act.addToPlaylist(shown[0], songs);
            }
          }}
        />
      </div>
      <div className="picklist">
        <button
          type="button"
          className="picklist__row"
          onClick={() => {
            onClose();
            act.promptNewPlaylist(songs, filter.trim());
          }}
        >
          <span className="picklist__icon">
            <PlusIcon />
          </span>
          <span className="picklist__text">
            <span className="picklist__title">new playlist{filter.trim() ? ` “${filter.trim()}”` : '…'}</span>
          </span>
        </button>
        {shown.map((playlist) => (
          <button
            key={playlist.id}
            type="button"
            className="picklist__row"
            onClick={() => {
              onClose();
              void act.addToPlaylist(playlist, songs);
            }}
          >
            <Artwork coverArt={playlist.coverArt} name={playlist.name} size={36} className="picklist__art" />
            <span className="picklist__text">
              <span className="picklist__title truncate">{playlist.name}</span>
              <span className="picklist__sub">{formatCount(playlist.songCount, 'song')}</span>
            </span>
          </button>
        ))}
        {shown.length === 0 && playlists.length > 0 && <div className="picklist__empty">no playlist matches</div>}
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------------- prompt */

function PromptDialog({ request, onClose }: { request: Extract<DialogRequest, { type: 'prompt' }>; onClose: () => void }) {
  const [value, setValue] = useState(request.initialValue);
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    field.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed && !request.multiline) return;
    onClose();
    request.onConfirm(trimmed);
  };

  return (
    <Dialog
      title={request.title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="key" onClick={onClose}>
            cancel
          </button>
          <button type="button" className="key key--primary" onClick={submit} disabled={!value.trim() && !request.multiline}>
            {request.confirmLabel}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="label">{request.label}</span>
        <span className={`input ${request.multiline ? 'input--area' : ''}`}>
          {request.multiline ? (
            <textarea
              ref={(el) => (field.current = el)}
              value={value}
              placeholder={request.placeholder}
              rows={4}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
              }}
            />
          ) : (
            <input
              ref={(el) => (field.current = el)}
              value={value}
              placeholder={request.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
          )}
        </span>
      </label>
    </Dialog>
  );
}

/* ------------------------------------------------------------ sleep timer */

const PRESETS = [5, 10, 15, 30, 45, 60, 90, 120];

function SleepDialog({ onClose }: { onClose: () => void }) {
  const sleep = usePlayer((s) => s.sleep);
  const [custom, setCustom] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    if (sleep?.mode !== 'countdown') return;
    const handle = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(handle);
  }, [sleep]);

  const start = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    player.setSleep({ mode: 'countdown', endsAt: Date.now() + minutes * 60_000 });
    ui.toast(`sleep in ${minutes} min`);
    onClose();
  };

  const remaining = sleep?.mode === 'countdown' ? Math.max(0, Math.round((sleep.endsAt - Date.now()) / 1000)) : 0;

  return (
    <Dialog
      title="sleep timer"
      label="zz"
      onClose={onClose}
      actions={
        sleep ? (
          <button
            type="button"
            className="key"
            onClick={() => {
              player.setSleep(null);
              ui.toast('sleep timer off');
              onClose();
            }}
          >
            turn off
          </button>
        ) : undefined
      }
    >
      {sleep && (
        <div className="sleep__now">
          <MoonIcon />
          <span className="sleep__readout tnum">
            {sleep.mode === 'endOfTrack' ? 'end of this track' : formatTime(remaining)}
          </span>
        </div>
      )}
      <div className="sleep__grid">
        {PRESETS.map((minutes) => (
          <button key={minutes} type="button" className="key sleep__key" onClick={() => start(minutes)}>
            <span className="tnum">{minutes}</span>
            <span className="label">min</span>
          </button>
        ))}
      </div>
      <div className="sleep__row">
        <span className="input input--mono" style={{ flex: 1 }}>
          <input
            inputMode="numeric"
            value={custom}
            placeholder="custom minutes"
            aria-label="Custom minutes"
            onChange={(event) => setCustom(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') start(Number(custom));
            }}
          />
        </span>
        <button type="button" className="key" disabled={!custom} onClick={() => start(Number(custom))}>
          set
        </button>
      </div>
      <button
        type="button"
        className={`key sleep__eot ${sleep?.mode === 'endOfTrack' ? 'is-on' : ''}`}
        onClick={() => {
          player.setSleep({ mode: 'endOfTrack', endsAt: 0 });
          ui.toast('stopping at the end of this track');
          onClose();
        }}
      >
        {sleep?.mode === 'endOfTrack' ? <CheckIcon /> : <MoonIcon />} stop at the end of this track
      </button>
      <p className="dialog__note">The music fades out over a few seconds rather than cutting off.</p>
    </Dialog>
  );
}

/* -------------------------------------------------------------- shortcuts */

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof SHORTCUTS>();
    for (const shortcut of SHORTCUTS) {
      if (!map.has(shortcut.group)) map.set(shortcut.group, []);
      map.get(shortcut.group)!.push(shortcut);
    }
    return [...map.entries()];
  }, []);
  return (
    <Dialog title="keyboard" label="?" onClose={onClose} wide>
      <div className="keys-sheet">
        {groups.map(([group, list]) => (
          <section key={group} className="keys-sheet__group">
            <h3 className="label">{group}</h3>
            {list.map((shortcut) => (
              <div key={shortcut.label} className="keys-sheet__row">
                <span className="keys-sheet__caps">
                  {shortcut.keys.map((key, i) => (
                    <kbd key={i} className="kbd">
                      {key}
                    </kbd>
                  ))}
                </span>
                <span className="keys-sheet__label">{shortcut.label}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------- lyrics search */

function LyricsSearchDialog({ song, onClose }: { song: Song; onClose: () => void }) {
  const [track, setTrack] = useState(song.title);
  const [artist, setArtist] = useState(songArtist(song));
  const [results, setResults] = useState<LyricsCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const run = async () => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError(null);
    try {
      const found = await searchLyrics({ track: track.trim(), artist: artist.trim() || undefined }, c.signal);
      if (!c.signal.aborted) setResults(found);
    } catch {
      if (!c.signal.aborted) setError('LRCLIB did not answer. Is this device online?');
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  };

  useEffect(() => {
    void run();
    return () => controller.current?.abort();
    // Search once on open with the song's own tags.
  }, []);

  return (
    <Dialog
      title="find lyrics"
      label="lrclib"
      onClose={onClose}
      wide
      actions={
        hasChosenLyrics(song.id) ? (
          <button
            type="button"
            className="key"
            onClick={() => {
              chooseLyrics(song.id, null);
              ui.toast('back to automatic lyrics');
              onClose();
            }}
          >
            use automatic match
          </button>
        ) : undefined
      }
    >
      <form
        className="lyrics-search__form"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <span className="input">
          <input value={track} onChange={(event) => setTrack(event.target.value)} placeholder="title" aria-label="Title" />
        </span>
        <span className="input">
          <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="artist" aria-label="Artist" />
        </span>
        <button type="submit" className="key key--primary" disabled={!track.trim() || busy}>
          {busy ? <Spinner /> : <SearchIcon />} search
        </button>
      </form>
      {error && <p className="dialog__note">{error}</p>}
      <div className="picklist picklist--tall">
        {results?.length === 0 && <div className="picklist__empty">nothing found — try fewer words</div>}
        {results?.map((result) => (
          <button
            key={result.id}
            type="button"
            className="picklist__row"
            onClick={() => {
              chooseLyrics(song.id, result.id);
              ui.toast('lyrics updated');
              onClose();
            }}
          >
            <span className="picklist__text">
              <span className="picklist__title truncate">
                {result.track} <span className="picklist__dim">— {result.artist}</span>
              </span>
              <span className="picklist__sub truncate">
                {result.album} · {formatTime(result.duration)}
                {result.preview ? ` · ${result.preview}` : ''}
              </span>
            </span>
            <span className={`tag ${result.synced ? 'tag--accent' : ''}`}>
              {result.instrumental ? 'instr.' : result.synced ? 'synced' : 'plain'}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
