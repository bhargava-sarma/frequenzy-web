/**
 * Compact MD5. The Subsonic authentication scheme requires md5(password + salt),
 * and WebCrypto deliberately does not implement MD5, so we ship our own.
 * Operates on UTF-8 bytes and returns lowercase hex.
 */

function toUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

export function md5(input: string): string {
  const msg = toUtf8(input);
  const bitLen = msg.length * 8;
  // Pad to 56 mod 64, then append the 64-bit little-endian length.
  const padded = new Uint8Array((((msg.length + 8) >> 6) + 1) * 64);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(chunk + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map((n) => {
      let hex = '';
      for (let i = 0; i < 4; i++) hex += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      return hex;
    })
    .join('');
}

/** Cryptographically random hex salt for a Subsonic token. */
export function randomSalt(bytes = 12): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
