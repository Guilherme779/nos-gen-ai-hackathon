import type { AnalysisResult, Span } from './api';

/** Ported from supplied result-utils.mjs. Never detect, replace or normalize text. */
export function validateSelection(file: Pick<File, 'name' | 'type' | 'size'> | null, maxBytes = 10485760): string | null {
  if (!file) return 'Select a PDF file.';
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) return 'Only PDF files are accepted.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > maxBytes) return `The limit is ${Math.round(maxBytes / 1048576)} MB per file.`;
  return null;
}

export async function validatePdf(file: File, maxBytes = 10485760): Promise<string | null> {
  const error = validateSelection(file, maxBytes);
  if (error) return error;
  try {
    const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    return header === '%PDF-' ? null : 'The file contents do not match a PDF.';
  } catch { return 'The file could not be read. Please select it again.'; }
}

export interface TextPart { text: string; marked: boolean; category?: string | undefined }
export function textParts(text: string, spans: Span[] | null | undefined, side: 'original' | 'anonymized'): TextPart[] {
  const characters = Array.from(text);
  const parts: TextPart[] = [];
  let previous = 0;
  for (const span of spans || []) {
    const start = span?.[side === 'original' ? 'original_start' : 'result_start'];
    const end = span?.[side === 'original' ? 'original_end' : 'result_end'];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < previous || end <= start || end > characters.length) throw new Error('The change positions are invalid.');
    if (start > previous) parts.push({ text: characters.slice(previous, start).join(''), marked: false });
    parts.push({ text: characters.slice(start, end).join(''), marked: true, category: span.category });
    previous = end;
  }
  if (previous < characters.length) parts.push({ text: characters.slice(previous).join(''), marked: false });
  return parts;
}

const nullableCount = (n: unknown) => n === null || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
export function validateResult(value: unknown): AnalysisResult {
  if (!value || typeof value !== 'object') throw new Error('The engine returned an incomplete response.');
  const r = value as AnalysisResult;
  if (r.status !== 'completed' || typeof r.original_text !== 'string' || typeof r.anonymized_text !== 'string' ||
      !r.anonymized_text || !r.anonymized_text.trim() || !r.summary || !r.download ||
      (r.spans != null && !Array.isArray(r.spans)) || !nullableCount(r.page_count) ||
      !(r.processing_ms === null || (typeof r.processing_ms === 'number' && Number.isFinite(r.processing_ms) && r.processing_ms >= 0)) ||
      !nullableCount(r.summary.masked_spans) || !nullableCount(r.summary.substitutions) ||
      !(r.summary.categories === null || (Array.isArray(r.summary.categories) && r.summary.categories.every(c => typeof c === 'string'))) ||
      typeof r.summary.categories_complete !== 'boolean' || r.download.encoding !== 'utf-8' ||
      typeof r.download.filename !== 'string' || typeof r.download.base64 !== 'string' ||
      !Number.isInteger(r.download.byte_length) || r.download.byte_length < 0 ||
      typeof r.download.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.download.sha256)) {
    throw new Error('The engine returned an incomplete response.');
  }
  textParts(r.original_text, r.spans, 'original');
  textParts(r.anonymized_text, r.spans, 'anonymized');
  return r;
}

export async function readDownload(value: unknown): Promise<{ result: AnalysisResult; bytes: Uint8Array<ArrayBuffer> }> {
  const result = validateResult(value);
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = Uint8Array.from(atob(result.download.base64), c => c.charCodeAt(0)); }
  catch { throw new Error('The file returned by the engine is invalid.'); }
  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('The file returned by the engine is invalid.'); }
  if (bytes.length !== result.download.byte_length || decoded !== result.anonymized_text) throw new Error('The file does not match the received text. The download was blocked.');
  if (!globalThis.crypto?.subtle) throw new Error('File verification is unavailable in this browser. Use HTTPS to verify the download.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== result.download.sha256) throw new Error('File verification failed.');
  return { result, bytes };
}