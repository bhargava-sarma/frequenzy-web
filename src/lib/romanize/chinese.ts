/**
 * Chinese (Han) → Hanyu Pinyin.
 *
 * Han characters need a dictionary to read, so `pinyin-pro` is loaded on demand
 * — the first Chinese lyric in a session pays for it, nothing else does.
 */

type PinyinFn = (text: string, opts?: Record<string, unknown>) => string;

let loader: Promise<PinyinFn> | null = null;

async function getPinyin(): Promise<PinyinFn> {
  if (!loader) {
    loader = import('pinyin-pro').then((m) => m.pinyin as unknown as PinyinFn);
  }
  return loader;
}

export function isHanCode(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    (code >= 0xf900 && code <= 0xfaff)
  );
}

export function hasHan(text: string): boolean {
  for (const ch of text) if (isHanCode(ch.codePointAt(0)!)) return true;
  return false;
}

export interface PinyinOptions {
  /** 'none' → "wo ai ni"; 'symbol' → "wǒ ài nǐ". */
  tones?: 'none' | 'symbol';
}

export async function romanizeChinese(text: string, opts: PinyinOptions = {}): Promise<string> {
  if (!hasHan(text)) return text;
  const pinyin = await getPinyin();
  return pinyin(text, {
    toneType: opts.tones === 'symbol' ? 'symbol' : 'none',
    type: 'string',
    nonZh: 'consecutive',
    v: true,
  });
}

/** Warm the dictionary before the user hits play, so the first line is instant. */
export function preloadChinese(): void {
  void getPinyin();
}
