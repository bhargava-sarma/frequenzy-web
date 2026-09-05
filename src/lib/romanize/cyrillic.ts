/**
 * Cyrillic → Latin, covering Russian, Ukrainian, Belarusian, Serbian, Bulgarian
 * and Macedonian letters in one table. Soft and hard signs are dropped rather
 * than rendered as apostrophes — nobody sings an apostrophe.
 */

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'yo', є: 'ye',
  ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', ј: 'j', к: 'k', л: 'l',
  љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  ћ: 'c', ќ: 'k', у: 'u', ў: 'w', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', џ: 'dz',
  ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ђ: 'dj', ѓ: 'g', ѐ: 'e', ѝ: 'i', ѣ: 'ye', ѳ: 'f', ѵ: 'i',
};

const VOWELS = new Set('аеёэиіїоуыюяєю');

export function isCyrillicCode(code: number): boolean {
  return (code >= 0x0400 && code <= 0x052f) || (code >= 0x2de0 && code <= 0x2dff) || (code >= 0xa640 && code <= 0xa69f);
}

export function hasCyrillic(text: string): boolean {
  for (const ch of text) if (isCyrillicCode(ch.codePointAt(0)!)) return true;
  return false;
}

function applyCase(source: string, roman: string): string {
  if (!roman) return roman;
  const isUpper = source === source.toUpperCase() && source !== source.toLowerCase();
  if (!isUpper) return roman;
  return roman.length > 1 ? roman[0].toUpperCase() + roman.slice(1) : roman.toUpperCase();
}

export function romanizeCyrillic(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    let roman = mapped;
    // "е" is iotated at the start of a word and after another vowel: Елена → Yelena.
    if (lower === 'е') {
      const prev = chars[i - 1]?.toLowerCase();
      const atStart = !prev || !isCyrillicCode(prev.codePointAt(0)!);
      if (atStart || (prev && (VOWELS.has(prev) || prev === 'ь' || prev === 'ъ'))) roman = 'ye';
    }
    out += applyCase(ch, roman);
  }
  // A fully-uppercase run should stay uppercase rather than becoming Title Case.
  return out;
}
