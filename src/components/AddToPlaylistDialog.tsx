/** Pick an existing playlist, or spin up a new one, for the selected tracks. */

import { useState } from 'react';
import { Dialog } from './Dialog';
import { Artwork } from './Artwork';
import { PlusIcon } from './Icons';
import { formatCount } from '../lib/format';
import type { Song } from '../lib/types';
import { useLibrary } from '../state/library';

interface AddToPlaylistDialogProps {
  songs: Song[];
  onClose: () => void;
}

export function AddToPlaylistDialog({ songs, onClose }: AddToPlaylistDialogProps) {
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const label = songs.length === 1 ? `“${songs[0].title}”` : `${songs.length} songs`;

  const handleExisting = async (playlistId: string) => {
    setBusy(true);
    try {
      await addToPlaylist(playlistId, songs);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createPlaylist(trimmed, songs.map((s) => s.id));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Add to Playlist" onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Adding {label}</div>

      {creating ? (
        <>
          <div className="fz-field">
            <label htmlFor="fz-new-playlist">Playlist name</label>
            <input
              id="fz-new-playlist"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreate();
              }}
              placeholder="New Playlist"
            />
          </div>
          <div className="fz-dialog__actions">
            <button type="button" className="fz-btn" onClick={() => setCreating(false)}>Back</button>
            <button type="button" className="fz-btn fz-btn--solid" disabled={!name.trim() || busy} onClick={() => void handleCreate()}>
              Create
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className="fz-menu__item" onClick={() => setCreating(true)} style={{ height: 40 }}>
            <PlusIcon />
            <span>New Playlist…</span>
          </button>

          <div className="fz-scroll" style={{ maxHeight: 280, margin: '0 -6px' }}>
            {playlists.length === 0 && (
              <div style={{ padding: '18px 8px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                No playlists yet.
              </div>
            )}
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="fz-menu__item"
                style={{ height: 44 }}
                disabled={busy}
                onClick={() => void handleExisting(playlist.id)}
              >
                <Artwork coverArt={playlist.coverArt} name={playlist.name} size={80} className="fz-playlist-item__art" />
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span className="fz-truncate">{playlist.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{formatCount(playlist.songCount, 'song')}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}
