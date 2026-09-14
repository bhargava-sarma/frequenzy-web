/**
 * The palette of one piece of artwork, extracted only once it matters.
 *
 * Every card in the app wants to glow in its own colour, and a library page can
 * hold two hundred of them. Decoding two hundred covers on mount would stall
 * the first paint for seconds, so extraction is deferred until the card is
 * actually near the viewport, and shared across every component that asks for
 * the same cover.
 *
 * Returns a ref to hang on the element. Attach it and the palette arrives when
 * the element does; a cover that has been seen before resolves synchronously
 * from the cache, so scrolling back up never re-flashes to the default.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { cachedPalette, DEFAULT_PALETTE, extractPalette, type Palette } from '../lib/color';
import { coverArtUrl } from '../lib/subsonic';

/** Small enough to decode instantly; big enough that the colours are real. */
const SAMPLE_SIZE = 96;
/** Start a little before the card arrives, so its colour is there when it does. */
const ROOT_MARGIN = '240px';

type Callback = () => void;

let observer: IntersectionObserver | null = null;
const watched = new WeakMap<Element, Callback>();

function sharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const run = watched.get(entry.target);
          if (run) {
            // One shot: the palette never changes for a given cover.
            observer?.unobserve(entry.target);
            watched.delete(entry.target);
            run();
          }
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
  }
  return observer;
}

export interface PaletteHandle {
  palette: Palette;
  /** True once this is the artwork's real palette rather than the default. */
  ready: boolean;
  /** Attach to the element whose visibility should trigger extraction. */
  ref: (node: Element | null) => void;
}

export function usePalette(coverArt: string | undefined, eager = false): PaletteHandle {
  const src = coverArt ? coverArtUrl(coverArt, SAMPLE_SIZE) : '';
  const hit = src ? cachedPalette(src) : undefined;

  const [palette, setPalette] = useState<Palette>(hit ?? DEFAULT_PALETTE);
  const [ready, setReady] = useState(Boolean(hit));
  const element = useRef<Element | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(() => {
    if (!src) return;
    void extractPalette(src).then((result) => {
      if (!alive.current) return;
      setPalette(result);
      setReady(true);
    });
  }, [src]);

  // A cover already in the cache needs no observer and no waiting.
  useEffect(() => {
    if (!src) {
      setPalette(DEFAULT_PALETTE);
      setReady(false);
      return;
    }
    if (cachedPalette(src) || eager) {
      // `load` resolves from the cache synchronously when there is a hit.
      load();
      return;
    }
    setReady(false);
  }, [eager, load, src]);

  const ref = useCallback(
    (node: Element | null) => {
      const previous = element.current;
      if (previous && observer) {
        observer.unobserve(previous);
        watched.delete(previous);
      }
      element.current = node;
      if (!node || !src || eager) return;

      /*
       * A cover another component already extracted is available right now.
       * This used to bail out silently, which quietly stranded any card whose
       * cover landed in the cache *between* the mount effect and this callback
       * — the first card on the home screen, always, because the spotlight
       * above it holds the same album and extracts it eagerly.
       */
      if (cachedPalette(src)) {
        load();
        return;
      }

      const io = sharedObserver();
      if (!io) {
        // No IntersectionObserver (very old browser): just do the work.
        load();
        return;
      }
      watched.set(node, load);
      io.observe(node);
    },
    [eager, load, src],
  );

  useEffect(
    () => () => {
      const node = element.current;
      if (node && observer) {
        observer.unobserve(node);
        watched.delete(node);
      }
    },
    [],
  );

  return { palette, ready, ref };
}
