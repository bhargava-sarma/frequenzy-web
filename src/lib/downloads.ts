/**
 * Offline downloads.
 *
 * Blobs live in IndexedDB and metadata in localStorage, so the Downloads view
 * still renders with no server in sight.
 *
 * IndexedDB rather than the Cache API on purpose: the Cache API is restricted
 * to secure contexts, and Frequenzy is served over plain HTTP so it can reach a
 * plain-HTTP Navidrome. IndexedDB has no such restriction and stores Blobs
 * natively, so downloads work on a LAN address exactly as they do on localhost.
 *
 * Downloads run one at a time from a queue — a dozen parallel FLAC downloads
 * saturate the link and make every progress bar meaningless — and any of them
 * can be cancelled.
 */

import { connection } from './connection';
import { compactSong } from './song';
import { coverArtUrl, streamUrl } from './subsonic';
import type { Song } from './types';

const DB_NAME = 'frequenzy-downloads';
const DB_VERSION = 1;
const STORE = 'blobs';
const INDEX_KEY = 'frequenzy.downloads.v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    });
    // A failed open should not be cached forever.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function idbPut(key: string, value: Blob): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('write aborted'));
      }),
  );
}

function idbGet(key: string): Promise<Blob | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result as Blob | undefined);
        request.onerror = () => reject(request.error);
      }),
  );
}

function idbHas(key: string): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).count(key);
        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      }),
  );
}

function idbDelete(keys: string[]): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        for (const key of keys) tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbClear(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export interface DownloadRecord {
  song: Song;
  bytes: number;
  downloadedAt: number;
}

export type DownloadState =
  | { status: 'idle' }
  | { status: 'queued' }
  | { status: 'downloading'; progress: number; received: number; total: number }
  | { status: 'done'; bytes: number }
  | { status: 'error'; message: string };

type Listener = () => void;

let index: Record<string, DownloadRecord> = load();
const active = new Map<string, DownloadState>();
const pending: Song[] = [];
const listeners = new Set<Listener>();
let current: { id: string; controller: AbortController } | null = null;
let version = 0;

function load(): Record<string, DownloadRecord> {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, DownloadRecord>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
}

function emit() {
  version += 1;
  for (const fn of [...listeners]) fn();
}

export function subscribeDownloads(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Changes whenever anything about downloads changes; for useSyncExternalStore. */
export function downloadsVersion(): number {
  return version;
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function isDownloaded(songId: string): boolean {
  return index[songId] !== undefined;
}

export function downloadState(songId: string): DownloadState {
  const state = active.get(songId);
  if (state) return state;
  const record = index[songId];
  return record ? { status: 'done', bytes: record.bytes } : { status: 'idle' };
}

export function getDownloads(): DownloadRecord[] {
  return Object.values(index).sort((a, b) => b.downloadedAt - a.downloadedAt);
}

export function downloadCount(): number {
  return Object.keys(index).length;
}

/** Songs waiting or in flight, in the order they will run. */
export function activeDownloads(): { song: Song; state: DownloadState }[] {
  const list: { song: Song; state: DownloadState }[] = [];
  if (current) {
    const song = runningSong;
    if (song) list.push({ song, state: downloadState(song.id) });
  }
  for (const song of pending) list.push({ song, state: downloadState(song.id) });
  return list;
}

export function totalBytes(): number {
  return Object.values(index).reduce((sum, record) => sum + record.bytes, 0);
}

/** Keys are stable per song, so a changed server address still resolves. */
function keyFor(songId: string): string {
  return `track:${songId}`;
}

/** Artwork is keyed by its own cover id, since several tracks share one cover. */
function artKeyFor(coverArt: string): string {
  return `art:${coverArt}`;
}

let runningSong: Song | null = null;
let pumping = false;

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (pending.length > 0) {
      const song = pending.shift()!;
      if (index[song.id]) {
        active.delete(song.id);
        continue;
      }
      await fetchOne(song);
    }
  } finally {
    pumping = false;
    runningSong = null;
    current = null;
    emit();
  }
}

/**
 * Fetch a track and its artwork into storage.
 *
 * The stream is read in chunks so the UI can show real progress; Navidrome
 * sends a Content-Length for raw files, so the percentage is honest.
 */
async function fetchOne(song: Song): Promise<void> {
  const controller = new AbortController();
  current = { id: song.id, controller };
  runningSong = song;
  active.set(song.id, { status: 'downloading', progress: 0, received: 0, total: song.size ?? 0 });
  emit();

  try {
    await connection.ensure().catch(() => {});
    const response = await fetch(streamUrl(song.id, { quality: 'original' }), { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const total = Number(response.headers.get('Content-Length') ?? 0) || song.size || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastEmit = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const now = performance.now();
      // Progress at a sensible rate; a fast LAN delivers thousands of chunks.
      if (now - lastEmit > 120) {
        lastEmit = now;
        active.set(song.id, {
          status: 'downloading',
          progress: total > 0 ? Math.min(1, received / total) : 0,
          received,
          total,
        });
        emit();
      }
    }

    const blob = new Blob(chunks as BlobPart[], {
      type: response.headers.get('Content-Type') ?? 'audio/flac',
    });
    await idbPut(keyFor(song.id), blob);

    // Artwork too, so downloaded music still looks like itself offline.
    if (song.coverArt) {
      try {
        if (!(await idbHas(artKeyFor(song.coverArt)))) {
          const art = await fetch(coverArtUrl(song.coverArt, 600), { signal: controller.signal });
          if (art.ok) await idbPut(artKeyFor(song.coverArt), await art.blob());
        }
      } catch {
        /* artwork is optional */
      }
    }

    index[song.id] = { song: compactSong(song), bytes: blob.size, downloadedAt: Date.now() };
    persist();
    active.delete(song.id);
    emit();
  } catch (error) {
    if (controller.signal.aborted) {
      active.delete(song.id);
      emit();
      return;
    }
    active.set(song.id, {
      status: 'error',
      message: error instanceof Error ? error.message : 'Download failed',
    });
    emit();
    setTimeout(() => {
      if (active.get(song.id)?.status === 'error') {
        active.delete(song.id);
        emit();
      }
    }, 6000);
  }
}

/** Queue songs for offline storage. Returns how many were actually queued. */
export function downloadSongs(songs: Song[]): number {
  if (!isSupported()) return 0;
  let queued = 0;
  for (const song of songs) {
    if (song.isRadio || index[song.id]) continue;
    const state = active.get(song.id)?.status;
    if (state === 'queued' || state === 'downloading') continue;
    pending.push(song);
    active.set(song.id, { status: 'queued' });
    queued += 1;
  }
  if (queued) {
    emit();
    void pump();
  }
  return queued;
}

export function downloadSong(song: Song): number {
  return downloadSongs([song]);
}

export function cancelDownload(songId: string): void {
  const position = pending.findIndex((song) => song.id === songId);
  if (position >= 0) pending.splice(position, 1);
  if (current?.id === songId) current.controller.abort();
  if (active.get(songId)?.status !== 'downloading') active.delete(songId);
  emit();
}

export function cancelAllDownloads(): void {
  for (const song of pending) active.delete(song.id);
  pending.length = 0;
  current?.controller.abort();
  emit();
}

export async function removeDownload(songId: string): Promise<void> {
  cancelDownload(songId);
  if (!isSupported()) return;
  const record = index[songId];
  if (!record) return;
  const keys = [keyFor(songId)];
  // Only drop the cover if no other downloaded track still uses it.
  const cover = record.song.coverArt;
  if (cover && !Object.values(index).some((r) => r.song.id !== songId && r.song.coverArt === cover)) {
    keys.push(artKeyFor(cover));
  }
  await idbDelete(keys).catch(() => {});
  delete index[songId];
  persist();
  emit();
}

export async function removeDownloads(songIds: string[]): Promise<void> {
  for (const id of songIds) await removeDownload(id);
}

export async function removeAllDownloads(): Promise<void> {
  cancelAllDownloads();
  if (!isSupported()) return;
  await idbClear().catch(() => {});
  index = {};
  persist();
  emit();
}

/**
 * A blob URL for a downloaded track, or null if it is not stored.
 * Callers own the URL and must revoke it when they are done.
 */
export async function localStreamUrl(songId: string): Promise<string | null> {
  if (!isSupported() || !index[songId]) return null;
  try {
    const blob = await idbGet(keyFor(songId));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/**
 * Stored artwork, by cover id. Used as a fallback when the network copy will
 * not load, which is exactly the offline case.
 */
export async function localArtUrl(coverArt: string): Promise<string | null> {
  if (!isSupported()) return null;
  try {
    const blob = await idbGet(artKeyFor(coverArt));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** Rough disk headroom, when the browser is willing to say. */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
