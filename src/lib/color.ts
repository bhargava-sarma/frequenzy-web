/**
 * Pulls a palette out of album artwork.
 *
 * The full-screen player floats on a slow gradient built from the artwork's own
 * colours, which is what makes it feel like the album is lighting the room. We
 * downsample to a tiny canvas, bucket the pixels in HSL space, and pick a few
 * colours that are vivid enough to be worth using.
 */

export interface Palette {
  /** Most prominent vivid colour. */
  primary: string;
  secondary: string;
  tertiary: string;
  /** Deep colour for the page background behind everything. */
  background: string;
  /** Text colour with enough contrast against `background`. */
  foreground: string;
  /** True when the artwork is light enough to need dark text. */
  isLight: boolean;
}

export const DEFAULT_PALETTE: Palette = {
  primary: '#5a5a66',
  secondary: '#3a3a44',
  tertiary: '#6b6b78',
  background: '#121214',
  foreground: '#ffffff',
  isLight: false,
};

interface Hsl {
  h: number;
  s: number;
  l: number;
  weight: number;
}

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

function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

const cache = new Map<string, Palette>();

/** Load an image for pixel access. Falls back to a non-CORS load when needed. */
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

export async function extractPalette(src: string): Promise<Palette> {
  if (!src) return DEFAULT_PALETTE;
  const cached = cache.get(src);
  if (cached) return cached;

  try {
    const img = await loadImage(src);
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;
    ctx.drawImage(img, 0, 0, size, size);

    // A tainted canvas throws here — that means the server did not send CORS
    // headers for artwork, so we quietly keep the neutral palette.
    const { data } = ctx.getImageData(0, 0, size, size);

    // 24 hue buckets, keeping the most saturated representative of each.
    const buckets = new Map<number, Hsl>();
    let totalL = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      totalL += l;
      count += 1;
      if (l < 0.08 || l > 0.95) continue; // near-black and near-white carry no hue
      const key = Math.floor(h / 15);
      const weight = s * (1 - Math.abs(l - 0.5) * 1.2);
      const existing = buckets.get(key);
      if (!existing) buckets.set(key, { h, s, l, weight });
      else {
        existing.weight += weight;
        // Drift the bucket toward its most saturated member.
        if (s > existing.s) {
          existing.h = h;
          existing.s = s;
          existing.l = l;
        }
      }
    }

    const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight);
    const avgL = count ? totalL / count : 0.2;

    const pick = (index: number, fallback: string): string => {
      const entry = ranked[index];
      if (!entry) return fallback;
      // Rich enough to read as a glow, dark enough to keep white text legible
      // once three of these are layered on top of each other.
      const s = Math.min(0.88, Math.max(0.4, entry.s * 1.15));
      const l = Math.min(0.5, Math.max(0.26, entry.l * 0.85));
      return hslToCss(entry.h, s, l);
    };

    // The background sits behind everything, so it stays genuinely dark — the
    // artwork should light the room, not repaint it. Colour comes through in the
    // gradient blobs; this only tints the shadow they sit in.
    const base = ranked[0];
    const background = base
      ? hslToCss(base.h, Math.min(0.4, base.s * 0.55), Math.max(0.035, Math.min(0.085, avgL * 0.2)))
      : DEFAULT_PALETTE.background;

    const palette: Palette = {
      primary: pick(0, DEFAULT_PALETTE.primary),
      secondary: pick(1, DEFAULT_PALETTE.secondary),
      tertiary: pick(2, DEFAULT_PALETTE.tertiary),
      background,
      foreground: avgL > 0.72 ? '#0b0b0d' : '#ffffff',
      isLight: avgL > 0.72,
    };

    cache.set(src, palette);
    return palette;
  } catch {
    cache.set(src, DEFAULT_PALETTE);
    return DEFAULT_PALETTE;
  }
}
