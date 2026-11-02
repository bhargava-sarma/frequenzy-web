/**
 * Preferences.
 *
 * A module-level store rather than a context, so the playback engine — which
 * lives outside React — can read the current quality or crossfade length at
 * the moment it needs it, and so changing one setting only re-renders the
 * controls that show that setting.
 */

import { createStore, useStore } from '../lib/store';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Accent = 'orange' | 'blue' | 'green' | 'yellow' | 'red' | 'pink' | 'mono';
export type Density = 'comfortable' | 'compact';
export type LyricsRomanization = 'auto' | 'always' | 'never';
export type Quality = 'original' | '320' | '256' | '192' | '128' | '96';
export type TranscodeFormat = 'mp3' | 'opus' | 'aac';
export type ReplayGainMode = 'off' | 'track' | 'album';
export type GridSize = 's' | 'm' | 'l';
export type PlayerDisplay = 'art' | 'tape';
export type LyricsSize = 's' | 'm' | 'l';

export interface Settings {
  /* appearance */
  theme: ThemeMode;
  accent: Accent;
  density: Density;
  reduceMotion: boolean;
  gridSize: GridSize;
  libraryView: 'grid' | 'list';
  playerDisplay: PlayerDisplay;
  /** Tint the full-screen player with the artwork's colour. */
  artworkTint: boolean;

  /* playback */
  volume: number;
  muted: boolean;
  scrobble: boolean;
  /** Keep playing similar music when the queue runs out. */
  autoplay: boolean;
  /** Seconds of overlap between tracks; 0 disables the effect entirely. */
  crossfadeSeconds: number;
  playbackRate: number;
  replayGain: ReplayGainMode;
  /** Decibels added before the ReplayGain adjustment. */
  replayGainPreamp: number;
  /** Stream quality on a home / LAN address. 'original' is bit-for-bit. */
  qualityHome: Quality;
  /** Stream quality on anything else — Tailscale, the internet. */
  qualityRemote: Quality;
  transcodeFormat: TranscodeFormat;
  /** Mirror the queue to the server so another device can pick it up. */
  syncQueue: boolean;
  haptics: boolean;
  /** Ask the screen to stay awake while the full player is open. */
  keepScreenOn: boolean;

  /* lyrics */
  /** 'auto' romanizes only when the lyric is not already in Latin script. */
  romanization: LyricsRomanization;
  showOriginalWithRomanization: boolean;
  pinyinTones: 'none' | 'symbol';
  lyricsSize: LyricsSize;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'orange',
  density: 'comfortable',
  reduceMotion: false,
  gridSize: 'm',
  libraryView: 'grid',
  playerDisplay: 'art',
  artworkTint: true,

  volume: 0.85,
  muted: false,
  scrobble: true,
  autoplay: true,
  crossfadeSeconds: 0,
  playbackRate: 1,
  replayGain: 'off',
  replayGainPreamp: 0,
  qualityHome: 'original',
  qualityRemote: 'original',
  transcodeFormat: 'mp3',
  syncQueue: false,
  haptics: true,
  keepScreenOn: false,

  romanization: 'auto',
  showOriginalWithRomanization: true,
  pinyinTones: 'none',
  lyricsSize: 'm',
};

const STORAGE_KEY = 'frequenzy.settings.v1';

const ACCENTS: Accent[] = ['orange', 'blue', 'green', 'yellow', 'red', 'pink', 'mono'];
const QUALITIES: Quality[] = ['original', '320', '256', '192', '128', '96'];

/** Merge whatever is stored over the defaults, dropping anything malformed. */
function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const stored = JSON.parse(raw) as Partial<Settings> & Record<string, unknown>;
    const merged: Settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const value = stored[key];
      if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
        (merged as unknown as Record<string, unknown>)[key] = value;
      }
    }
    if (!ACCENTS.includes(merged.accent)) merged.accent = DEFAULT_SETTINGS.accent;
    if (!QUALITIES.includes(merged.qualityHome)) merged.qualityHome = 'original';
    if (!QUALITIES.includes(merged.qualityRemote)) merged.qualityRemote = 'original';
    if (!['system', 'light', 'dark'].includes(merged.theme)) merged.theme = DEFAULT_SETTINGS.theme;
    merged.volume = clamp(merged.volume, 0, 1);
    merged.playbackRate = clamp(merged.playbackRate, 0.5, 2);
    merged.crossfadeSeconds = clamp(Math.round(merged.crossfadeSeconds), 0, 12);
    merged.replayGainPreamp = clamp(merged.replayGainPreamp, -15, 15);
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const settingsStore = createStore<Settings>(load());

export function getSettings(): Settings {
  return settingsStore.get();
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set(patch);
}

export function resetSettings(): void {
  settingsStore.set({ ...DEFAULT_SETTINGS, volume: settingsStore.get().volume });
}

export function useSettings<T>(selector: (settings: Settings) => T): T {
  return useStore(settingsStore, selector);
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useStore(settingsStore, (s) => s[key]);
}

/* ------------------------------------------------------------- persistence */

let persistTimer: ReturnType<typeof setTimeout> | undefined;

settingsStore.subscribe(() => {
  // Volume drags fire dozens of updates a second; one write is plenty.
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsStore.get()));
    } catch {
      /* private mode or full; the in-memory value still applies */
    }
  }, 250);
});

/* ------------------------------------------------------- document attributes */

/** The chassis colour of each theme, for the browser's own chrome. */
const THEME_COLOR = { light: '#e9e9e5', dark: '#0e0e0e' } as const;

let resolvedTheme: 'light' | 'dark' = 'dark';
const themeListeners = new Set<() => void>();

export function currentTheme(): 'light' | 'dark' {
  return resolvedTheme;
}

export function onThemeChange(fn: () => void): () => void {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}

function applyToDocument(): void {
  if (typeof document === 'undefined') return;
  const settings = settingsStore.get();
  const root = document.documentElement;
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  const theme = settings.theme === 'system' ? (prefersLight ? 'light' : 'dark') : settings.theme;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  root.dataset.theme = theme;
  root.dataset.accent = settings.accent;
  root.dataset.density = settings.density;
  root.dataset.grid = settings.gridSize;
  root.dataset.motion = settings.reduceMotion || prefersReduced ? 'reduced' : 'full';
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);

  if (theme !== resolvedTheme) {
    resolvedTheme = theme;
    themeListeners.forEach((fn) => fn());
  }
}

if (typeof window !== 'undefined') {
  applyToDocument();
  let last = settingsStore.get();
  settingsStore.subscribe(() => {
    const next = settingsStore.get();
    if (
      next.theme !== last.theme ||
      next.accent !== last.accent ||
      next.density !== last.density ||
      next.gridSize !== last.gridSize ||
      next.reduceMotion !== last.reduceMotion
    ) {
      applyToDocument();
    }
    last = next;
  });
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', applyToDocument);
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyToDocument);
}
