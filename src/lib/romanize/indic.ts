/**
 * Brahmic scripts → Latin (Devanagari, Bengali, Gurmukhi, Gujarati, Odia,
 * Tamil, Telugu, Kannada, Malayalam).
 *
 * These blocks share the ISCII code layout, so a single offset-keyed table
 * covers all of them: 0x15 is "ka" whether you are in Devanagari or Telugu.
 *
 * The spelling target is the informal Latin that people actually use for their
 * own language — "pyar", "zindagi", "sangeet" — rather than academic IAST with
 * macrons and dots. That means a couple of deliberate compromises, most visibly
 * that ā collapses onto plain "a".
 */

interface ScriptSpec {
  name: string;
  base: number;
  /** Hindi-style languages drop the inherent vowel at the end of a word. */
  dropFinalSchwa: boolean;
  /** Per-script consonant spellings that differ from the shared table. */
  overrides?: Record<number, string>;
}

/** Tamil has no aspirate/voiced series, so several letters are read differently. */
const TAMIL_OVERRIDES: Record<number, string> = {
  0x24: 'th', 0x25: 'th', 0x26: 'th', 0x27: 'th',
  0x1f: 't', 0x20: 't', 0x21: 't', 0x22: 't',
  0x31: 'r', 0x33: 'l', 0x34: 'zh', 0x29: 'n',
};

const SCRIPTS: ScriptSpec[] = [
  { name: 'Devanagari', base: 0x0900, dropFinalSchwa: true },
  { name: 'Bengali', base: 0x0980, dropFinalSchwa: true },
  { name: 'Gurmukhi', base: 0x0a00, dropFinalSchwa: true },
  { name: 'Gujarati', base: 0x0a80, dropFinalSchwa: true },
  { name: 'Odia', base: 0x0b00, dropFinalSchwa: true },
  { name: 'Tamil', base: 0x0b80, dropFinalSchwa: false, overrides: TAMIL_OVERRIDES },
  { name: 'Telugu', base: 0x0c00, dropFinalSchwa: false },
  { name: 'Kannada', base: 0x0c80, dropFinalSchwa: false },
  { name: 'Malayalam', base: 0x0d00, dropFinalSchwa: false },
];

/**
 * Independent vowels, offsets 0x05–0x14. Long "ī"/"ū" are written "ee"/"oo"
 * mid-word and "i"/"u" at the end of one, which is exactly the split you see in
 * the wild: "sangeet" but "zindagi".
 */
const VOWELS: Record<number, string> = {
  0x05: 'a', 0x06: 'a', 0x07: 'i', 0x08: 'ee', 0x09: 'u', 0x0a: 'oo',
  0x0b: 'ri', 0x0c: 'li', 0x0d: 'e', 0x0e: 'e', 0x0f: 'e', 0x10: 'ai',
  0x11: 'o', 0x12: 'o', 0x13: 'o', 0x14: 'au',
  0x60: 'ri', 0x61: 'li',
};

/** Consonants, offsets 0x15–0x39. Value excludes the inherent vowel. */
const CONSONANTS: Record<number, string> = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'ng',
  0x1a: 'ch', 0x1b: 'chh', 0x1c: 'j', 0x1d: 'jh', 0x1e: 'ny',
  0x1f: 't', 0x20: 'th', 0x21: 'd', 0x22: 'dh', 0x23: 'n',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'n',
  0x2a: 'p', 0x2b: 'ph', 0x2c: 'b', 0x2d: 'bh', 0x2e: 'm',
  0x2f: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x34: 'zh',
  0x35: 'v', 0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h',
  // Precomposed nukta letters.
  0x58: 'q', 0x59: 'kh', 0x5a: 'gh', 0x5b: 'z', 0x5c: 'r', 0x5d: 'rh',
  0x5e: 'f', 0x5f: 'y',
  // Additional letters used by Bengali, Odia and Gurmukhi.
  0x7c: 'r', 0x7d: 'r', 0x7e: 'r', 0x7f: 'y',
};

/** The same consonant plus a combining nukta (U+xx3C) gives a borrowed sound. */
const NUKTA_FORMS: Record<number, string> = {
  0x15: 'q', 0x16: 'kh', 0x17: 'gh', 0x1c: 'z', 0x21: 'r', 0x22: 'rh',
  0x2b: 'f', 0x2f: 'y', 0x32: 'l', 0x38: 's', 0x27: 'z', 0x28: 'n',
};

/** Dependent vowel signs (matras), offsets 0x3E–0x4C. */
const MATRAS: Record<number, string> = {
  0x3e: 'a', 0x3f: 'i', 0x40: 'ee', 0x41: 'u', 0x42: 'oo', 0x43: 'ri',
  0x44: 'ri', 0x45: 'e', 0x46: 'e', 0x47: 'e', 0x48: 'ai',
  0x49: 'o', 0x4a: 'o', 0x4b: 'o', 0x4c: 'au', 0x62: 'ri', 0x63: 'li',
};

const VIRAMA = 0x4d;
const NUKTA = 0x3c;
const ANUSVARA = 0x02;
const CANDRABINDU = 0x01;
const VISARGA = 0x03;
const AVAGRAHA = 0x3d;
const GURMUKHI_TIPPI = 0x70;
const GURMUKHI_ADDAK = 0x71;

/** Offsets that are combining marks; unknown ones are skipped, not word breaks. */
function isCombining(off: number): boolean {
  return (
    off <= 0x04 ||
    (off >= 0x3a && off <= 0x4f) ||
    (off >= 0x51 && off <= 0x57) ||
    (off >= 0x62 && off <= 0x63) ||
    off >= 0x70
  );
}

/** Which nasal an anusvara becomes depends on the consonant that follows it. */
function nasalFor(nextConsonant: string | null): string {
  if (!nextConsonant) return 'm'; // word-final anusvara: "sangeetam"
  const c = nextConsonant[0];
  if ('pbm'.includes(c)) return 'm';
  return 'n';
}

function scriptFor(code: number): ScriptSpec | null {
  for (const s of SCRIPTS) if (code >= s.base && code < s.base + 0x80) return s;
  return null;
}

function consonantAt(spec: ScriptSpec, off: number): string | undefined {
  return spec.overrides?.[off] ?? CONSONANTS[off];
}

export function isIndicCode(code: number): boolean {
  return scriptFor(code) !== null;
}

export function hasIndic(text: string): boolean {
  for (const ch of text) if (isIndicCode(ch.codePointAt(0)!)) return true;
  return false;
}

interface Token {
  /** Consonant cluster spelled so far, without its vowel. */
  cons: string;
  /** Vowel attached to it; null means "inherent, not yet decided". */
  vowel: string | null;
  /** Trailing nasal / visarga. */
  tail: string;
  pendingVirama: boolean;
}

export function romanizeIndic(text: string): string {
  const chars = Array.from(text);
  let out = '';
  let token: Token | null = null;
  let script: ScriptSpec | null = null;
  let doubleNext = false;

  const flush = (atWordEnd: boolean) => {
    if (!token) return;
    let vowel = token.vowel;
    if (vowel === null) {
      vowel = token.pendingVirama ? '' : script?.dropFinalSchwa && atWordEnd ? '' : 'a';
    } else if (atWordEnd && !token.tail) {
      // Long vowels shorten at the end of a word: "zindagi", not "zindagee".
      if (vowel === 'ee') vowel = 'i';
      else if (vowel === 'oo') vowel = 'u';
    }
    out += token.cons + vowel + token.tail;
    token = null;
  };

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].codePointAt(0)!;
    const spec = scriptFor(code);

    if (!spec) {
      flush(true);
      out += chars[i];
      continue;
    }
    script = spec;
    const off = code - spec.base;

    if (off >= 0x66 && off <= 0x6f) {
      flush(true);
      out += String(off - 0x66);
      continue;
    }

    if (off === NUKTA || off === AVAGRAHA) continue; // folded in below
    if (off === GURMUKHI_ADDAK) {
      doubleNext = true;
      continue;
    }

    const consonant = consonantAt(spec, off);
    if (consonant !== undefined) {
      // A following combining nukta swaps in the borrowed-sound letter.
      const nextCode = chars[i + 1]?.codePointAt(0);
      let spelling = consonant;
      if (nextCode !== undefined && nextCode - spec.base === NUKTA && NUKTA_FORMS[off]) {
        spelling = NUKTA_FORMS[off];
        i += 1;
      }
      // Tamil ச opens a word as "ch" (சென்னை → chennai) but is "s" inside one
      // (இசை → isai).
      if (spec.name === 'Tamil' && off === 0x1a) {
        const atWordStart = token === null && !/[a-z]$/i.test(out);
        spelling = atWordStart ? 'ch' : 's';
      }
      if (doubleNext) {
        spelling = spelling[0] + spelling;
        doubleNext = false;
      }
      if (token && token.pendingVirama) {
        // Conjunct: glue onto the cluster and let the new consonant decide its
        // own vowel again (the virama only silenced the previous one).
        token.cons += spelling;
        token.pendingVirama = false;
        token.vowel = null;
      } else {
        flush(false);
        token = { cons: spelling, vowel: null, tail: '', pendingVirama: false };
      }
      continue;
    }

    if (VOWELS[off] !== undefined) {
      flush(false);
      token = { cons: '', vowel: VOWELS[off], tail: '', pendingVirama: false };
      continue;
    }

    if (MATRAS[off] !== undefined) {
      if (token) token.vowel = MATRAS[off];
      else token = { cons: '', vowel: MATRAS[off], tail: '', pendingVirama: false };
      continue;
    }

    if (off === VIRAMA) {
      if (token) {
        token.vowel = '';
        token.pendingVirama = true;
      }
      continue;
    }

    if (off === ANUSVARA || off === CANDRABINDU || off === GURMUKHI_TIPPI) {
      const nextCode = chars[i + 1]?.codePointAt(0);
      const nextSpec = nextCode !== undefined ? scriptFor(nextCode) : null;
      const nextCons = nextSpec ? (consonantAt(nextSpec, nextCode! - nextSpec.base) ?? null) : null;
      if (token) {
        if (token.vowel === null) token.vowel = 'a';
        token.tail += nasalFor(nextCons);
      } else {
        out += nasalFor(nextCons);
      }
      continue;
    }

    if (off === VISARGA) {
      if (token) {
        if (token.vowel === null) token.vowel = 'a';
        token.tail += 'h';
      } else out += 'h';
      continue;
    }

    // Danda / double danda read as a full stop.
    if (off === 0x64 || off === 0x65) {
      flush(true);
      out += '.';
      continue;
    }

    // Any other combining mark is decorative for our purposes.
    if (isCombining(off)) continue;
    flush(true);
  }

  flush(true);
  return out;
}
