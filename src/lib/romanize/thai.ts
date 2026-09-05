/**
 * Thai → Latin, following the shape of the Royal Thai General System.
 *
 * Thai is written without spaces between words and puts some vowels to the left
 * of the consonant they follow, so we walk the string with a small syllable
 * state machine: track whether the current syllable already has a vowel, and use
 * that to decide whether the next consonant is an onset or a final. Tone marks
 * carry no Latin spelling in RTGS and are dropped.
 *
 * Without a Thai word list this stays an approximation — good enough to sing
 * along to, not good enough for a passport.
 */

const INITIAL: Record<string, string> = {
  ก: 'k', ข: 'kh', ฃ: 'kh', ค: 'kh', ฅ: 'kh', ฆ: 'kh', ง: 'ng',
  จ: 'ch', ฉ: 'ch', ช: 'ch', ซ: 's', ฌ: 'ch', ญ: 'y',
  ฎ: 'd', ฏ: 't', ฐ: 'th', ฑ: 'th', ฒ: 'th', ณ: 'n',
  ด: 'd', ต: 't', ถ: 'th', ท: 'th', ธ: 'th', น: 'n',
  บ: 'b', ป: 'p', ผ: 'ph', ฝ: 'f', พ: 'ph', ฟ: 'f', ภ: 'ph', ม: 'm',
  ย: 'y', ร: 'r', ล: 'l', ว: 'w', ศ: 's', ษ: 's', ส: 's',
  ห: 'h', ฬ: 'l', อ: '', ฮ: 'h',
};

/** Final position changes several consonants: ล at the end is "n", not "l". */
const FINAL: Record<string, string> = {
  ก: 'k', ข: 'k', ค: 'k', ฆ: 'k', ง: 'ng',
  จ: 't', ช: 't', ซ: 't', ฌ: 't', ญ: 'n',
  ฎ: 't', ฏ: 't', ฐ: 't', ฑ: 't', ฒ: 't', ณ: 'n',
  ด: 't', ต: 't', ถ: 't', ท: 't', ธ: 't', น: 'n',
  บ: 'p', ป: 'p', พ: 'p', ฟ: 'p', ภ: 'p', ม: 'm',
  ย: 'i', ร: 'n', ล: 'n', ศ: 't', ษ: 't', ส: 't', ฬ: 'n', ว: 'o',
};

const VOWELS: Record<string, string> = {
  'ะ': 'a', 'ั': 'a', 'า': 'a', 'ำ': 'am',
  'ิ': 'i', 'ี': 'i', 'ึ': 'ue', 'ื': 'ue',
  'ุ': 'u', 'ู': 'u',
  'เ': 'e', 'แ': 'ae', 'โ': 'o', 'ใ': 'ai', 'ไ': 'ai',
  'ๅ': 'a', 'ํ': 'am',
  ฤ: 'rue', ฦ: 'lue',
};

/** Vowels written to the left of their consonant. */
const LEADING_VOWELS = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ']);
/** Tone marks and the silencer, none of which are written in RTGS. */
const SILENT = new Set(['็', '่', '้', '๊', '๋', '์', '๎', 'ฺ']);
/** ร ล ว form a cluster with a preceding stop: พล → "phl", ปร → "pr". */
const CLUSTER_SECOND = new Set(['ร', 'ล', 'ว']);
const CLUSTER_FIRST = new Set(['ก', 'ข', 'ค', 'ต', 'ท', 'ป', 'ผ', 'พ', 'บ', 'ธ']);

/** Compound vowels that span two characters and must be matched first. */
const VOWEL_DIGRAPHS: Record<string, string> = {
  'ัว': 'ua', 'ิว': 'io', 'ือ': 'ue', 'ึอ': 'ue', 'ุย': 'ui',
  'อย': 'oi', 'าย': 'ai', 'าว': 'ao', 'ัย': 'ai', 'ําา': 'am',
};

const DIGITS: Record<string, string> = {
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
};

export function isThaiCode(code: number): boolean {
  return code >= 0x0e00 && code <= 0x0e7f;
}

export function hasThai(text: string): boolean {
  for (const ch of text) if (isThaiCode(ch.codePointAt(0)!)) return true;
  return false;
}

const isVowelChar = (ch: string | undefined) => ch !== undefined && VOWELS[ch] !== undefined;
/**
 * A leading vowel belongs to the consonant *after* it, so it must not be treated
 * as the current syllable's nucleus when deciding onset vs. final.
 */
const isTrailingVowel = (ch: string | undefined) => isVowelChar(ch) && !LEADING_VOWELS.has(ch!);
const isConsonant = (ch: string | undefined) => ch !== undefined && INITIAL[ch] !== undefined;

export function romanizeThai(text: string): string {
  const chars = Array.from(text);
  let out = '';
  let i = 0;
  /** Has the syllable we are building already been given a vowel? */
  let hasNucleus = false;

  while (i < chars.length) {
    const ch = chars[i];

    if (!isThaiCode(ch.codePointAt(0)!)) {
      out += ch;
      hasNucleus = false;
      i += 1;
      continue;
    }
    if (SILENT.has(ch)) {
      i += 1;
      continue;
    }
    if (DIGITS[ch]) {
      out += DIGITS[ch];
      i += 1;
      continue;
    }

    // A leading vowel belongs after the consonant (or cluster) that follows it.
    if (LEADING_VOWELS.has(ch)) {
      const c1 = chars[i + 1];
      const c2 = chars[i + 2];
      if (isConsonant(c1) && c2 !== undefined && CLUSTER_FIRST.has(c1!) && CLUSTER_SECOND.has(c2)) {
        out += INITIAL[c1!] + INITIAL[c2] + VOWELS[ch];
        hasNucleus = true;
        i += 3;
        continue;
      }
      if (isConsonant(c1)) {
        out += INITIAL[c1!] + VOWELS[ch];
        hasNucleus = true;
        i += 2;
        continue;
      }
      out += VOWELS[ch];
      hasNucleus = true;
      i += 1;
      continue;
    }

    const digraph = VOWEL_DIGRAPHS[ch + (chars[i + 1] ?? '')];
    if (digraph) {
      out += digraph;
      hasNucleus = true;
      i += 2;
      continue;
    }

    if (VOWELS[ch] !== undefined) {
      out += VOWELS[ch];
      hasNucleus = true;
      i += 1;
      continue;
    }

    if (isConsonant(ch)) {
      const next = chars[i + 1];
      const after = chars[i + 2];

      // Onset cluster.
      if (!hasNucleus && CLUSTER_FIRST.has(ch) && next !== undefined && CLUSTER_SECOND.has(next) && (isVowelChar(after) || after === undefined)) {
        out += INITIAL[ch] + INITIAL[next];
        i += 2;
        continue;
      }

      if (hasNucleus && !isTrailingVowel(next)) {
        // The syllable already has its vowel, so this consonant closes it.
        const final = FINAL[ch] ?? INITIAL[ch];
        // Do not write "thaii" where the vowel already ended in that sound.
        out += out.endsWith(final) ? '' : final;
        hasNucleus = false;
        i += 1;
        continue;
      }

      out += INITIAL[ch];
      if (isTrailingVowel(next)) {
        hasNucleus = false; // the vowel itself will set it
      } else if (isConsonant(next)) {
        // No written vowel. Thai supplies a short one: "o" when the next
        // consonant closes this syllable, "a" when it opens the next one.
        const nextClosesSyllable = !isVowelChar(after) && !isConsonant(after);
        out += nextClosesSyllable ? 'o' : 'a';
        hasNucleus = true;
      } else {
        out += 'o';
        hasNucleus = true;
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  return out;
}
