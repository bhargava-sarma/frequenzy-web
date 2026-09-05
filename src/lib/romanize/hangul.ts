/**
 * Korean → Revised Romanization (the system used on Korean road signs).
 *
 * Hangul syllables are algorithmically composed, so we decompose each block into
 * onset / nucleus / coda, apply the pronunciation changes that happen *between*
 * blocks (liaison and consonant assimilation), and only then spell it out. That
 * is what turns 좋아요 into "joayo" rather than a literal "johayo".
 */

const SYL_BASE = 0xac00;
const SYL_LAST = 0xd7a3;

const ONSETS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];

const NUCLEI = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe',
  'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];

/** Representative released sound of each coda, by jongseong index. */
const CODA_SOUND = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l',
  'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't',
];

/**
 * What happens when the next block starts with the silent ㅇ: the coda (or the
 * second half of a compound coda) slides across and becomes that block's onset.
 * [what stays behind, what moves across]
 */
const CODA_LIAISON: Record<number, [string, string]> = {
  1: ['', 'g'], 2: ['', 'kk'], 3: ['k', 's'], 4: ['', 'n'], 5: ['n', 'j'], 6: ['n', ''],
  7: ['', 'd'], 8: ['', 'r'], 9: ['l', 'g'], 10: ['l', 'm'], 11: ['l', 'b'], 12: ['l', 's'],
  13: ['l', 't'], 14: ['l', 'p'], 15: ['', 'r'], 16: ['', 'm'], 17: ['', 'b'], 18: ['p', 's'],
  19: ['', 's'], 20: ['', 'ss'], 21: ['ng', ''], 22: ['', 'j'], 23: ['', 'ch'], 24: ['', 'k'],
  25: ['', 't'], 26: ['', 'p'], 27: ['', ''],
};

/**
 * Assimilation across a block boundary, keyed by "<coda sound>|<next onset index>".
 * Values are [coda spelling, replacement onset spelling].
 * Onset indices of interest: 2=ㄴ, 5=ㄹ, 6=ㅁ, 18=ㅎ.
 */
const ASSIMILATION: Record<string, [string, string]> = {
  'k|2': ['ng', 'n'], 'k|5': ['ng', 'n'], 'k|6': ['ng', 'm'], 'k|18': ['', 'k'],
  'n|5': ['l', 'l'],
  't|2': ['n', 'n'], 't|5': ['n', 'n'], 't|6': ['n', 'm'], 't|18': ['', 'ch'],
  'l|2': ['l', 'l'], 'l|5': ['l', 'l'],
  'm|5': ['m', 'n'],
  'p|2': ['m', 'n'], 'p|5': ['m', 'n'], 'p|6': ['m', 'm'], 'p|18': ['', 'p'],
  'ng|5': ['ng', 'n'],
};

/** A ㅎ coda aspirates a following plain stop: 좋다 → jota, 놓고 → noko. */
const H_ASPIRATION: Record<number, string> = { 0: 'k', 3: 't', 12: 'ch', 9: 's' };

interface Block {
  onset: number;
  nucleus: number;
  coda: number;
}

function decompose(code: number): Block | null {
  if (code < SYL_BASE || code > SYL_LAST) return null;
  const idx = code - SYL_BASE;
  return { onset: Math.floor(idx / 588), nucleus: Math.floor((idx % 588) / 28), coda: idx % 28 };
}

export function isHangulCode(code: number): boolean {
  return (
    (code >= SYL_BASE && code <= SYL_LAST) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x3130 && code <= 0x318f) ||
    (code >= 0xa960 && code <= 0xa97f)
  );
}

export function hasHangul(text: string): boolean {
  for (const ch of text) if (isHangulCode(ch.codePointAt(0)!)) return true;
  return false;
}

type Slot = { kind: 'syllable'; block: Block; onset: string; coda: string } | { kind: 'literal'; text: string };

/** Romanize a string of Hangul; anything that is not a syllable passes through. */
export function romanizeHangul(text: string): string {
  const chars = Array.from(text);

  // Pass 1 — decompose, with each syllable's default onset spelling.
  const slots: Slot[] = chars.map((ch) => {
    const block = decompose(ch.codePointAt(0)!);
    if (!block) return { kind: 'literal', text: ch };
    return { kind: 'syllable', block, onset: block.onset === 5 ? 'r' : ONSETS[block.onset], coda: '' };
  });

  // Pass 2 — resolve each coda against the block that follows it, which may also
  // rewrite that block's onset.
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.kind !== 'syllable') continue;
    const codaIndex = slot.block.coda;
    if (codaIndex === 0) continue;

    const sound = CODA_SOUND[codaIndex];
    const nextSlot = slots[i + 1];
    const next = nextSlot && nextSlot.kind === 'syllable' ? nextSlot : null;

    if (!next) {
      slot.coda = sound;
      continue;
    }

    if (next.block.onset === 11) {
      // Palatalization: a ㄷ/ㅌ coda before the vowel 이 is heard as j/ch — 같이 → gachi.
      if (next.block.nucleus === 20 && (codaIndex === 7 || codaIndex === 25)) {
        slot.coda = '';
        next.onset = codaIndex === 7 ? 'j' : 'ch';
        continue;
      }
      const [stay, move] = CODA_LIAISON[codaIndex];
      slot.coda = stay;
      next.onset = move;
      continue;
    }

    if (codaIndex === 27 && H_ASPIRATION[next.block.onset] !== undefined) {
      slot.coda = '';
      next.onset = H_ASPIRATION[next.block.onset];
      continue;
    }

    const rule = ASSIMILATION[`${sound}|${next.block.onset}`];
    if (rule) {
      slot.coda = rule[0];
      next.onset = rule[1];
    } else {
      slot.coda = sound;
    }
  }

  // Pass 3 — spell it out. A word-initial ㄹ is written "r", never "l".
  let out = '';
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.kind === 'literal') {
      out += slot.text;
      continue;
    }
    let onset = slot.onset;
    const prev = slots[i - 1];
    const atWordStart = !prev || prev.kind === 'literal';
    if (atWordStart && onset === 'l') onset = 'r';
    out += onset + NUCLEI[slot.block.nucleus] + slot.coda;
  }
  return out;
}
