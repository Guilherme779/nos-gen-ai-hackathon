import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createApiClient, type AnalysisResult, type Health } from '@/lib/api';
import { readDownload, textParts, validatePdf, validateResult, validateSelection } from '@/lib/result-utils';

const health: Health = { engine_ready: true, engine_status: 'ready', busy: false, max_file_bytes: 10485760, max_pages: 40, timeout_seconds: 1 };
async function fixture(text = 'Olá *\nContexto.'): Promise<AnalysisResult> {
  const bytes = new TextEncoder().encode(text);
  const hash = await webcrypto.subtle.digest('SHA-256', bytes);
  return { status: 'completed', original_text: 'Olá João\nContexto.', anonymized_text: text, page_count: 1, processing_ms: null, spans: null,
    summary: { masked_spans: null, substitutions: null, categories: null, categories_complete: false },
    download: { filename: 'result.txt', encoding: 'utf-8', byte_length: bytes.length, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''), base64: btoa(String.fromCharCode(...bytes)) } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('PDF selection', () => {
  it('checks type, extension, empty files and limits', () => {
    expect(validateSelection(null)).toBe('Select a PDF file.');
    expect(validateSelection({ name: 'x.txt', type: '', size: 10 })).toContain('Only PDF');
    expect(validateSelection({ name: 'x.pdf', type: 'text/plain', size: 10 })).toContain('Only PDF');
    expect(validateSelection({ name: 'x.pdf', type: '', size: 0 })).toContain('empty');
    expect(validateSelection({ name: 'x.pdf', type: '', size: 10485761 })).toContain('10 MB');
    expect(validateSelection({ name: 'X.PDF', type: '', size: 10485760 })).toBeNull();
  });
  it('checks actual PDF magic bytes and read failures', async () => {
    const file = (header: string) => ({ name: 'x.pdf', type: 'application/pdf', size: header.length, slice: () => ({ arrayBuffer: async () => new TextEncoder().encode(header).buffer }) }) as unknown as File;
    expect(await validatePdf(file('%PDF-'))).toBeNull();
    expect(await validatePdf(file('wrong'))).toContain('do not match');
    const bad = file('%PDF-'); bad.slice = () => { throw new Error('read'); };
    expect(await validatePdf(bad)).toContain('could not be read');
  });
});
describe('result presentation and integrity', () => {
  it('uses codepoint offsets and rejects invalid sibling spans', () => {
    const span = { original_start: 1, original_end: 2, result_start: 1, result_end: 2, category: 'name' };
    expect(textParts('A🧪B', [span], 'original')).toEqual([{ text: 'A', marked: false }, { text: '🧪', marked: true, category: 'name' }, { text: 'B', marked: false }]);
    expect(() => textParts('A🧪B', [{ ...span, original_end: 4 }], 'original')).toThrow('positions');
    expect(() => textParts('A🧪B', [span, span], 'original')).toThrow('positions');
    expect(() => textParts('A*B', [{ ...span, result_start: -1 }], 'anonymized')).toThrow('positions');
  });
  it('preserves exact UTF-8 bytes and null metadata', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const result = await fixture('🧪 *\n\nunchanged\r\n');
    const read = await readDownload(result);
    expect(new TextDecoder().decode(read.bytes)).toBe(result.anonymized_text);
    expect(read.result.summary.masked_spans).toBeNull();
  });
  it('blocks incomplete, empty, mismatched and corrupted downloads', async () => {
    vi.stubGlobal('crypto', webcrypto);
    expect(() => validateResult({})).toThrow('incomplete');
    const result = await fixture();
    expect(() => validateResult({ ...result, anonymized_text: '' })).toThrow('incomplete');
    await expect(readDownload({ ...result, anonymized_text: 'different' })).rejects.toThrow('does not match');
    await expect(readDownload({ ...result, download: { ...result.download, byte_length: 99 } })).rejects.toThrow('does not match');
    await expect(readDownload({ ...result, download: { ...result.download, sha256: '0'.repeat(64) } })).rejects.toThrow('verification failed');
    await expect(readDownload({ ...result, download: { ...result.download, base64: '!bad!' } })).rejects.toThrow('invalid');
    vi.stubGlobal('crypto', {});
    await expect(readDownload(result)).rejects.toThrow('unavailable');
  });
});
describe('isolated API contract', () => {
  it('does not fetch when configuration is absent', async () => {
    const fetcher = vi.fn(); const client = createApiClient('', fetcher);
    await expect(client.health()).rejects.toThrow('pending'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates health and sends the raw File with encoded filename', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => health }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed' }) });
    const client = createApiClient('https://engine.test/', fetcher);
    expect(await client.health()).toEqual(health);
    const file = new File(['%PDF-'], 'Declaração 1.pdf', { type: 'application/pdf' });
    await client.anonymize(file, health);
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://engine.test/api/anonymize');
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ body: file, method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) } });
  });
  it('preserves backend error messages and rejects invalid status', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Engine busy' } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ engine_ready: true }) });
    const client = createApiClient('https://engine.test', fetcher);
    await expect(client.anonymize(new File(['%PDF-'], 'x.pdf'), health)).rejects.toThrow('Engine busy');
    await expect(client.health()).rejects.toThrow('invalid status');
  });
  it('aborts health after six seconds and analysis at the engine timeout plus 20', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string | URL | Request, options?: RequestInit) => new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const client = createApiClient('https://engine.test', fetcher);
    const healthCheck = expect(client.health()).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(6000); await healthCheck;
    const operation = expect(client.anonymize(new File(['%PDF-'], 'x.pdf'), health)).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(21000); await operation;
  });
});