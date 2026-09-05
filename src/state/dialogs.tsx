/**
 * App-level dialogs (add-to-playlist, rename, track info) live here so any list
 * row can raise one without threading props through the whole tree.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { AddToPlaylistDialog } from '../components/AddToPlaylistDialog';
import { PromptDialog } from '../components/PromptDialog';
import { TrackInfoDialog } from '../components/TrackInfoDialog';
import type { Song } from '../lib/types';

interface PromptRequest {
  title: string;
  label: string;
  initialValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
}

interface DialogsContextValue {
  addToPlaylist: (songs: Song[]) => void;
  prompt: (request: PromptRequest) => void;
  showTrackInfo: (song: Song) => void;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [playlistSongs, setPlaylistSongs] = useState<Song[] | null>(null);
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);
  const [infoSong, setInfoSong] = useState<Song | null>(null);

  const addToPlaylist = useCallback((songs: Song[]) => {
    if (songs.length) setPlaylistSongs(songs);
  }, []);

  const prompt = useCallback((request: PromptRequest) => setPromptRequest(request), []);
  const showTrackInfo = useCallback((song: Song) => setInfoSong(song), []);

  const value = useMemo(
    () => ({ addToPlaylist, prompt, showTrackInfo }),
    [addToPlaylist, prompt, showTrackInfo],
  );

  return (
    <DialogsContext.Provider value={value}>
      {children}
      {playlistSongs && <AddToPlaylistDialog songs={playlistSongs} onClose={() => setPlaylistSongs(null)} />}
      {promptRequest && (
        <PromptDialog
          title={promptRequest.title}
          label={promptRequest.label}
          initialValue={promptRequest.initialValue}
          confirmLabel={promptRequest.confirmLabel}
          onConfirm={(value) => {
            promptRequest.onConfirm(value);
            setPromptRequest(null);
          }}
          onClose={() => setPromptRequest(null)}
        />
      )}
      {infoSong && <TrackInfoDialog song={infoSong} onClose={() => setInfoSong(null)} />}
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsContextValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used inside DialogsProvider');
  return ctx;
}
