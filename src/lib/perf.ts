/**
 * How much of the show this device can actually put on.
 *
 * Everything that makes the app look expensive — stacked backdrop filters,
 * drifting gradient blobs, refraction, long shadows — is paid for per frame on
 * the GPU. On a desktop that is free. On a three-year-old phone it is the
 * difference between butter and a slideshow, and the honest answer there is to
 * spend less rather than to ship the same thing at 24fps.
 *
 * Two signals: what the device says about itself before we draw anything, and
 * what the frame clock says once we have. The second one is the truth, so it
 * can only ever lower the tier — an adaptive loop that could also raise it
 * would oscillate between "looks great" and "feels awful" forever.
 */

export type Tier = 'high' | 'medium' | 'low';

const ORDER: Tier[] = ['low', 'medium', 'high'];

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
}

/**
 * What the device claims about itself, before a single frame is drawn.
 *
 * Deliberately generous, because the hints are bad. Safari implements neither
 * `deviceMemory` nor a useful `hardwareConcurrency`, so treating "absent" as
 * "small" puts every iPhone ever made in the bottom tier — and an iPhone runs
 * this material beautifully; it is the effect iOS itself is built out of. The
 * guess only has to be roughly right, because the frame clock corrects it
 * within a couple of seconds either way.
 */
function guessTier(): Tier {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as NavigatorWithHints;
  const cores = nav.hardwareConcurrency;
  const memory = nav.deviceMemory;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  // Only a *stated* small number counts against the device.
  if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 2)) return 'low';
  if (memory !== undefined && memory <= 4 && !coarse) return 'medium';
  // A phone is still a phone: the GPU shares a thermal budget with everything
  // else and there is less of it. Start one step down and let it earn its way
  // up — or, more usefully, let the frame clock knock it down further.
  if (coarse) return 'medium';
  return 'high';
}

let tier: Tier = 'high';
const listeners = new Set<(tier: Tier) => void>();

function publish(next: Tier): void {
  if (next === tier) return;
  tier = next;
  if (typeof document !== 'undefined') document.documentElement.dataset.perf = next;
  listeners.forEach((listener) => listener(next));
}

export function deviceTier(): Tier {
  return tier;
}

export function onTierChange(listener: (tier: Tier) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------ frame clock */

/** Frames to watch in one sampling window. */
const WINDOW = 90;
/** A frame this much slower than the median is a dropped one. */
const LONG_FRAME = 1.9;
/** Above this share of long frames, the device is not keeping up. */
const BAD_SHARE = 0.22;
/** Never demote more than this many times; below `low` there is nothing left. */
const MAX_DEMOTIONS = 2;

let demotions = 0;
let sampling = false;

/**
 * Watch one window of frames and demote if too many of them were long.
 *
 * Measured against the *median* frame rather than a fixed 16.7ms, because a
 * 120Hz display's healthy frame is 8ms and a 60Hz one's is 16.7ms; hard-coding
 * either one mislabels the other.
 */
function sample(onDone?: () => void): void {
  if (sampling || typeof requestAnimationFrame === 'undefined') return;
  sampling = true;

  const deltas: number[] = [];
  let previous = performance.now();

  const step = (now: number): void => {
    deltas.push(now - previous);
    previous = now;
    if (deltas.length < WINDOW) {
      requestAnimationFrame(step);
      return;
    }

    sampling = false;
    // The first few frames of a window include whatever work triggered it.
    const settled = deltas.slice(6).sort((a, b) => a - b);
    const median = settled[Math.floor(settled.length / 2)] || 16.7;
    const long = settled.filter((d) => d > median * LONG_FRAME).length;

    if (long / settled.length > BAD_SHARE && demotions < MAX_DEMOTIONS) {
      demotions += 1;
      const index = ORDER.indexOf(tier);
      publish(ORDER[Math.max(0, index - 1)]);
      // Give the new budget a moment to take effect, then check again: one
      // demotion is often enough, and two is the floor.
      window.setTimeout(() => sample(onDone), 1200);
      return;
    }

    onDone?.();
  };

  requestAnimationFrame(step);
}

/**
 * Start measuring. Called once, after the first screen has settled.
 *
 * `visibilitychange` matters more than it looks: a backgrounded tab is throttled
 * to roughly one frame a second, and sampling through that would demote a
 * perfectly capable machine to the low tier on the strength of a user switching
 * tabs.
 */
export function startPerfMonitor(): void {
  if (typeof document === 'undefined') return;
  publish(guessTier());
  document.documentElement.dataset.perf = tier;

  const begin = (): void => {
    if (document.visibilityState !== 'visible') return;
    sample();
  };

  // Let the first paint, the first fetches and the boot fade finish first.
  window.setTimeout(begin, 2500);
}

/** Force a tier, for the Settings screen's manual override. */
export function setTier(next: Tier | 'auto'): void {
  if (next === 'auto') {
    demotions = 0;
    publish(guessTier());
    sample();
    return;
  }
  demotions = MAX_DEMOTIONS;
  publish(next);
}
