import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from '@/components/workspace';
import { api, type AnalysisResult, type Health } from '@/lib/api';

vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), backendConfigured: true }));
const health: Health = { engine_ready: true, engine_status: 'ready', busy: false, max_file_bytes: 10485760, max_pages: 40, timeout_seconds: 60 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const ORIGINAL = 'Nome: Ana Silva, 47 anos\nEmail: ana@mail.pt';
const ANONYMIZED = 'Nome: * *, 47 anos\nEmail: *';

async function fixture(): Promise<AnalysisResult> {
  const bytes = new TextEncoder().encode(ANONYMIZED);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return {
    status: 'completed', original_text: ORIGINAL, anonymized_text: ANONYMIZED, page_count: 1, processing_ms: 1200,
    spans: [
      { original_start: 6, original_end: 16, result_start: 6, result_end: 10, word_count: 2 },
      { original_start: 32, original_end: 43, result_start: 23, result_end: 24, category: 'email', word_count: 1 },
    ],
    summary: { masked_spans: 2, substitutions: 3, categories: ['email'], categories_complete: false },
    download: { filename: 'doc-anonimizado.txt', encoding: 'utf-8', byte_length: bytes.length, sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''), base64: btoa(String.fromCharCode(...bytes)) },
  };
}

async function analyze() {
  vi.stubGlobal('crypto', webcrypto);
  vi.spyOn(api, 'health').mockResolvedValue(health);
  vi.spyOn(api, 'anonymize').mockResolvedValue(await fixture());
  render(<MotionConfig reducedMotion="always"><Workspace /></MotionConfig>);
  await screen.findByText('Engine connected');
  const file = new File(['%PDF-1.7\nfixture'], 'authorized.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: async () => new TextEncoder().encode('%PDF-').buffer }) });
  const input = document.querySelector<HTMLInputElement>('#pdf-file');
  if (!input) throw new Error('File input missing');
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('authorized.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Anonymize document' }));
  await screen.findByText('Completed');
}

function metric(label: string) {
  return screen.getByText(label).nextElementSibling?.textContent;
}

function readText(blob: Blob): Promise<string> {
  return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
}

async function downloaded() {
  let blob: Blob | undefined;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: (b: Blob) => { blob = b; return 'blob:http://localhost/test'; } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  let name = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
  fireEvent.click(screen.getByRole('button', { name: 'Download .txt' }));
  return { name, text: blob ? await readText(blob) : '' };
}

describe('manual review: toggling words', () => {
  it('starts with the engine result and downloads the exact engine bytes', async () => {
    await analyze();
    expect(screen.getByLabelText('Anonymized text').textContent).toBe(ANONYMIZED);
    expect(screen.getByText(/Click any word to mask or unmask it/)).toBeVisible();
    expect(screen.queryByText(/made by you/)).toBeNull();
    expect(await downloaded()).toEqual({ name: 'doc-anonimizado.txt', text: ANONYMIZED });
  });

  it('masking and unmasking words updates text, counts and download; reset restores', async () => {
    await analyze();
    const original = within(screen.getByLabelText('Original text'));
    fireEvent.click(original.getByRole('button', { name: '47' }));
    expect(screen.getByLabelText('Anonymized text').textContent).toBe('Nome: * *, * anos\nEmail: *');
    expect(metric('Words replaced')).toBe('4');
    expect(screen.getByText('1 change made by you')).toBeVisible();
    expect(original.getByRole('button', { name: '47' })).toHaveAttribute('aria-pressed', 'true');
    expect(original.getByRole('button', { name: '47' })).toHaveClass('manual');

    const anonymized = within(screen.getByLabelText('Anonymized text'));
    fireEvent.click(anonymized.getAllByRole('button', { name: '*' })[0] as HTMLElement);
    expect(screen.getByLabelText('Anonymized text').textContent).toBe('Nome: Ana *, * anos\nEmail: *');
    expect(screen.getByText('2 changes made by you')).toBeVisible();
    expect(screen.getByText('Your reviewed result is ready to download')).toBeVisible();
    expect(await downloaded()).toEqual({ name: 'doc-anonimizado-revisto.txt', text: 'Nome: Ana *, * anos\nEmail: *' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to engine result' }));
    expect(screen.getByLabelText('Anonymized text').textContent).toBe(ANONYMIZED);
    expect(metric('Words replaced')).toBe('3');
    expect(screen.queryByText(/made by you/)).toBeNull();
  });
});
