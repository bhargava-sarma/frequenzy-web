/**
 * Local play history.
 *
 * Subsonic reports play *counts* but not an ordered history, so "Recently
 * Played" is kept here — capped, de-duplicated by song, and shared through a
 * tiny subscription so any view can render it.
 */

import { compactSong } from './song';
import type { Song } from './types';

const KEY = 'frequenzy.history.v1';
const LIMIT = 250;

export interface HistoryEntry {
  song: Song;
  playedAt: number;
}

type Listener = (entries: HistoryEntry[]) => void;

let entries: HistoryEntry[] = load();
const listeners = new Set<Listener>();

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e?.song?.id && typeof e.playedAt === 'number') : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    /* storage full or unavailable; history is a nicety, not a requirement */
  }
}

function emit() {
  for (const fn of [...listeners]) fn(entries);
}

export function recordPlay(song: Song): void {
  if (song.isRadio) return;
  // One entry per song: replaying something moves it to the top rather than
  // filling the list with repeats.
  entries = [{ song: compactSong(song), playedAt: Date.now() }, ...entries.filter((e) => e.song.id !== song.id)].slice(
    0,
    LIMIT,
  );
  persist();
  emit();
}

export function removeFromHistory(songId: string): void {
  entries = entries.filter((e) => e.song.id !== songId);
  persist();
  emit();
}

export function getHistory(): HistoryEntry[] {
  return entries;
}

export function clearHistory(): void {
  entries = [];
  persist();
  emit();
}

export function subscribeHistory(fn: Listener): () => void {
  listeners.add(fn);
  fn(entries);
  return () => {
    listeners.delete(fn);
  };
}
