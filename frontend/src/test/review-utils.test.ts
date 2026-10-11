import { describe, expect, it } from 'vitest';
import type { AnalysisResult, Span } from '@/lib/api';
import { buildReview, isMask, maskWord, renderReview, resetWords, reviewedFilename, toggleWord } from '@/lib/review';
import { textParts } from '@/lib/result-utils';

function result(original: string, anonymized: string, spans: Span[] | null): AnalysisResult {
  return {
    status: 'completed', original_text: original, anonymized_text: anonymized, page_count: 1, processing_ms: 1, spans,
    summary: { masked_spans: spans?.length ?? null, substitutions: null, categories: null, categories_complete: false },
    download: { filename: 'doc-anonimizado.txt', encoding: 'utf-8', byte_length: 0, sha256: '0'.repeat(64), base64: '' },
  };
}

// "Nome: João Conceição," masked by the engine; e-mail masked by a rule
const ORIGINAL = 'Nome: João Conceição, 47 anos\nEmail: ana@mail.pt\nFim.';
const ANONYMIZED = 'Nome: * *, 47 anos\nEmail: *\nFim.';
const SPANS = [
  { original_start: 6, original_end: 21, result_start: 6, result_end: 10, word_count: 2 },
  { original_start: 37, original_end: 48, result_start: 26, result_end: 27, category: 'email', word_count: 1 },
];

describe('maskWord / isMask', () => {
  it('keeps attached punctuation and leaves punctuation alone', () => {
    expect(maskWord('Santos,')).toBe('*,');
    expect(maskWord('(João,')).toBe('(*,');
    expect(maskWord('...')).toBe('...');
    expect(isMask('*,')).toBe(true);
    expect(isMask('Ana')).toBe(false);
  });
});

describe('buildReview', () => {
  it('reads engine state and categories for every word', () => {
    const words = buildReview(result(ORIGINAL, ANONYMIZED, SPANS));
    expect(words).not.toBeNull();
    expect(words?.filter(w => w.engineMasked).map(w => w.original)).toEqual(['João', 'Conceição,', 'ana@mail.pt']);
    expect(words?.find(w => w.original === 'ana@mail.pt')?.category).toBe('email');
  });

  it('returns null without spans or when texts are not aligned', () => {
    expect(buildReview(result(ORIGINAL, ANONYMIZED, null))).toBeNull();
    expect(buildReview(result('a b\nc', 'a *\nc\nd', []))).toBeNull();
    expect(buildReview(result('a b', '*', []))).toBeNull();
  });
});

describe('renderReview', () => {
  it('without changes gives exactly the engine output, even with different spacing', () => {
    const r = result('Nome:  Ana Silva\nok', 'Nome: * *\nok', [{ original_start: 7, original_end: 16, result_start: 6, result_end: 9, word_count: 2 }]);
    const words = buildReview(r);
    if (!words) throw new Error('aligned fixture');
    const out = renderReview(r, words);
    expect(out.text).toBe(r.anonymized_text);
    expect(out.changes).toBe(0);
    expect(out.summary.masked_spans).toBe(1);
    expect(out.summary.substitutions).toBe(2);
  });

  it('masking a word updates text, spans and counts', () => {
    const r = result(ORIGINAL, ANONYMIZED, SPANS);
    const words = buildReview(r);
    if (!words) throw new Error('aligned fixture');
    const idx = words.findIndex(w => w.original === '47');
    const out = renderReview(r, toggleWord(words, idx));
    expect(out.text).toBe('Nome: * *, * anos\nEmail: *\nFim.');
    expect(out.changes).toBe(1);
    // "47" joins the masked name right before it: still one passage
    expect(out.summary.masked_spans).toBe(2);
    expect(out.summary.substitutions).toBe(4);
    expect(out.summary.categories).toEqual(['email']);
    expect(out.summary.categories_complete).toBe(false);
  });

  it('unmasking a word restores the original word and its punctuation', () => {
    const r = result(ORIGINAL, ANONYMIZED, SPANS);
    const words = buildReview(r);
    if (!words) throw new Error('aligned fixture');
    const idx = words.findIndex(w => w.original === 'Conceição,');
    const out = renderReview(r, toggleWord(words, idx));
    expect(out.text).toBe('Nome: * Conceição, 47 anos\nEmail: *\nFim.');
    expect(out.summary.substitutions).toBe(2);
  });

  it('spans stay valid for the highlighter on both sides (Unicode offsets)', () => {
    const r = result(ORIGINAL, ANONYMIZED, SPANS);
    const words = buildReview(r);
    if (!words) throw new Error('aligned fixture');
    const edited = toggleWord(toggleWord(words, words.findIndex(w => w.original === 'Fim.')), words.findIndex(w => w.original === 'João'));
    const out = renderReview(r, edited);
    const original = textParts(r.original_text, out.spans, 'original').filter(p => p.marked).map(p => p.text);
    const anonymized = textParts(out.text, out.spans, 'anonymized').filter(p => p.marked).map(p => p.text);
    expect(original).toEqual(['Conceição,', 'ana@mail.pt', 'Fim.']);
    expect(anonymized).toEqual(['*,', '*', '*.']);
  });

  it('reset brings back the engine result', () => {
    const r = result(ORIGINAL, ANONYMIZED, SPANS);
    const words = buildReview(r);
    if (!words) throw new Error('aligned fixture');
    const out = renderReview(r, resetWords(toggleWord(words, 0)));
    expect(out.text).toBe(ANONYMIZED);
    expect(out.changes).toBe(0);
  });
});

describe('reviewedFilename', () => {
  it('adds the -revisto suffix', () => {
    expect(reviewedFilename('doc-anonimizado.txt')).toBe('doc-anonimizado-revisto.txt');
    expect(reviewedFilename('')).toBe('anonymized-document-revisto.txt');
  });
});
