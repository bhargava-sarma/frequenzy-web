/**
 * Greek → Latin, roughly ISO 843 transcription (how it sounds today, not how
 * Ancient Greek was spelled). Digraphs are matched before single letters.
 */

const DIGRAPHS: Record<string, string> = {
  ου: 'ou', ΟΥ: 'OU', Ου: 'Ou',
  αι: 'ai', ει: 'ei', οι: 'oi', υι: 'yi', αυ: 'av', ευ: 'ev', ηυ: 'iv',
  μπ: 'b', ντ: 'd', γκ: 'g', γγ: 'ng', γχ: 'nch', γξ: 'nx', τσ: 'ts', τζ: 'tz',
};

const MAP: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i',
  κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's',
  ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};

export function isGreekCode(code: number): boolean {
  return (code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff);
}

export function hasGreek(text: string): boolean {
  for (const ch of text) if (isGreekCode(ch.codePointAt(0)!)) return true;
  return false;
}

/** Strip tonos/dialytika so the tables only need bare letters. */
function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export function romanizeGreek(text: string): string {
  const chars = Array.from(stripAccents(text));
  let out = '';
  let i = 0;
  while (i < chars.length) {
    const pair = (chars[i] + (chars[i + 1] ?? '')).toLowerCase();
    if (DIGRAPHS[pair]) {
      const roman = DIGRAPHS[pair];
      const upper = chars[i] === chars[i].toUpperCase() && chars[i] !== chars[i].toLowerCase();
      out += upper ? roman[0].toUpperCase() + roman.slice(1) : roman;
      i += 2;
      continue;
    }
    const ch = chars[i];
    const mapped = MAP[ch.toLowerCase()];
    if (mapped === undefined) {
      out += ch;
    } else {
      const upper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
      out += upper ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
    }
    i += 1;
  }
  return out;
}
