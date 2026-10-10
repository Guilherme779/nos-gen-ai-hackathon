import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from '@/components/workspace';
import { api, type AnalysisResult, type Health } from '@/lib/api';

vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), backendConfigured: true }));
const health: Health = { engine_ready: true, engine_status: 'ready', busy: false, max_file_bytes: 10485760, max_pages: 40, timeout_seconds: 60 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function selectFile() {
  const file = new File(['%PDF-1.7\nfixture'], 'authorized.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: async () => new TextEncoder().encode('%PDF-').buffer }) });
  const input = document.querySelector<HTMLInputElement>('#pdf-file');
  if (!input) throw new Error('File input missing');
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('authorized.pdf');
  return file;
}
async function resultFixture(): Promise<AnalysisResult> {
  const text = 'Olá *\nContexto.'; const bytes = new TextEncoder().encode(text);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return { status: 'completed', original_text: 'Olá João\nContexto.', anonymized_text: text, page_count: 1, processing_ms: null, spans: null,
    summary: { masked_spans: null, substitutions: null, categories: null, categories_complete: false },
    download: { filename: 'verified.txt', encoding: 'utf-8', byte_length: bytes.length, sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''), base64: btoa(String.fromCharCode(...bytes)) } };
}
describe('review UI against explicit test fixtures (not the teammate engine)', () => {
  it('reads verified results, changes views, downloads unchanged bytes and clears after confirmation', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(api, 'health').mockResolvedValue(health);
    const result = await resultFixture();
    const anonymize = vi.spyOn(api, 'anonymize').mockResolvedValue(result);
    render(<MotionConfig reducedMotion="always"><Workspace /></MotionConfig>);
    await screen.findByText('Engine connected');
    const file = await selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Anonymize document' }));
    await screen.findByText('Completed');
    expect(screen.getByRole('button', { name: 'Download .txt' })).toBeEnabled();
    expect(screen.getByText('Your result is ready to download')).toBeVisible();
    expect(anonymize).toHaveBeenCalledWith(file, health, expect.any(AbortSignal));
    expect((await screen.findByLabelText('Original text')).textContent).toBe(result.original_text);
    expect((await screen.findByLabelText('Anonymized text')).textContent).toBe(result.anonymized_text);
    for (const label of ['Original text', 'Anonymized text']) {
      let ancestor: HTMLElement | null = screen.getByLabelText(label);
      while (ancestor) {
        expect(ancestor).not.toHaveAttribute('data-state-motion');
        expect(ancestor.style.transform).toBe('');
        expect(ancestor.style.opacity).toBe('');
        ancestor = ancestor.parentElement;
      }
    }
    expect(screen.queryByText('Analyzing your document')).toBeNull();
    expect(screen.getAllByText('Not provided')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Anonymized' }));
    expect(document.querySelector('#document-viewer')?.getAttribute('data-view')).toBe('anonymized');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wrap lines' }));
    expect(document.querySelector('#document-viewer')).toHaveClass('nowrap');
    const create = vi.fn(() => 'blob:http://localhost/test');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Download .txt' }));
    expect(create).toHaveBeenCalledWith(expect.any(Blob)); expect(click).toHaveBeenCalledOnce();
    const toast = await screen.findByText('Download started.');
    expect(toast.closest('#workspace')).toBeNull();
    expect(toast.parentElement).toHaveClass('toast-position');
    expect(toast.parentElement?.parentElement).toBe(document.body);
    const trigger = screen.getByRole('button', { name: 'Clear document and result' });
    trigger.focus(); fireEvent.click(trigger);
    const modal = await screen.findByRole('dialog');
    expect(modal.closest('#workspace')).toBeNull();
    expect(modal.parentElement?.parentElement).toBe(document.body);
    const keep = screen.getByRole('button', { name: 'Keep document' });
    await waitFor(() => expect(keep).toHaveFocus());
    fireEvent.keyDown(keep, { key: 'Tab', shiftKey: true });
    expect(screen.getAllByRole('button', { name: 'Clear document and result' }).at(-1)).toHaveFocus();
    fireEvent.keyDown(modal, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    const backdrop = screen.getByRole('dialog').parentElement;
    if (!backdrop) throw new Error('Backdrop missing');
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
    const clear = screen.getAllByRole('button', { name: 'Clear document and result' }).at(-1);
    if (!clear) throw new Error('Confirmation missing');
    fireEvent.click(clear);
    await screen.findByText('Not started');
    expect(screen.queryByText('authorized.pdf')).toBeNull();
    expect(screen.getByRole('button', { name: 'Download .txt' })).toBeDisabled();
    expect(screen.getByText('Nothing to download yet')).toBeVisible();
  });
  it('keeps the download bar present and unavailable before any result exists', async () => {
    vi.spyOn(api, 'health').mockResolvedValue(health);
    render(<MotionConfig reducedMotion="always"><Workspace /></MotionConfig>);
    await screen.findByText('Engine connected');
    const button = screen.getByRole('button', { name: 'Download .txt' });
    expect(button).toBeDisabled();
    expect(button.closest('.download-row')).not.toBeNull();
    expect(screen.getByText('Nothing to download yet')).toBeVisible();
    expect(screen.getByText('The result appears here when the analysis finishes.')).toBeVisible();
    const create = vi.fn(() => 'blob:http://localhost/test');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(button);
    expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
  });
  it('blocks retries against cached readiness until deferred post-failure health resolves', async () => {
    let resolveHealth: (value: Health) => void = () => {};
    const status = vi.spyOn(api, 'health').mockResolvedValueOnce(health).mockImplementation(() => new Promise(resolve => { resolveHealth = resolve; }));
    const anonymize = vi.spyOn(api, 'anonymize').mockRejectedValue(new DOMException('Timeout', 'AbortError'));
    render(<MotionConfig reducedMotion="always"><Workspace /></MotionConfig>);
    await screen.findByText('Engine connected'); await selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Anonymize document' }));
    await screen.findByText('Unable to complete the analysis');
    expect(status).toHaveBeenCalledTimes(2);
    const retry = screen.getByRole('button', { name: 'Anonymize document' });
    expect(retry).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check connection' })).toBeDisabled();
    expect(screen.getByText('Connecting to the app')).toBeVisible();
    fireEvent.click(retry);
    expect(anonymize).toHaveBeenCalledTimes(1);
    await act(async () => resolveHealth({ ...health, busy: true }));
    expect(retry).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    expect(retry).toBeDisabled();
    await act(async () => resolveHealth(health));
    await waitFor(() => expect(retry).toBeEnabled());
    expect(anonymize).toHaveBeenCalledTimes(1);
  });
  it('shows processing without percentages, rejects failures and refreshes engine status', async () => {
    const status = vi.spyOn(api, 'health').mockResolvedValue(health);
    let rejectOperation: (error: Error) => void = () => {};
    vi.spyOn(api, 'anonymize').mockImplementation(() => new Promise((_resolve, reject) => { rejectOperation = reject; }));
    render(<MotionConfig reducedMotion="always"><Workspace /></MotionConfig>);
    await screen.findByText('Engine connected'); await selectFile();
    fireEvent.click(screen.getByRole('button', { name: 'Anonymize document' }));
    await screen.findByText('Analyzing your document');
    expect(screen.getByRole('button', { name: 'Analysis in progress…' })).toBeDisabled();
    await waitFor(() => expect(screen.getByText('0 s elapsed')).toBeVisible());
    rejectOperation(new Error('Engine busy'));
    await screen.findByText('Unable to complete the analysis');
    await waitFor(() => expect(screen.getByText('Engine busy')).toBeVisible());
    const unavailable = screen.getByRole('button', { name: 'Download .txt' });
    expect(unavailable).toBeDisabled();
    expect(screen.getByText('Nothing to download yet')).toBeVisible();
    const create = vi.fn(() => 'blob:http://localhost/test');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(unavailable);
    expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
  });
});