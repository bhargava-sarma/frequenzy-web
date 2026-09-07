/**
 * The colour the whole app is standing in.
 *
 * A pane of glass is only convincing when there is something behind it to
 * refract. The app used to be flat black everywhere, so every "glass" surface
 * sampled black and read as a plain dark panel. This lifts the palette out of
 * the now-playing artwork once and publishes it as CSS variables on the root,
 * so the backdrop, the sidebar, the bars and the full-screen player are all
 * lit by the same source.
 */

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';

import { DEFAULT_PALETTE, extractPalette, type Palette } from '../lib/color';
import { coverArtUrl } from '../lib/subsonic';
import { usePlayer } from './player';
import { useSettings } from './settings';

interface AmbientValue {
  palette: Palette;
  /** True once a real artwork palette has replaced the neutral default. */
  active: boolean;
}

const AmbientContext = createContext<AmbientValue>({ palette: DEFAULT_PALETTE, active: false });

export function AmbientProvider({ children }: { children: ReactNode }) {
  const { current } = usePlayer();
  const { settings } = useSettings();
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!current?.coverArt || !settings.ambientBackground) {
      setPalette(DEFAULT_PALETTE);
      setActive(false);
      return;
    }
    let alive = true;
    extractPalette(coverArtUrl(current.coverArt, 300)).then((result) => {
      if (!alive) return;
      setPalette(result);
      setActive(true);
    });
    return () => {
      alive = false;
    };
  }, [current?.coverArt, settings.ambientBackground]);

  // Published on :root so plain CSS — including surfaces nowhere near a React
  // component — can tint itself without prop drilling.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--art-primary', palette.primary);
    root.style.setProperty('--art-secondary', palette.secondary);
    root.style.setProperty('--art-tertiary', palette.tertiary);
    root.style.setProperty('--art-background', palette.background);
    root.dataset.ambient = active ? 'on' : 'off';
  }, [active, palette]);

  const value = useMemo(() => ({ palette, active }), [active, palette]);
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientValue {
  return useContext(AmbientContext);
}
