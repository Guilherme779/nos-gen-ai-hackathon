/** Browser-only public client. No backend or credentials are implemented here. */
export interface Health {
  engine_ready: boolean;
  engine_status: string;
  busy: boolean;
  max_file_bytes: number;
  max_pages: number | null;
  timeout_seconds: number;
}
export interface Span {
  original_start: number; original_end: number;
  result_start: number; result_end: number;
  category?: string; word_count?: number;
}
export interface AnalysisResult {
  original_text: string;
  anonymized_text: string;
  status: 'completed';
  page_count: number | null;
  processing_ms: number | null;
  spans?: Span[] | null;
  summary: {
    masked_spans: number | null;
    substitutions: number | null;
    categories: string[] | null;
    categories_complete: boolean;
  };
  download: { filename: string; encoding: 'utf-8'; byte_length: number; sha256: string; base64: string };
}

export const API_BASE_URL = (import.meta.env['VITE_API_BASE_URL'] ?? '').trim().replace(/\/+$/, '');
export const backendConfigured = Boolean(API_BASE_URL);

export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = (path: string) => {
    if (!base) throw new Error('Backend pending connection. No document was sent.');
    const parsed = new URL(base);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The backend URL must use HTTP or HTTPS.');
    return `${base}${path}`;
  };
  return {
    async health(signal?: AbortSignal): Promise<Health> {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) controller.abort();
      const timeout = setTimeout(abort, 6000);
      try {
        const response = await fetcher(endpoint('/api/health'), { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('The app is not connected to the backend.');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') throw new Error('The engine returned an invalid status.');
        const h = data as Partial<Health>;
        if (typeof h.engine_ready !== 'boolean' || typeof h.busy !== 'boolean' ||
            typeof h.engine_status !== 'string' || !Number.isInteger(h.max_file_bytes) ||
            typeof h.max_file_bytes !== 'number' || h.max_file_bytes <= 0 ||
            typeof h.timeout_seconds !== 'number' || !Number.isFinite(h.timeout_seconds) || h.timeout_seconds <= 0 ||
            (h.max_pages !== null && (typeof h.max_pages !== 'number' || !Number.isInteger(h.max_pages) || h.max_pages <= 0))) {
          throw new Error('The engine returned an invalid status.');
        }
        return data as Health;
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
    },
    async anonymize(file: File, health: Health, signal?: AbortSignal): Promise<unknown> {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) controller.abort();
      const timeout = setTimeout(abort, (health.timeout_seconds + 20) * 1000);
      try {
        const response = await fetcher(endpoint('/api/anonymize'), {
          method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
          body: file, cache: 'no-store', signal: controller.signal,
        });
        let payload;
        try { payload = await response.json(); }
        catch { throw new Error('The server returned an invalid response.'); }
        if (!response.ok) throw new Error(typeof payload?.error?.message === 'string' ? payload.error.message : 'The analysis could not be completed.');
        return payload;
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
    },
  };
}
export const api = createApiClient(API_BASE_URL);