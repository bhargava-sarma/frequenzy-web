/**
 * Japanese → Hepburn romaji, including kanji.
 *
 * Kana alone we can do with a table (see `kana.ts`), but kanji needs a
 * morphological analyzer to know that 今日 is "kyō" and not "ima-hi". Kuromoji's
 * dictionary is ~15 MB, so it is fetched lazily from /dict and only when a lyric
 * actually contains kanji.
 */

import { romanizeKana } from './kana';

interface Kuroshiro {
  init(analyzer: unknown): Promise<void>;
  convert(text: string, opts: Record<string, unknown>): Promise<string>;
}

let instance: Promise<Kuroshiro> | null = null;
let failed = false;

/**
 * Must stay a site-relative path. Kuromoji's dictionary loader joins the path
 * and filename and then collapses repeated slashes with a global regex, which
 * would eat the `//` in `http://` and produce a nonsense URL.
 */
const DICT_PATH = '/dict/';

/**
 * If a dictionary file is missing, kuromoji's loader throws inside a promise it
 * never settles, so `init()` would hang forever. Cap the wait and fall back.
 */
const INIT_TIMEOUT_MS = 45_000;

async function getKuroshiro(): Promise<Kuroshiro> {
  if (!instance) {
    instance = (async () => {
      const [{ default: Kuroshiro }, { default: Analyzer }] = await Promise.all([
        import('@sglkc/kuroshiro'),
        import('@sglkc/kuroshiro-analyzer-kuromoji'),
      ]);
      const kuroshiro = new (Kuroshiro as unknown as new () => Kuroshiro)();
      const analyzer = new (Analyzer as unknown as new (o: { dictPath: string }) => unknown)({
        dictPath: DICT_PATH,
      });
      await Promise.race([
        kuroshiro.init(analyzer),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('kuromoji dictionary did not load')), INIT_TIMEOUT_MS),
        ),
      ]);
      return kuroshiro;
    })();
    // Never leave an unhandled rejection behind if nobody is awaiting yet.
    instance.catch(() => {
      failed = true;
    });
  }
  return instance;
}

export interface JapaneseOptions {
  /** 'spaced' puts a space between words, which is much easier to sing from. */
  mode?: 'normal' | 'spaced' | 'okurigana' | 'furigana';
}

export async function romanizeJapanese(text: string, opts: JapaneseOptions = {}): Promise<string> {
  if (failed) return romanizeKana(text);
  try {
    const kuroshiro = await getKuroshiro();
    const result = await kuroshiro.convert(text, {
      to: 'romaji',
      mode: opts.mode ?? 'spaced',
      romajiSystem: 'hepburn',
    });
    return result;
  } catch {
    // Dictionary missing or blocked — kana still romanizes fine without it.
    failed = true;
    return romanizeKana(text);
  }
}

export function preloadJapanese(): void {
  void getKuroshiro().catch(() => {
    failed = true;
  });
}
