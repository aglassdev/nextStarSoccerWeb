// Loads the autocorrect word list once (public/autocorrect/en-words.txt, built
// by scripts/build-autocorrect-words.mjs). Until it arrives, autocorrect still
// does the fixed fixes ("i" → "I", "dont" → "don't") and capitals.
import type { Dictionary } from './engine';

let dictionary: Dictionary | null = null;
let loading: Promise<Dictionary | null> | null = null;

export const getDictionary = () => dictionary;

export function loadDictionary(): Promise<Dictionary | null> {
  if (!loading) {
    loading = fetch('/autocorrect/en-words.txt')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        const map: Dictionary = new Map();
        let rank = 0;
        for (const w of text.split('\n')) if (w) map.set(w, rank++);
        dictionary = map;
        return map;
      })
      .catch(() => {
        loading = null; // try again next time a chat opens
        return null;
      });
  }
  return loading;
}

const LEARNED_KEY = 'nss-autocorrect-learned';
let learned: Set<string> | null = null;

/** Words this person undid. Kept in this browser so they're never changed again. */
export function getLearned(): Set<string> {
  if (!learned) {
    learned = new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]');
      if (Array.isArray(saved)) for (const w of saved) if (typeof w === 'string') learned.add(w);
    } catch {
      // storage blocked or corrupt: start empty
    }
  }
  return learned;
}

export function learnWord(word: string) {
  const set = getLearned();
  set.add(word.toLowerCase());
  try {
    localStorage.setItem(LEARNED_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    // storage blocked: remembered for this visit only
  }
}
