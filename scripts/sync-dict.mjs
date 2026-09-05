/**
 * Copies the Kuromoji dictionary out of node_modules and into public/ so Vite
 * serves it statically. Keeping it out of git saves ~18 MB per clone; this runs
 * automatically before `dev` and `build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', '@sglkc', 'kuromoji', 'dict');
const dest = path.join(root, 'public', 'dict');

if (!fs.existsSync(src)) {
  console.warn('[frequenzy] kuromoji dictionary not found — Japanese kanji lyrics will fall back to kana-only romanization.');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const file of fs.readdirSync(src)) {
  if (!file.endsWith('.dat.gz')) continue;
  const from = path.join(src, file);
  const to = path.join(dest, file);
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
  fs.copyFileSync(from, to);
  copied += 1;
}
console.log(`[frequenzy] kuromoji dictionary ready (${copied} file(s) copied)`);
