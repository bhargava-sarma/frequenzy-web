/**
 * Queue hand-off between devices.
 *
 * Navidrome can hold one play queue per user (savePlayQueue / getPlayQueue).
 * With the setting on, this device mirrors its queue there; on start-up, if
 * the server's copy is newer than anything this device saved, it offers to
 * pick up where the other device left off. It never takes over on its own.
 */

import { getPlayQueue, savePlayQueue } from '../lib/subsonic';
import { player } from './player';
import { getSettings, settingsStore } from './settings';
import { ui } from './ui';

const LAST_SAVE_KEY = 'frequenzy.queueSync.v1';

let started = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSignature = '';

function lastSavedAt(): number {
  try {
    return Number(localStorage.getItem(LAST_SAVE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function signature(): string {
  const state = player.store.get();
  return `${state.queue.map((entry) => entry.song.id).join(',')}|${state.current?.id ?? ''}`;
}

async function save(force = false): Promise<void> {
  if (!getSettings().syncQueue) return;
  const state = player.store.get();
  const songs = state.queue.filter((entry) => !entry.song.isRadio);
  if (songs.length === 0 || !state.current || state.current.isRadio) return;
  const sig = signature();
  if (!force && sig === lastSignature && !state.playing) return;
  lastSignature = sig;
  // A window around the current track keeps the request a sensible size.
  const start = Math.max(0, state.index - 100);
  const ids = songs.slice(start, start + 500).map((entry) => entry.song.id);
  try {
    await savePlayQueue(ids, state.current.id, player.currentTime() * 1000);
    localStorage.setItem(LAST_SAVE_KEY, String(Date.now()));
  } catch {
    /* the server may not support it; harmless */
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void save(), 4000);
}

/** Offer the server's queue if another device saved it more recently. */
export async function checkRemoteQueue(): Promise<void> {
  const remote = await getPlayQueue().catch(() => null);
  if (!remote?.entry?.length || !remote.current) return;
  const changed = remote.changed ? Date.parse(remote.changed) : 0;
  if (!changed || changed <= lastSavedAt() + 5000) return;

  const local = player.store.get();
  const index = remote.entry.findIndex((song) => song.id === remote.current);
  if (index < 0) return;
  const position = (remote.position ?? 0) / 1000;
  if (local.current?.id === remote.current && Math.abs(player.currentTime() - position) < 15) return;

  const song = remote.entry[index];
  ui.toast(`continue “${song.title}” from another device?`, {
    duration: 14000,
    action: {
      label: 'resume',
      run: () => {
        player.adoptQueue(remote.entry!, index, position, { kind: 'Queue', name: 'another device' });
        player.resume();
      },
    },
  });
}

export function startQueueSync(): void {
  if (started) return;
  started = true;
  if (getSettings().syncQueue) void checkRemoteQueue();

  let last = player.store.get();
  player.store.subscribe(() => {
    const next = player.store.get();
    if (next.queue !== last.queue || next.index !== last.index) scheduleSave();
    // A pause is a natural moment to hand off.
    if (last.playing && !next.playing) void save(true);
    last = next;
  });
  setInterval(() => {
    if (player.store.get().playing) void save(true);
  }, 30_000);

  let enabled = getSettings().syncQueue;
  settingsStore.subscribe(() => {
    const now = getSettings().syncQueue;
    if (now && !enabled) void save(true);
    enabled = now;
  });
  window.addEventListener('pagehide', () => void save(true));
}
