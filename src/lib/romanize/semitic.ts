/**
 * Arabic and Hebrew → Latin.
 *
 * Both scripts leave most short vowels unwritten, so a transliteration can only
 * reproduce what is on the page. Where vowel marks (harakat / niqqud) are
 * present we use them; where they are not, the consonant skeleton is what you get.
 */

const ARABIC: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h',
  خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd',
  ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm',
  ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a', ة: 'a', ء: '', ؤ: 'u', ئ: 'i',
  پ: 'p', چ: 'ch', ژ: 'zh', گ: 'g', ڤ: 'v', ک: 'k', ی: 'y',
  '،': ',', '؛': ';', '؟': '?', 'ـ': '',
};

/** Harakat: short vowels, tanwin, shadda and sukun. */
const ARABIC_MARKS: Record<string, string> = {
  'َ': 'a', 'ُ': 'u', 'ِ': 'i',
  'ً': 'an', 'ٌ': 'un', 'ٍ': 'in',
  'ْ': '', 'ٰ': 'a',
};
const SHADDA = 'ّ';

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const HEBREW: Record<string, string> = {
  א: '', ב: 'v', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'ch', ט: 't',
  י: 'y', כ: 'kh', ך: 'kh', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's',
  ע: '', פ: 'f', ף: 'f', צ: 'ts', ץ: 'ts', ק: 'k', ר: 'r', ש: 'sh', ת: 't',
  '״': '"', '׳': "'",
};

/** Niqqud vowel points, when the text carries them. */
const HEBREW_MARKS: Record<string, string> = {
  'ְ': 'e', 'ֱ': 'e', 'ֲ': 'a', 'ֳ': 'o',
  'ִ': 'i', 'ֵ': 'e', 'ֶ': 'e', 'ַ': 'a',
  'ָ': 'a', 'ֹ': 'o', 'ֺ': 'o', 'ֻ': 'u',
  'ּ': '', 'ׁ': '', 'ׂ': '',
};

export function isArabicCode(code: number): boolean {
  return (code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f) || (code >= 0xfb50 && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff);
}

export function isHebrewCode(code: number): boolean {
  return (code >= 0x0590 && code <= 0x05ff) || (code >= 0xfb1d && code <= 0xfb4f);
}

export function hasArabic(text: string): boolean {
  for (const ch of text) if (isArabicCode(ch.codePointAt(0)!)) return true;
  return false;
}

export function hasHebrew(text: string): boolean {
  for (const ch of text) if (isHebrewCode(ch.codePointAt(0)!)) return true;
  return false;
}

/** Letters that act as long vowels rather than consonants inside a word. */
const ARABIC_MATRES: Record<string, string> = { 'و': 'u', 'ي': 'i', 'ی': 'i' };

export function romanizeArabic(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ARABIC_MATRES[ch]) {
      // و and ي are consonants at the start of a word and long vowels inside
      // one: موسيقى → "musiqa", not "mwsyqa".
      const prev = chars[i - 1];
      const atWordStart = prev === undefined || !isArabicCode(prev.codePointAt(0) ?? 0);
      out += atWordStart ? (ch === 'و' ? 'w' : 'y') : ARABIC_MATRES[ch];
      continue;
    }
    if (ch === SHADDA) {
      // Doubles the consonant we just wrote.
      const last = out[out.length - 1];
      if (last) out += last;
      continue;
    }
    if (ARABIC_MARKS[ch] !== undefined) {
      out += ARABIC_MARKS[ch];
      continue;
    }
    if (ARABIC_DIGITS[ch]) {
      out += ARABIC_DIGITS[ch];
      continue;
    }
    const mapped = ARABIC[ch];
    out += mapped !== undefined ? mapped : ch;
  }
  // Definite article: "alkitab" reads better as "al-kitab".
  return out.replace(/\bal(?=[a-z])/g, 'al-');
}

export function romanizeHebrew(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (HEBREW_MARKS[ch] !== undefined) {
      out += HEBREW_MARKS[ch];
      continue;
    }

    const prev = chars[i - 1];
    const next = chars[i + 1];
    const atWordStart = prev === undefined || !isHebrewCode(prev.codePointAt(0) ?? 0);
    const atWordEnd = next === undefined || !isHebrewCode(next.codePointAt(0) ?? 0);

    // Hebrew leaves most vowels unwritten. The mater lectionis letters are the
    // ones we can recover: ו reads "o", and א/ע carry an "a" at a word edge.
    if (ch === 'ו' && !atWordStart) {
      out += 'o';
      continue;
    }
    if ((ch === 'א' || ch === 'ע') && !out.endsWith('a')) {
      out += 'a';
      continue;
    }
    if (ch === 'י' && !atWordStart && !atWordEnd) {
      out += 'i';
      continue;
    }
    if (ch === 'ה' && atWordEnd && !atWordStart) {
      out += 'a';
      continue;
    }

    const mapped = HEBREW[ch];
    out += mapped !== undefined ? mapped : ch;
  }
  return out;
}
