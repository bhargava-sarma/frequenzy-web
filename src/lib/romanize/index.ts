/**
 * Script detection and romanization orchestration.
 *
 * The point is transliteration, never translation: 사랑해 becomes "saranghae",
 * not "I love you". A whole lyric sheet is romanized as one document so that the
 * Han characters in a Japanese song are read as Japanese rather than Mandarin —
 * a decision that can only be made by looking at every line at once.
 */

import { hasArabic, hasHebrew, isArabicCode, isHebrewCode, romanizeArabic, romanizeHebrew } from './semitic';
import { hasCyrillic, isCyrillicCode, romanizeCyrillic } from './cyrillic';
import { hasGreek, isGreekCode, romanizeGreek } from './greek';
import { hasHangul, isHangulCode, romanizeHangul } from './hangul';
import { hasIndic, isIndicCode, romanizeIndic } from './indic';
import { hasKana, hasKanji, isKanaCode, isKanjiCode, romanizeKana } from './kana';
import { hasThai, isThaiCode, romanizeThai } from './thai';
import { hasHan, isHanCode, preloadChinese, romanizeChinese } from './chinese';
import { preloadJapanese, romanizeJapanese } from './japanese';

export type ScriptName =
  | 'latin'
  | 'hangul'
  | 'japanese'
  | 'han'
  | 'cyrillic'
  | 'greek'
  | 'arabic'
  | 'hebrew'
  | 'indic'
  | 'thai';

export interface ScriptProfile {
  scripts: Set<ScriptName>;
  /** The script that dominates the document; drives the async romanizer choice. */
  primary: ScriptName;
  /** True when anything needs romanizing at all. */
  needsRomanization: boolean;
}

function classify(code: number): ScriptName | null {
  if (isHangulCode(code)) return 'hangul';
  if (isKanaCode(code)) return 'japanese';
  if (isKanjiCode(code) || isHanCode(code)) return 'han';
  if (isCyrillicCode(code)) return 'cyrillic';
  if (isGreekCode(code)) return 'greek';
  if (isArabicCode(code)) return 'arabic';
  if (isHebrewCode(code)) return 'hebrew';
  if (isIndicCode(code)) return 'indic';
  if (isThaiCode(code)) return 'thai';
  return null;
}

/** Look at the whole document at once so mixed lines are read consistently. */
export function profileScripts(text: string): ScriptProfile {
  const counts = new Map<ScriptName, number>();
  for (const ch of text) {
    const script = classify(ch.codePointAt(0)!);
    if (!script) continue;
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }

  const scripts = new Set(counts.keys());

  // Han characters in a document that also contains kana are Japanese.
  if (scripts.has('japanese') && scripts.has('han')) {
    scripts.delete('han');
    counts.set('japanese', (counts.get('japanese') ?? 0) + (counts.get('han') ?? 0));
    counts.delete('han');
  }

  let primary: ScriptName = 'latin';
  let best = 0;
  for (const [script, count] of counts) {
    if (count > best) {
      best = count;
      primary = script;
    }
  }

  return { scripts, primary, needsRomanization: scripts.size > 0 };
}

export function needsRomanization(text: string): boolean {
  return profileScripts(text).needsRomanization;
}

export interface RomanizeOptions {
  /** Pinyin tone marks. Off reads more like English. */
  tones?: 'none' | 'symbol';
  /** Treat Han as Japanese even without kana present (e.g. a kanji-only title). */
  forceJapanese?: boolean;
}

/** Synchronous romanizers, applied in sequence so mixed-script lines still work. */
function applySync(text: string, scripts: Set<ScriptName>): string {
  let out = text;
  if (scripts.has('japanese')) out = romanizeKana(out);
  if (scripts.has('hangul')) out = romanizeHangul(out);
  if (scripts.has('cyrillic')) out = romanizeCyrillic(out);
  if (scripts.has('greek')) out = romanizeGreek(out);
  if (scripts.has('indic')) out = romanizeIndic(out);
  if (scripts.has('thai')) out = romanizeThai(out);
  if (scripts.has('arabic')) out = romanizeArabic(out);
  if (scripts.has('hebrew')) out = romanizeHebrew(out);
  return out;
}

/**
 * Romanize a batch of lines that belong to the same song. Returns one output
 * line per input line so a synced lyric sheet keeps its timing alignment.
 */
export async function romanizeLines(lines: string[], opts: RomanizeOptions = {}): Promise<string[]> {
  const joined = lines.join('\n');
  const profile = profileScripts(joined);
  if (!profile.needsRomanization) return lines;

  const treatAsJapanese =
    profile.scripts.has('japanese') || (opts.forceJapanese && profile.scripts.has('han'));

  // The async engines work best on whole lines, so run them line by line, then
  // finish with the table-driven scripts.
  const results = await Promise.all(
    lines.map(async (line) => {
      let out = line;
      try {
        if (treatAsJapanese && (hasKana(out) || hasKanji(out))) {
          out = await romanizeJapanese(out);
        } else if (profile.scripts.has('han') && hasHan(out)) {
          out = await romanizeChinese(out, { tones: opts.tones });
        }
      } catch {
        // A dictionary that will not load should degrade to the table-driven
        // romanizers, never take the whole lyric sheet down with it.
        out = line;
      }
      return applySync(out, profile.scripts);
    }),
  );

  return results.map((line) => tidy(line));
}

/** Romanize a single string — titles, artist names, album names. */
export async function romanizeText(text: string, opts: RomanizeOptions = {}): Promise<string> {
  const [line] = await romanizeLines([text], opts);
  return line;
}

/**
 * Best-effort romanization with no awaiting and no dictionary download. Used for
 * list rows, where a synchronous answer matters more than perfect kanji.
 */
export function romanizeTextSync(text: string): string {
  const profile = profileScripts(text);
  if (!profile.needsRomanization) return text;
  let out = text;
  if (profile.scripts.has('japanese')) out = romanizeKana(out);
  return tidy(applySync(out, profile.scripts));
}

/** Collapse the double spaces that word-spaced engines leave behind. */
function tidy(text: string): string {
  return text
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function preloadRomanizers(profile: ScriptProfile): void {
  if (profile.scripts.has('japanese')) preloadJapanese();
  if (profile.scripts.has('han')) preloadChinese();
}

export {
  hasArabic, hasCyrillic, hasGreek, hasHan, hasHangul, hasHebrew, hasIndic, hasKana, hasKanji, hasThai,
};
