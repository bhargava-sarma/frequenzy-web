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
 * Playback reads a track back as a blob URL — an <audio> element cannot read
 * storage directly, and a blob hands back the bytes exactly as they were
 * stored, which is the whole point here.
 */

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
  | { status: 'downloading'; progress: number }
  | { status: 'done'; bytes: number }
  | { status: 'error'; message: string };

type Listener = () => void;

let index: Record<string, DownloadRecord> = load();
const active = new Map<string, DownloadState>();
const listeners = new Set<Listener>();

function load(): Record<string, DownloadRecord> {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DownloadRecord>) : {};
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
  for (const fn of listeners) fn();
}

export function subscribeDownloads(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function isDownloaded(songId: string): boolean {
  return index[songId] !== undefined;
}

export function downloadState(songId: string): DownloadState {
  if (active.has(songId)) return active.get(songId)!;
  const record = index[songId];
  return record ? { status: 'done', bytes: record.bytes } : { status: 'idle' };
}

export function getDownloads(): DownloadRecord[] {
  return Object.values(index).sort((a, b) => b.downloadedAt - a.downloadedAt);
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

/**
 * Fetch a track and its artwork into the cache.
 *
 * The stream is read in chunks so the UI can show real progress; Navidrome
 * sends a Content-Length for raw files, so the percentage is honest.
 */
export async function downloadSong(song: Song): Promise<void> {
  if (!isSupported() || index[song.id]) return;

  active.set(song.id, { status: 'downloading', progress: 0 });
  emit();

  try {
    const response = await fetch(streamUrl(song.id, { raw: true }));
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const total = Number(response.headers.get('Content-Length') ?? 0) || song.size || 0;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        active.set(song.id, { status: 'downloading', progress: Math.min(1, received / total) });
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
        const art = await fetch(coverArtUrl(song.coverArt, 600));
        if (art.ok) await idbPut(artKeyFor(song.coverArt), await art.blob());
      } catch {
        /* artwork is optional */
      }
    }

    index[song.id] = { song, bytes: blob.size, downloadedAt: Date.now() };
    persist();
    active.delete(song.id);
    emit();
  } catch (error) {
    active.set(song.id, {
      status: 'error',
      message: error instanceof Error ? error.message : 'Download failed',
    });
    emit();
    setTimeout(() => {
      active.delete(song.id);
      emit();
    }, 4000);
  }
}

export async function downloadSongs(songs: Song[]): Promise<void> {
  // Sequential on purpose: a dozen parallel FLAC downloads saturate the link
  // and make the progress bars meaningless.
  for (const song of songs) {
    await downloadSong(song);
  }
}

export async function removeDownload(songId: string): Promise<void> {
  if (!isSupported()) return;
  const record = index[songId];
  const keys = [keyFor(songId)];
  // Only drop the cover if no other downloaded track still uses it.
  const cover = record?.song.coverArt;
  if (cover && !Object.values(index).some((r) => r.song.id !== songId && r.song.coverArt === cover)) {
    keys.push(artKeyFor(cover));
  }
  await idbDelete(keys).catch(() => {});
  delete index[songId];
  persist();
  emit();
}

export async function removeAllDownloads(): Promise<void> {
  if (!isSupported()) return;
  await idbClear().catch(() => {});
  index = {};
  persist();
  emit();
}

/**
 * A blob URL for a downloaded track, or null if it is not cached.
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
 * Cached artwork, by cover id. Used as a fallback when the network copy will
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
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
