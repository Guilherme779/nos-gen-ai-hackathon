import type { AnalysisResult, Span } from './api';

/**
 * Manual review: the user can mask or unmask any word of the result.
 *
 * The original and the anonymized texts are aligned word by word (the engine
 * guarantees it whenever it sends spans). Every word keeps its engine state;
 * the user only flips it. With no changes, the rebuilt text is exactly the
 * engine output, so the verified download stays valid.
 * Offsets are Unicode code points, like the engine spans.
 */

const PUNCT = '.,;:!?()[]{}"\'«»';
const MASK = /^[^A-Za-z0-9]*\*[^A-Za-z0-9]*$/;

export interface Word {
  line: number;
  original: string;
  engine: string;
  engineMasked: boolean;
  masked: boolean;
  category?: string | undefined;
}

interface Token { start: number; end: number; text: string }

export function isMask(word: string): boolean {
  return MASK.test(word);
}

/** Replaces the word by "*", keeping attached punctuation ("Santos," -> "*,"). */
export function maskWord(word: string): string {
  const chars = Array.from(word);
  let start = 0;
  let end = chars.length;
  while (start < end && PUNCT.includes(chars[start] ?? '')) start++;
  while (end > start && PUNCT.includes(chars[end - 1] ?? '')) end--;
  if (start === end) return word;
  return chars.slice(0, start).join('') + '*' + chars.slice(end).join('');
}

function tokens(chars: string[], from: number, to: number): Token[] {
  const out: Token[] = [];
  let i = from;
  while (i < to) {
    while (i < to && /\s/.test(chars[i] ?? '')) i++;
    if (i >= to) break;
    const start = i;
    while (i < to && !/\s/.test(chars[i] ?? '')) i++;
    out.push({ start, end: i, text: chars.slice(start, i).join('') });
  }
  return out;
}

function lines(chars: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = 0;
  chars.forEach((c, i) => { if (c === '\n') { out.push([start, i]); start = i + 1; } });
  out.push([start, chars.length]);
  return out;
}

/** Words of the result, or null when the texts are not aligned word by word. */
export function buildReview(result: AnalysisResult): Word[] | null {
  if (result.spans == null) return null;
  const o = Array.from(result.original_text);
  const a = Array.from(result.anonymized_text);
  const oLines = lines(o);
  const aLines = lines(a);
  if (oLines.length !== aLines.length) return null;
  const words: Word[] = [];
  for (let n = 0; n < oLines.length; n++) {
    const [os, oe] = oLines[n] ?? [0, 0];
    const [as, ae] = aLines[n] ?? [0, 0];
    const ot = tokens(o, os, oe);
    const at = tokens(a, as, ae);
    if (ot.length !== at.length) return null;
    ot.forEach((tok, i) => {
      const engine = at[i]?.text ?? '';
      const engineMasked = isMask(engine) && !isMask(tok.text);
      const span = result.spans?.find(s => s.original_start < tok.end && tok.start < s.original_end);
      words.push({ line: n, original: tok.text, engine, engineMasked, masked: engineMasked, category: span?.category });
    });
  }
  return words;
}

export function toggleWord(words: Word[], index: number): Word[] {
  return words.map((w, i) => (i === index ? { ...w, masked: !w.masked } : w));
}

export function resetWords(words: Word[]): Word[] {
  return words.map(w => ({ ...w, masked: w.engineMasked }));
}

/** What a word shows in the anonymized text. */
export function shownWord(w: Word): string {
  if (w.masked === w.engineMasked) return w.engine;
  return w.masked ? maskWord(w.original) : w.original;
}

export interface Rendered {
  text: string;
  spans: Span[];
  summary: AnalysisResult['summary'];
  changes: number;
}

/** Rebuilds the anonymized text, spans and counts from the word states. */
export function renderReview(result: AnalysisResult, words: Word[]): Rendered {
  const o = Array.from(result.original_text);
  const a = Array.from(result.anonymized_text);
  const oLines = lines(o);
  const aLines = lines(a);
  const out: string[] = [];
  const spans: Span[] = [];
  let k = 0;
  let pos = 0;
  for (let n = 0; n < aLines.length; n++) {
    const [as, ae] = aLines[n] ?? [0, 0];
    const [os, oe] = oLines[n] ?? [0, 0];
    const at = tokens(a, as, ae);
    const ot = tokens(o, os, oe);
    let cursor = as;
    let current: Span | null = null;
    at.forEach((tok, i) => {
      const gap = a.slice(cursor, tok.start).join('');
      out.push(gap);
      pos += Array.from(gap).length;
      const w = words[k++];
      const shown = w ? shownWord(w) : tok.text;
      const length = Array.from(shown).length;
      const src = ot[i];
      if (w?.masked && src) {
        if (current) {
          current.original_end = src.end;
          current.result_end = pos + length;
          current.word_count = (current.word_count ?? 0) + 1;
          if (!current.category && w.category) current.category = w.category;
        } else {
          current = { original_start: src.start, original_end: src.end, result_start: pos, result_end: pos + length, word_count: 1 };
          if (w.category) current.category = w.category;
          spans.push(current);
        }
      } else {
        current = null;
      }
      out.push(shown);
      pos += length;
      cursor = tok.end;
    });
    const tail = a.slice(cursor, ae).join('') + (n < aLines.length - 1 ? '\n' : '');
    out.push(tail);
    pos += Array.from(tail).length;
  }
  const categories = [...new Set(spans.map(s => s.category).filter((c): c is string => Boolean(c)))].sort();
  return {
    text: out.join(''),
    spans,
    summary: {
      masked_spans: spans.length,
      substitutions: spans.reduce((t, s) => t + (s.word_count ?? 0), 0),
      categories,
      categories_complete: spans.every(s => Boolean(s.category)),
    },
    changes: words.filter(w => w.masked !== w.engineMasked).length,
  };
}

/** "relatorio-anonimizado.txt" -> "relatorio-anonimizado-revisto.txt" */
export function reviewedFilename(name: string): string {
  const base = name.replace(/\.txt$/i, '') || 'anonymized-document';
  return `${base}-revisto.txt`;
}
