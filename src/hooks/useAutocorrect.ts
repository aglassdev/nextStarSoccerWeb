// iMessage-style autocorrect for a chat box.
//
// Phones and tablets already autocorrect with their own keyboard, so there the
// hook only turns the browser's native autocorrect/spellcheck on. On a computer
// it fixes each word as it's finished (space, punctuation, new line, or Send):
//  - Backspace right after a fix puts the typed word back, and that word is
//    never changed again in this browser;
//  - Cmd/Ctrl+Z undoes a fix too (fixes go through the browser's own undo);
//  - names and words from the open conversation are left as written.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { correctWord, isSentenceStart, knownWordsFrom, wordEndingAt } from '../utils/autocorrect/engine';
import { getDictionary, getLearned, learnWord, loadDictionary } from '../utils/autocorrect/dictionary';

type Field = HTMLTextAreaElement | HTMLInputElement;

const ENDS_WORD = new Set([' ', '.', ',', '!', '?', ';', ':', ')', ']', '"', '”', '\n']);

/** Attributes that turn on the browser's own autocorrect, spellcheck and capitals. */
export const nativeAutocorrectProps = {
  spellCheck: true,
  autoCorrect: 'on',
  autoCapitalize: 'sentences',
} as const;

const touchDevice = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;

/** Replace [start, end) with text through the browser's editing, so undo and React both see it. */
function replaceRange(el: Field, start: number, end: number, text: string) {
  const before = el.selectionStart ?? end;
  el.setSelectionRange(start, end);
  let ok = false;
  // execCommand edits whatever has focus, so only use it while this box does
  // (on Send by button click, the button has focus).
  if (document.activeElement === el) {
    try {
      ok = document.execCommand('insertText', false, text);
    } catch {
      ok = false;
    }
  }
  if (!ok || el.value.slice(start, start + text.length) !== text) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    const v = el.value;
    setValue?.call(el, v.slice(0, start) + text + v.slice(end));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Keep the cursor where the person was typing.
  const caret = before >= end ? before + text.length - (end - start) : start + text.length;
  el.setSelectionRange(caret, caret);
}

interface LastFix {
  start: number;
  original: string;
  replacement: string;
  /** What ended the word (" ", "." …), or "" when fixed on Send. */
  boundary: string;
}

/**
 * Autocorrect for the chat box at `ref`. `context` is text from the open
 * conversation (names, messages) whose words are taken as meant.
 * Returns `finish()`: fixes the last word and returns the box's text, for Send.
 */
export function useAutocorrect(ref: RefObject<Field>, context = '') {
  const enabled = useMemo(() => !touchDevice(), []);
  const known = useMemo(() => knownWordsFrom(context), [context]);
  const knownRef = useRef(known);
  knownRef.current = known;
  const last = useRef<LastFix | null>(null);
  const applying = useRef(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; run: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const idle = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    if (idle) idle(() => void loadDictionary());
    else setTimeout(() => void loadDictionary(), 300);
  }, [enabled]);

  /** Fix the word ending at `end`, which `boundary` follows. Returns true if changed. */
  const fixWordAt = useCallback((el: Field, end: number, boundary: string) => {
    const found = wordEndingAt(el.value, end);
    if (!found) return false;
    const { word, start } = found;
    const fixed = correctWord(word, {
      dictionary: getDictionary(),
      sentenceStart: isSentenceStart(el.value.slice(0, start)),
      learned: getLearned(),
      known: knownRef.current,
    });
    if (!fixed || fixed === word) return false;
    applying.current = true;
    try {
      replaceRange(el, start, start + word.length, fixed);
    } finally {
      applying.current = false;
    }
    last.current = { start, original: word, replacement: fixed, boundary };
    return true;
  }, []);

  const flushPending = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    p.run();
  }, []);

  // Listen on the document (capture), not the box, so a box that mounts later
  // (after a conversation is picked) is covered without re-binding.
  useEffect(() => {
    if (!enabled) return;

    const onInput = (e: Event) => {
      const el = ref.current;
      if (!el || e.target !== el || applying.current) return;
      last.current = null;
      const ie = e as InputEvent;
      const typed = ie.inputType === 'insertLineBreak' || ie.inputType === 'insertParagraph' ? '\n' : ie.data;
      if (!typed || typed.length !== 1 || !ENDS_WORD.has(typed)) return;
      if (el.selectionStart !== el.selectionEnd) return;
      const caret = el.selectionStart ?? 0;
      const value = el.value;
      // Let React take the keystroke first, then fix the word before it.
      flushPending();
      const run = () => {
        if (el.value.slice(0, caret) !== value.slice(0, caret)) return; // text changed meanwhile
        fixWordAt(el, caret - 1, typed);
      };
      pending.current = { timer: setTimeout(() => { pending.current = null; run(); }, 0), run };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el || e.target !== el) return;
      if (['Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].includes(e.key)) return;
      flushPending();
      const fix = last.current;
      if (e.key !== 'Backspace' || e.metaKey || e.ctrlKey || e.altKey || !fix) {
        if (e.key !== 'Enter') last.current = null;
        return;
      }
      last.current = null;
      const end = fix.start + fix.replacement.length + fix.boundary.length;
      const caretOk = el.selectionStart === end && el.selectionEnd === end;
      if (!caretOk || el.value.slice(fix.start, end) !== fix.replacement + fix.boundary) return;
      // Backspace right after a fix: put back what was typed, and remember it.
      e.preventDefault();
      applying.current = true;
      try {
        replaceRange(el, fix.start, fix.start + fix.replacement.length, fix.original);
      } finally {
        applying.current = false;
      }
      learnWord(fix.original);
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('keydown', onKeyDown, true);
      flushPending();
    };
  }, [enabled, ref, fixWordAt, flushPending]);

  /** Fix the last word (like a phone does on Send) and return the box's text. */
  const finish = useCallback((): string => {
    const el = ref.current;
    if (!el) return '';
    if (!enabled) return el.value;
    flushPending();
    const trimmedEnd = el.value.replace(/\s+$/, '').length;
    if (trimmedEnd > 0 && !ENDS_WORD.has(el.value[trimmedEnd - 1])) fixWordAt(el, trimmedEnd, '');
    last.current = null;
    return el.value;
  }, [enabled, ref, fixWordAt, flushPending]);

  return { finish };
}
