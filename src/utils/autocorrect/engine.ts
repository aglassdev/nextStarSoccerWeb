// Phone-style autocorrect for one finished word. Pure functions, no DOM.
//
// A word is fixed when it is finished (space, punctuation, Send). The fix is
// conservative, like iMessage: real words, slang, names, shouty caps, links and
// anything with digits are left alone; a misspelling becomes the most common
// real word one typo away (two for long words), favouring swapped letters and
// neighbouring keys; "i" → "I", "dont" → "don't", "monday" → "Monday".

export type Dictionary = Map<string, number>; // word → rank (0 = most common)

export interface CorrectContext {
  dictionary: Dictionary | null;
  /** First word of a sentence: capitalised, and capitals there aren't a name. */
  sentenceStart: boolean;
  /** Words this person undid before: never touched again. */
  learned: Set<string>;
  /** Names and words from the open conversation, lowercase → how they were written. */
  known: Map<string, string>;
}

// Always the same fix, word or not ("cant" and "wont" are words, but people mean can't/won't).
const FIXED: Record<string, string> = {
  i: 'I', "i'm": "I'm", "i've": "I've", "i'll": "I'll", "i'd": "I'd",
  im: "I'm", ive: "I've",
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't",
  isnt: "isn't", arent: "aren't", wasnt: "wasn't", werent: "weren't", hasnt: "hasn't",
  havent: "haven't", hadnt: "hadn't", couldnt: "couldn't", shouldnt: "shouldn't",
  wouldnt: "wouldn't", mustnt: "mustn't", youre: "you're", youve: "you've",
  youll: "you'll", youd: "you'd", theyre: "they're", theyve: "they've", theyll: "they'll",
  theyd: "they'd", weve: "we've", thats: "that's", whats: "what's", wheres: "where's",
  theres: "there's", heres: "here's", whos: "who's", shes: "she's", hes: "he's",
  itll: "it'll", thatll: "that'll", aint: "ain't", yall: "y'all", wouldve: "would've",
  couldve: "could've", shouldve: "should've", mightve: "might've",
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  january: 'January', february: 'February', april: 'April', july: 'July',
  september: 'September', october: 'October', november: 'November', december: 'December',
  // Common misspellings a one-typo search gets wrong or can't reach.
  teh: 'the', hte: 'the', adn: 'and', taht: 'that', waht: 'what', alot: 'a lot',
  noone: 'no one', thier: 'their', recieve: 'receive', recieved: 'received',
  beleive: 'believe', freind: 'friend', wierd: 'weird', untill: 'until', wich: 'which',
  tommorow: 'tomorrow', tomorow: 'tomorrow', tommorrow: 'tomorrow', definately: 'definitely',
  definatly: 'definitely', seperate: 'separate', occured: 'occurred', accomodate: 'accommodate',
  becuase: 'because', becasue: 'because', beacuse: 'because', wensday: 'Wednesday',
  wedensday: 'Wednesday', febuary: 'February', goverment: 'government', truely: 'truly',
  begining: 'beginning', calender: 'calendar', schedual: 'schedule', paied: 'paid',
};

// Chat words that aren't in a dictionary but are meant.
const KEEP = new Set([
  'lol', 'lmao', 'lmfao', 'omg', 'btw', 'idk', 'idc', 'tbh', 'thx', 'tx', 'ty', 'tysm', 'np',
  'pls', 'plz', 'ok', 'okay', 'kk', 'haha', 'hahaha', 'hehe', 'hmm', 'hm', 'ya', 'yea', 'yeah',
  'nah', 'yep', 'yup', 'nope', 'bc', 'cuz', 'rn', 'asap', 'fyi', 'imo', 'imho', 'ngl', 'smh',
  'wya', 'gm', 'gn', 'ttyl', 'brb', 'jk', 'irl', 'dm', 'dms', 'appt', 'info', 'nss', 'autopay',
  'venmo', 'zelle', 'cashapp', 'ach', 'eta', 'tmrw', 'tmr', 'tho', 'thru', 'ur', 'u', 'bday',
  'gyau', 'gyau50', 'pickup', 'dropoff', 'signup', 'signups', 'checkin', 'email', 'emails',
  'emailed', 'texted', 'covid', 'wifi', 'whatsapp', 'stripe', 'abt', 'bf', 'gf', 'bro', 'bruh',
  'ikr', 'wyd', 'hbu', 'ily', 'nvm', 'omw', 'pic', 'pics', 'msg', 'txt', 'vs', 'etc', 'aka',
  'min', 'mins', 'hr', 'hrs', 'sec', 'yr', 'yrs', 'wk', 'wks', 'pt', 'convo', 'ppl', 'lmk',
  'tmi', 'wtf', 'wth', 'gtg', 'hmu', 'otw', 'wbu', 'tbd', 'tba', 'atm', 'pov', 'wat',
]);

const NEIGHBOURS: Record<string, string> = {
  q: 'wa', w: 'qeas', e: 'wrsd', r: 'etdf', t: 'ryfg', y: 'tugh', u: 'yihj', i: 'uojk',
  o: 'ipkl', p: 'ol', a: 'qwsz', s: 'adwezx', d: 'sferxc', f: 'dgrtcv', g: 'fhtyvb',
  h: 'gjyubn', j: 'hkuinm', k: 'jliom', l: 'kop', z: 'asx', x: 'zcsd', c: 'xvdf',
  v: 'cbfg', b: 'vngh', n: 'bmhj', m: 'njk',
};
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

const capitalise = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** How likely this one edit is a slip of the finger (lower = more likely). */
type Edit = { word: string; cost: number };

function edits1(w: string): Edit[] {
  const out: Edit[] = [];
  for (let i = 0; i < w.length; i++) {
    // Typed an extra letter (cheap when it doubled the one before it).
    out.push({ word: w.slice(0, i) + w.slice(i + 1), cost: w[i] === w[i - 1] || w[i] === w[i + 1] ? 0.1 : 0.4 });
    // Swapped two letters.
    if (i < w.length - 1) out.push({ word: w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2), cost: 0 });
    // Hit the wrong key.
    for (const c of LETTERS) {
      if (c === w[i]) continue;
      out.push({ word: w.slice(0, i) + c + w.slice(i + 1), cost: (NEIGHBOURS[w[i]] || '').includes(c) ? 0.3 : 1.2 });
    }
  }
  // Missed a letter (cheap when it's a double letter).
  for (let i = 0; i <= w.length; i++) {
    for (const c of LETTERS) {
      out.push({ word: w.slice(0, i) + c + w.slice(i), cost: c === w[i - 1] || c === w[i] ? 0.15 : 0.4 });
    }
  }
  return out;
}

/** The best real word for a misspelling, or null when nothing is close enough. */
export function bestCandidate(word: string, dictionary: Dictionary): string | null {
  const n = word.length;
  if (n < 3) return null;
  const score = (cand: string, cost: number) => {
    const rank = dictionary.get(cand)!;
    return Math.log(rank + 50) + cost * 2 + (cand[0] !== word[0] ? 1.6 : 0);
  };

  let best: string | null = null;
  let bestScore = Infinity;
  const consider = (cand: string, cost: number, maxRank: number) => {
    const rank = dictionary.get(cand);
    if (rank === undefined || rank > maxRank || cand.length < 2) return;
    const s = score(cand, cost);
    if (s < bestScore) { bestScore = s; best = cand; }
  };

  const first = edits1(word);
  for (const e of first) {
    // Three-letter words: only likely slips that keep the first letter, and only common words.
    if (n === 3 && (e.cost > 0.4 || e.word.length < 3 || e.word[0] !== word[0])) continue;
    consider(e.word, e.cost, n === 3 ? 5000 : 40000);
  }
  if (best || n < 6) return best;

  // Long words can be two slips off ("tommorow").
  const seen = new Set<string>();
  for (const e of first) {
    if (seen.has(e.word)) continue;
    seen.add(e.word);
    for (const e2 of edits1(e.word)) consider(e2.word, 0.8 + e.cost + e2.cost, 20000);
  }
  return best;
}

/**
 * What `word` should become, or null to leave it as typed. `word` is letters
 * with optional apostrophes, as the person typed it.
 */
export function correctWord(word: string, ctx: CorrectContext): string | null {
  const lower = word.toLowerCase();
  const isLower = word === lower;
  const isCapitalised = !isLower && word === capitalise(lower);
  const withCase = (fixed: string) =>
    (ctx.sentenceStart || isCapitalised) && fixed === fixed.toLowerCase() ? capitalise(fixed) : fixed;
  const capsOnly = () => {
    if (!ctx.sentenceStart || !isLower) return null;
    const c = capitalise(word);
    return c === word ? null : c;
  };

  // SHOUTING, iPhone, McDonald: written that way on purpose.
  if (!isLower && !isCapitalised) return null;
  // A capitalised word mid-sentence is a name.
  if (isCapitalised && !ctx.sentenceStart) return null;
  if (ctx.learned.has(lower)) return null;

  const fixed = FIXED[lower];
  if (fixed !== undefined) {
    const out = withCase(fixed);
    return out === word ? null : out;
  }
  if (word.length === 1 || KEEP.has(lower) || lower.includes("'")) return capsOnly();
  if (ctx.dictionary?.has(lower)) return capsOnly();

  const knownAs = ctx.known.get(lower);
  if (knownAs !== undefined) {
    const out = ctx.sentenceStart ? capitalise(knownAs) : knownAs;
    return out === word ? null : out;
  }

  if (!ctx.dictionary) return capsOnly();
  const cand = bestCandidate(lower, ctx.dictionary);
  if (!cand) return capsOnly();
  // "wednsday" → "Wednesday", not "wednesday".
  return withCase(FIXED[cand] ?? cand);
}

// ── Reading the text around the cursor ─────────────────────────────────────

const OPENERS = `"'(“‘[`;
const WORD_AT_END = /([A-Za-z][A-Za-z']*)$/;

/** Is the text before a word the start of a sentence? */
export function isSentenceStart(before: string): boolean {
  const trimmed = before.replace(new RegExp(`[${OPENERS.replace(/[[\]]/g, '\\$&')}]+$`), '');
  if (/^\s*$/.test(trimmed)) return true;
  if (/\n\s*$/.test(trimmed)) return true;
  return /[.!?]["'”’)\]]*\s+$/.test(trimmed);
}

/**
 * The word that ends at `end` in `text`, when it stands alone as a word (not
 * part of a link, email, @handle, number or code). Null otherwise.
 */
export function wordEndingAt(text: string, end: number): { word: string; start: number } | null {
  const before = text.slice(0, end);
  const m = before.match(WORD_AT_END);
  if (!m) return null;
  let word = m[1];
  // A trailing apostrophe is a closing quote, not part of the word.
  const trailing = word.match(/'+$/)?.[0].length || 0;
  word = word.slice(0, word.length - trailing);
  if (!word) return null;
  const start = end - m[1].length;
  // The whole run of non-space characters must be just the word (plus opening quotes).
  const token = before.match(/\S*$/)![0];
  const lead = token.slice(0, token.length - m[1].length);
  if (lead && ![...lead].every((c) => OPENERS.includes(c))) return null;
  return { word, start };
}

/** Lowercase → written form, for names and words seen in the conversation. */
export function knownWordsFrom(text: string): Map<string, string> {
  const known = new Map<string, string>();
  for (const w of text.match(/[A-Za-z][A-Za-z']*/g) || []) {
    const lower = w.toLowerCase();
    const prev = known.get(lower);
    // Remember the capitalised form if the word was ever written that way.
    if (prev === undefined || (prev === lower && w !== lower)) known.set(lower, w);
  }
  return known;
}
