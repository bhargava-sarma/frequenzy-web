/** User preferences, persisted to localStorage and shared through context. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'dark' | 'light';
export type LyricsRomanization = 'auto' | 'always' | 'never';

export interface Settings {
  theme: ThemeMode;
  /** Liquid glass costs GPU time; some machines are happier without it. */
  glass: boolean;
  /** Ambient colour wash behind the full-screen player. */
  ambientBackground: boolean;
  reduceMotion: boolean;
  /** 'auto' romanizes only when the lyric is not already in Latin script. */
  romanization: LyricsRomanization;
  /** Show the original script above the romanized line. */
  showOriginalWithRomanization: boolean;
  pinyinTones: 'none' | 'symbol';
  /** Off by default — the whole point of this client is untouched files. */
  allowTranscoding: boolean;
  volume: number;
  scrobble: boolean;
  /** Keep playing similar music when the queue runs out. */
  autoplay: boolean;
  /** Seconds of overlap between tracks; 0 disables the effect entirely. */
  crossfadeSeconds: number;
  /** Library list density, remembered per install. */
  libraryView: 'grid' | 'list';
}

const DEFAULTS: Settings = {
  theme: 'dark',
  glass: true,
  ambientBackground: true,
  reduceMotion: false,
  romanization: 'auto',
  showOriginalWithRomanization: true,
  pinyinTones: 'none',
  allowTranscoding: false,
  volume: 1,
  scrobble: true,
  autoplay: true,
  crossfadeSeconds: 0,
  libraryView: 'grid',
};

const STORAGE_KEY = 'frequenzy.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // Reflect preferences onto the document so CSS can respond to them.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = settings.theme === 'light' || (settings.theme === 'system' && media.matches);
      root.dataset.theme = light ? 'light' : 'dark';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.glass = settings.glass ? 'on' : 'off';
    root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
  }, [settings.glass, settings.reduceMotion]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
