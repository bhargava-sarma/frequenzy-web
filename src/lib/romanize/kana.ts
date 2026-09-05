/**
 * Japanese kana → Hepburn romaji.
 *
 * Handles the whole kana inventory including yōon (きゃ → kya), sokuon (った → tta),
 * the katakana long mark (ラーメン → raamen) and the foreign-sound digraphs
 * (ファ → fa, ヴェ → ve). Kanji is a different problem — see `japanese.ts`.
 */

const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', きぇ: 'kye',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo', ぎぇ: 'gye',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho', しぇ: 'she',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', じぇ: 'je',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', ちぇ: 'che',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo', にぇ: 'nye',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', ひぇ: 'hye',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo', りぇ: 'rye',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', ふゅ: 'fyu',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', ゔゅ: 'vyu',
  つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  てゅ: 'tyu', でゅ: 'dyu',
  すぃ: 'si', ずぃ: 'zi',
  いぇ: 'ye',
  くぁ: 'kwa', くぃ: 'kwi', くぇ: 'kwe', くぉ: 'kwo',
  ぐぁ: 'gwa',
};

const MONOGRAPHS: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'o', ん: 'n',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  '　': ' ', '、': ', ', '。': '. ', '「': '"', '」': '"',
  '・': ' ', '〜': '~', '！': '!', '？': '?', '（': '(', '）': ')',
};

const SOKUON = 'っ';
const LONG_MARK = 'ー';
const VOWELS = 'aiueo';

/** Katakana and hiragana share a layout 0x60 apart, so one table serves both. */
function toHiragana(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60);
    else if (code === 0x30fd) out += 'ゝ';
    else if (code === 0x30fe) out += 'ゞ';
    else if (code >= 0xff66 && code <= 0xff9d) out += ch; // half-width; handled below
    else out += ch;
  }
  return out;
}

const HALFWIDTH: Record<string, string> = {
  '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
  'ｦ': 'を', 'ｧ': 'ぁ', 'ｨ': 'ぃ', 'ｩ': 'ぅ', 'ｪ': 'ぇ', 'ｫ': 'ぉ',
  'ｬ': 'ゃ', 'ｭ': 'ゅ', 'ｮ': 'ょ', 'ｯ': 'っ', 'ｰ': 'ー',
  'ｱ': 'あ', 'ｲ': 'い', 'ｳ': 'う', 'ｴ': 'え', 'ｵ': 'お',
  'ｶ': 'か', 'ｷ': 'き', 'ｸ': 'く', 'ｹ': 'け', 'ｺ': 'こ',
  'ｻ': 'さ', 'ｼ': 'し', 'ｽ': 'す', 'ｾ': 'せ', 'ｿ': 'そ',
  'ﾀ': 'た', 'ﾁ': 'ち', 'ﾂ': 'つ', 'ﾃ': 'て', 'ﾄ': 'と',
  'ﾅ': 'な', 'ﾆ': 'に', 'ﾇ': 'ぬ', 'ﾈ': 'ね', 'ﾉ': 'の',
  'ﾊ': 'は', 'ﾋ': 'ひ', 'ﾌ': 'ふ', 'ﾍ': 'へ', 'ﾎ': 'ほ',
  'ﾏ': 'ま', 'ﾐ': 'み', 'ﾑ': 'む', 'ﾒ': 'め', 'ﾓ': 'も',
  'ﾔ': 'や', 'ﾕ': 'ゆ', 'ﾖ': 'よ',
  'ﾗ': 'ら', 'ﾘ': 'り', 'ﾙ': 'る', 'ﾚ': 'れ', 'ﾛ': 'ろ',
  'ﾜ': 'わ', 'ﾝ': 'ん',
};

export function isKanaCode(code: number): boolean {
  return (
    (code >= 0x3041 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0xff66 && code <= 0xff9d)
  );
}

export function hasKana(text: string): boolean {
  for (const ch of text) if (isKanaCode(ch.codePointAt(0)!)) return true;
  return false;
}

export function isKanjiCode(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    code === 0x3005 // 々 iteration mark
  );
}

export function hasKanji(text: string): boolean {
  for (const ch of text) if (isKanjiCode(ch.codePointAt(0)!)) return true;
  return false;
}

/** Romanize kana. Characters outside the kana blocks are emitted unchanged. */
export function romanizeKana(input: string): string {
  const normalized = toHiragana(
    Array.from(input)
      .map((ch) => HALFWIDTH[ch] ?? ch)
      .join(''),
  );
  const chars = Array.from(normalized);
  let out = '';
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Sokuon — doubles the consonant that opens the next syllable.
    if (ch === SOKUON) {
      const rest = romanizeKana(chars.slice(i + 1).join(''));
      if (!rest) {
        out += 'tsu';
        break;
      }
      // "tchi" rather than "cchi", per Hepburn.
      out += rest.startsWith('ch') ? 't' : rest[0];
      out += rest;
      return out;
    }

    // Long vowel mark — repeat whatever vowel we just produced.
    if (ch === LONG_MARK) {
      const last = out[out.length - 1];
      if (last && VOWELS.includes(last)) out += last;
      i += 1;
      continue;
    }

    const pair = ch + (chars[i + 1] ?? '');
    if (DIGRAPHS[pair]) {
      out += DIGRAPHS[pair];
      i += 2;
      continue;
    }

    const single = MONOGRAPHS[ch];
    if (single !== undefined) {
      // A syllabic ん needs an apostrophe before a vowel or y, so "kin'en" does
      // not read as "ki-ne-n".
      if (ch === 'ん') {
        const nextPair = chars[i + 1] ? (DIGRAPHS[chars[i + 1] + (chars[i + 2] ?? '')] ?? MONOGRAPHS[chars[i + 1]]) : undefined;
        if (nextPair && (VOWELS.includes(nextPair[0]) || nextPair[0] === 'y')) {
          out += "n'";
          i += 1;
          continue;
        }
      }
      out += single;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}
