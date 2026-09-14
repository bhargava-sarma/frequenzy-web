/**
 * Navigation that cross-fades instead of cutting.
 *
 * The View Transitions API snapshots the page, lets us mutate the DOM, then
 * animates between the two snapshots — so a route change can dissolve, and an
 * album cover can fly from a shelf into the detail header as the *same object*
 * rather than disappearing from one screen and reappearing on another.
 *
 * Two details make it work with React:
 *
 *   - `flushSync`, because the callback passed to `startViewTransition` must
 *     leave the DOM in its final state by the time it returns, and React's
 *     default batching would still be holding the update.
 *
 *   - A hard bail-out when the API is missing or motion is off, so the app
 *     navigates normally rather than not at all.
 */

import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

/** The name both halves of a shared-element morph are matched on. */
export const MORPH_NAME = 'art';

function transitionsAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  // Typed as always present by lib.dom, but absent in Firefox and older Safari.
  if (typeof document.startViewTransition !== 'function') return false;
  if (document.documentElement.dataset.motion === 'reduced') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tag an element as the source of a morph for the next navigation.
 *
 * Two elements may never carry the same transition name in the same snapshot —
 * the browser abandons the whole transition if they do. That is a live hazard
 * here, because a detail page's own cover is permanently named (it is the
 * destination of every morph) and it is also the page you are standing on when
 * you click something in "More by this artist". So tagging a new source first
 * takes the name off whatever is holding it.
 */
export function morphFrom(element: HTMLElement | null): void {
  if (!element || !transitionsAvailable()) return;
  document.querySelectorAll<HTMLElement>('[data-morph]').forEach((node) => {
    node.style.viewTransitionName = 'none';
  });
  element.style.viewTransitionName = MORPH_NAME;
}

/**
 * Give the name back once the animation is over.
 *
 * Destinations keep theirs: they are marked `data-morph`, they are the thing
 * the *next* morph will fly into, and React will not necessarily re-render them
 * to restore an attribute we stripped.
 */
function releaseMorph(): void {
  document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach((node) => {
    if (node.dataset.morph !== undefined) node.style.viewTransitionName = MORPH_NAME;
    else if (node.style.viewTransitionName === MORPH_NAME) node.style.viewTransitionName = '';
  });
}

export function useSmoothNavigate(): (to: To | number, options?: NavigateOptions) => void {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      const go = () => {
        if (typeof to === 'number') navigate(to);
        else navigate(to, options);
      };

      if (!transitionsAvailable()) {
        go();
        return;
      }

      const transition = document.startViewTransition(() => {
        flushSync(go);
      });
      void transition.finished.finally(releaseMorph).catch(() => releaseMorph());
    },
    [navigate],
  );
}
