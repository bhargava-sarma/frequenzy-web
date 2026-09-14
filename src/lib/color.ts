/**
 * The colour an album is wearing.
 *
 * Apple Music's whole look comes from one idea: the artwork lights the room.
 * Every surface near a cover — the page behind it, the card's glow, the
 * player's wash, the accent on its buttons — is derived from that cover rather
 * than from a fixed theme. So this has to give back more than three gradient
 * stops: it gives back a small palette with *roles*, the way Android's Palette
 * or iOS's UIImageColors do, plus the derived colours a UI actually needs
 * (something legible on top, something bright enough to be an accent, a glow).
 *
 * Method: downsample hard, quantise into a coarse RGB histogram, then score
 * every bucket against each role's target saturation and lightness, weighted by
 * how much of the image it covers. Scoring beats "most common colour" because
 * the most common colour in an album cover is almost always a near-black or a
 * near-white, which is useless as a tint.
 */

export interface Swatch {
  hex: string;
  h: number;
  s: number;
  l: number;
  /** Share of the sampled pixels, 0..1. */
  population: number;
}

export interface Palette {
  /* The five classic roles. */
  vibrant: string;
  lightVibrant: string;
  darkVibrant: string;
  muted: string;
  darkMuted: string;

  /* Kept under their old names because a lot of CSS already reads them. */
  primary: string;
  secondary: string;
  tertiary: string;

  /** Deep, desaturated version of the artwork, for the page behind everything. */
  background: string;
  /** Text that stays legible on `background`. */
  foreground: string;
  /** Bright enough to carry a button or a progress fill on `background`. */
  accent: string;
  /** Text that stays legible on `accent`. */
  onAccent: string;
  /** Saturated and light — for rim light, hover glow, shadow tint. */
  glow: string;

  /** Mean luminance of the artwork, 0..1. */
  luma: number;
  /** True when the artwork is bright enough that dark text reads better. */
  isLight: boolean;
}

/**
 * Used before any artwork has been read, and whenever extraction fails. Not
 * grey: a cool blue and a warm violet, so an idle app still has depth instead
 * of reading as flat black.
 */
export const DEFAULT_PALETTE: Palette = {
  vibrant: '#5b6ea8',
  lightVibrant: '#98a7d8',
  darkVibrant: '#333f68',
  muted: '#5a5a70',
  darkMuted: '#2a2a36',
  primary: '#3f4a6b',
  secondary: '#4a3560',
  tertiary: '#2f4257',
  background: '#0d0d10',
  foreground: '#ffffff',
  accent: '#8c9ede',
  onAccent: '#0b0b12',
  glow: '#7f92e0',
  luma: 0.18,
  isLight: false,
};

/* ------------------------------------------------------------ colour space */

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}

function hex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function hslHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
  return hex(r, g, b);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** WCAG relative luminance, used only to keep text and accents legible. */
function relativeLuminance(r: number, g: number, b: number): number {
  const f = (c: number): number => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(...a);
  const lb = relativeLuminance(...b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ------------------------------------------------------------------ scoring */

interface Bucket {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  count: number;
}

interface RoleTarget {
  /** Ideal saturation and lightness for this role. */
  s: number;
  l: number;
  /** Hard bounds; a bucket outside them cannot fill the role. */
  minL: number;
  maxL: number;
  minS: number;
}

const ROLES: Record<'vibrant' | 'lightVibrant' | 'darkVibrant' | 'muted' | 'darkMuted', RoleTarget> = {
  vibrant: { s: 1, l: 0.5, minL: 0.3, maxL: 0.7, minS: 0.35 },
  lightVibrant: { s: 1, l: 0.74, minL: 0.55, maxL: 0.95, minS: 0.3 },
  darkVibrant: { s: 1, l: 0.26, minL: 0.06, maxL: 0.45, minS: 0.3 },
  muted: { s: 0.3, l: 0.5, minL: 0.3, maxL: 0.7, minS: 0 },
  darkMuted: { s: 0.3, l: 0.26, minL: 0.06, maxL: 0.45, minS: 0 },
};

/* Android's Palette weights, which are well tuned: hitting the target
   lightness matters most, saturation next, sheer coverage least. */
const W_SATURATION = 3;
const W_LUMA = 6;
const W_POPULATION = 1;

function scoreBucket(bucket: Bucket, target: RoleTarget, maxCount: number): number {
  if (bucket.l < target.minL || bucket.l > target.maxL) return -1;
  if (bucket.s < target.minS) return -1;
  const saturation = 1 - Math.abs(bucket.s - target.s);
  const luma = 1 - Math.abs(bucket.l - target.l);
  const population = maxCount > 0 ? bucket.count / maxCount : 0;
  return (
    (saturation * W_SATURATION + luma * W_LUMA + population * W_POPULATION) /
    (W_SATURATION + W_LUMA + W_POPULATION)
  );
}

/** Two swatches this close together would read as the same colour twice. */
function tooSimilar(a: Bucket, b: Bucket): boolean {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) / 180;
  const ds = Math.abs(a.s - b.s);
  const dl = Math.abs(a.l - b.l);
  return dh < 0.08 && ds < 0.16 && dl < 0.14;
}

/* --------------------------------------------------------------- extraction */

const SAMPLE = 40;
/** 4 bits per channel: 4096 buckets, plenty for a 1600-pixel sample. */
const QUANT = 4;

function quantise(data: Uint8ClampedArray): { buckets: Bucket[]; luma: number } {
  const counts = new Map<number, { r: number; g: number; b: number; n: number }>();
  let lumaTotal = 0;
  let lumaCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    lumaTotal += relativeLuminance(r, g, b);
    lumaCount += 1;
    const key = ((r >> QUANT) << 10) | ((g >> QUANT) << 5) | (b >> QUANT);
    const entry = counts.get(key);
    if (entry) {
      entry.r += r;
      entry.g += g;
      entry.b += b;
      entry.n += 1;
    } else {
      counts.set(key, { r, g, b, n: 1 });
    }
  }

  const buckets: Bucket[] = [];
  for (const entry of counts.values()) {
    // Average within the bucket so the swatch is a real colour from the image,
    // not the corner of the quantisation cell.
    const r = Math.round(entry.r / entry.n);
    const g = Math.round(entry.g / entry.n);
    const b = Math.round(entry.b / entry.n);
    const [h, s, l] = rgbToHsl(r, g, b);
    buckets.push({ r, g, b, h, s, l, count: entry.n });
  }

  return { buckets, luma: lumaCount ? lumaTotal / lumaCount : 0.15 };
}

function buildPalette(buckets: Bucket[], luma: number): Palette {
  if (buckets.length === 0) return DEFAULT_PALETTE;

  const maxCount = buckets.reduce((max, b) => Math.max(max, b.count), 0);
  const chosen: Partial<Record<keyof typeof ROLES, Bucket>> = {};
  const taken: Bucket[] = [];

  for (const role of Object.keys(ROLES) as (keyof typeof ROLES)[]) {
    let best: Bucket | null = null;
    let bestScore = 0;
    for (const bucket of buckets) {
      if (taken.some((t) => tooSimilar(t, bucket))) continue;
      const score = scoreBucket(bucket, ROLES[role], maxCount);
      if (score > bestScore) {
        best = bucket;
        bestScore = score;
      }
    }
    if (best) {
      chosen[role] = best;
      taken.push(best);
    }
  }

  // Every role that found nothing is generated from one that did, so a
  // monochrome cover still produces a complete, coherent set.
  const anchor =
    chosen.vibrant ??
    chosen.lightVibrant ??
    chosen.darkVibrant ??
    chosen.muted ??
    chosen.darkMuted ??
    buckets.reduce((a, b) => (b.count > a.count ? b : a));

  const at = (role: keyof typeof ROLES, s: number, l: number): string => {
    const bucket = chosen[role];
    if (bucket) return hslHex(bucket.h, bucket.s, bucket.l);
    return hslHex(anchor.h, s, l);
  };

  const vibrant = at('vibrant', Math.max(0.5, anchor.s), 0.52);
  const lightVibrant = at('lightVibrant', Math.max(0.45, anchor.s * 0.9), 0.75);
  const darkVibrant = at('darkVibrant', Math.max(0.45, anchor.s), 0.26);
  const muted = at('muted', Math.min(0.32, anchor.s), 0.48);
  const darkMuted = at('darkMuted', Math.min(0.3, anchor.s), 0.24);

  /*
   * The background stays genuinely dark. The artwork is meant to light the
   * room, not repaint it: colour arrives through the gradient blobs and the
   * glass, and this only tints the shadow they sit in. A cover that is mostly
   * white still gets a dark room, just a warmer one.
   */
  const bgSource = chosen.darkMuted ?? chosen.darkVibrant ?? anchor;
  const background = hslHex(
    bgSource.h,
    clamp(bgSource.s * 0.6, 0.08, 0.42),
    clamp(0.02 + luma * 0.16, 0.035, 0.1),
  );

  /*
   * The accent has to survive on that background, and a lot of album art is
   * navy-on-black or maroon-on-black. Walk it lighter until it clears a 4.5:1
   * ratio, so a Play button is never a dark smudge on a dark page.
   */
  const accentSource = chosen.vibrant ?? chosen.lightVibrant ?? chosen.muted ?? anchor;
  const bgRgb = hslToRgb(bgSource.h, clamp(bgSource.s * 0.6, 0.08, 0.42), clamp(0.02 + luma * 0.16, 0.035, 0.1));
  let accentL = clamp(accentSource.l, 0.42, 0.72);
  const accentS = clamp(accentSource.s * 1.1, 0.42, 0.95);
  for (let step = 0; step < 14; step += 1) {
    const rgb = hslToRgb(accentSource.h, accentS, accentL);
    if (contrastRatio(rgb, bgRgb) >= 4.5) break;
    accentL = Math.min(0.86, accentL + 0.035);
  }
  const accent = hslHex(accentSource.h, accentS, accentL);
  const accentRgb = hslToRgb(accentSource.h, accentS, accentL);
  const onAccent = relativeLuminance(...accentRgb) > 0.42 ? '#0b0b0f' : '#ffffff';

  return {
    vibrant,
    lightVibrant,
    darkVibrant,
    muted,
    darkMuted,
    // The three legacy slots map onto the roles that read best as big soft
    // gradient blobs: saturated, mid-dark, and distinct from each other.
    primary: hslHex(accentSource.h, clamp(accentSource.s * 1.05, 0.38, 0.88), clamp(accentSource.l * 0.92, 0.26, 0.5)),
    secondary: (() => {
      const b = chosen.darkVibrant ?? chosen.muted ?? anchor;
      return hslHex(b.h, clamp(b.s * 1.05, 0.34, 0.85), clamp(b.l * 0.95, 0.22, 0.46));
    })(),
    tertiary: (() => {
      const b = chosen.lightVibrant ?? chosen.muted ?? chosen.darkMuted ?? anchor;
      return hslHex(b.h, clamp(b.s, 0.3, 0.82), clamp(b.l * 0.8, 0.24, 0.48));
    })(),
    background,
    foreground: luma > 0.62 ? '#0b0b0d' : '#ffffff',
    accent,
    onAccent,
    glow: hslHex(accentSource.h, clamp(accentSource.s * 1.15, 0.5, 1), clamp(accentSource.l * 1.15, 0.5, 0.74)),
    luma,
    isLight: luma > 0.62,
  };
}

/* ------------------------------------------------------------------- cache */

/** Bounded so a long scroll through a big library cannot grow without limit. */
const CACHE_LIMIT = 240;
const cache = new Map<string, Palette>();
const inFlight = new Map<string, Promise<Palette>>();

function remember(src: string, palette: Palette): Palette {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(src, palette);
  return palette;
}

/** The palette for an already-seen cover, without touching the network. */
export function cachedPalette(src: string): Palette | undefined {
  return cache.get(src);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('artwork failed to load'));
    img.src = src;
  });
}

/**
 * One shared canvas for every extraction.
 *
 * Creating a canvas per cover is what turns "tint each card" into a jank
 * machine: a fresh backing store per card, each one a GPU allocation, dozens of
 * them during a single scroll.
 */
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx;
  if (typeof document === 'undefined') return null;
  sharedCanvas = document.createElement('canvas');
  sharedCanvas.width = SAMPLE;
  sharedCanvas.height = SAMPLE;
  sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
  return sharedCtx;
}

export async function extractPalette(src: string): Promise<Palette> {
  if (!src) return DEFAULT_PALETTE;

  const cached = cache.get(src);
  if (cached) return cached;

  // Several cards can ask for the same cover in the same frame; they share one
  // decode rather than racing each other.
  const pending = inFlight.get(src);
  if (pending) return pending;

  const work = (async (): Promise<Palette> => {
    try {
      const img = await loadImage(src);
      const ctx = context();
      if (!ctx) return DEFAULT_PALETTE;
      ctx.clearRect(0, 0, SAMPLE, SAMPLE);
      ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
      // A tainted canvas throws here — that means the server sent no CORS
      // headers for artwork, so we quietly keep the neutral palette.
      const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
      const { buckets, luma } = quantise(data);
      return remember(src, buildPalette(buckets, luma));
    } catch {
      return remember(src, DEFAULT_PALETTE);
    } finally {
      inFlight.delete(src);
    }
  })();

  inFlight.set(src, work);
  return work;
}
