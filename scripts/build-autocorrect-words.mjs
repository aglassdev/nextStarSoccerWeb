// Builds public/autocorrect/en-words.txt, the word list the chat autocorrect
// uses (src/utils/autocorrect). One lowercase word per line, most common first.
//
//   node scripts/build-autocorrect-words.mjs
//
// A word counts as real if it is in SCOWL (sizes 10–60, US + common English)
// or was said at least MIN_SPOKEN times in SUBTLEX-US (film/TV subtitles), so
// everyday chat words ("okay", "yeah", "gonna") and common names are kept while
// the odd subtitle typo ("untill", "wich") is not. Order is SUBTLEX frequency;
// dictionary words never heard in subtitles go last, by SCOWL size.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_SPOKEN = 30;
const SIZES = [10, 20, 35, 40, 50, 55, 60];

const scowlDir = dirname(require.resolve('wordlist-english/package.json'));
const tierOf = new Map();
for (const size of SIZES) {
  for (const variant of ['english', 'american']) {
    for (const w of JSON.parse(readFileSync(join(scowlDir, `${variant}-words-${size}.json`), 'utf8'))) {
      const lower = w.toLowerCase();
      if (/^[a-z]+$/.test(lower) && !tierOf.has(lower)) tierOf.set(lower, size);
    }
  }
}

// SUBTLEX splits contractions ("don't" → "don" + "t"), so these pieces look far
// more common than they are. Their spoken counts are ignored: real words among
// them ("don", "haven", "re") keep their dictionary place, the rest are dropped.
const FRAGMENTS = new Set([
  's', 't', 'll', 've', 're', 'm', 'd', 'don', 'didn', 'doesn', 'isn', 'wasn', 'aren',
  'weren', 'hasn', 'haven', 'hadn', 'couldn', 'wouldn', 'shouldn', 'mustn', 'needn', 'ain',
]);
const spoken = new Map();
for (const { word, count } of require('subtlex-word-frequencies/index.json')) {
  const lower = word.toLowerCase();
  if (/^[a-z]+$/.test(lower) && !FRAGMENTS.has(lower)) spoken.set(lower, (spoken.get(lower) || 0) + count);
}
// Single letters other than "a" and "i" are never words in a message.
for (const w of tierOf.keys()) if (w.length === 1 && w !== 'a' && w !== 'i') tierOf.delete(w);
for (const w of spoken.keys()) if (w.length === 1 && w !== 'a' && w !== 'i') spoken.delete(w);

const words = new Set([...tierOf.keys()]);
for (const [w, c] of spoken) if (c >= MIN_SPOKEN) words.add(w);

const ranked = [...words].sort((a, b) => {
  const ca = spoken.get(a) || 0;
  const cb = spoken.get(b) || 0;
  if (ca !== cb) return cb - ca;
  const ta = tierOf.get(a) ?? 99;
  const tb = tierOf.get(b) ?? 99;
  return ta - tb || a.localeCompare(b);
});

const out = join(root, 'public/autocorrect/en-words.txt');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, ranked.join('\n') + '\n');
console.log(`wrote ${ranked.length} words to ${out}`);
