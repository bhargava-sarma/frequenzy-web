/**
 * The colour the whole app is standing in.
 *
 * A pane of glass is only convincing when there is something behind it to
 * refract, and Apple Music's signature is that the something is the record you
 * are playing. This lifts the palette out of the now-playing artwork and
 * publishes it on the root element, so the backdrop, the sidebar, the bars, the
 * cards and the full-screen player are all lit by one source.
 *
 * The variables are registered with `@property` in tokens.css, which is what
 * lets them *transition*: without that a track change would snap the entire
 * interface to a new colour in one frame. With it, the room changes colour over
 * a second and a half and you barely notice it happening.
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

/** Every palette role, as the CSS variable that carries it. */
const VARIABLES: Array<[string, keyof Palette]> = [
  ['--art-primary', 'primary'],
  ['--art-secondary', 'secondary'],
  ['--art-tertiary', 'tertiary'],
  ['--art-background', 'background'],
  ['--art-vibrant', 'vibrant'],
  ['--art-light-vibrant', 'lightVibrant'],
  ['--art-dark-vibrant', 'darkVibrant'],
  ['--art-muted', 'muted'],
  ['--art-dark-muted', 'darkMuted'],
  ['--art-accent', 'accent'],
  ['--art-on-accent', 'onAccent'],
  ['--art-glow', 'glow'],
  ['--art-foreground', 'foreground'],
];

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
    void extractPalette(coverArtUrl(current.coverArt, 300)).then((result) => {
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
    for (const [variable, role] of VARIABLES) {
      root.style.setProperty(variable, String(palette[role]));
    }
    root.dataset.ambient = active ? 'on' : 'off';
    // Whether the cover is bright enough that the room has to stay dark to
    // keep white text legible over it.
    root.dataset.artLuma = palette.isLight ? 'light' : 'dark';
  }, [active, palette]);

  const value = useMemo(() => ({ palette, active }), [active, palette]);
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientValue {
  return useContext(AmbientContext);
}
