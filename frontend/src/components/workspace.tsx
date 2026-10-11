import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, ShieldCheck, ArrowRight, Download, X } from 'lucide-react';
import { api, backendConfigured, type AnalysisResult, type Health } from '@/lib/api';
import { readDownload, textParts, validatePdf, validateSelection } from '@/lib/result-utils';
import { buildReview, renderReview, resetWords, reviewedFilename, toggleWord, type Rendered, type Word } from '@/lib/review';
import { XFileButton } from './xfile-button';

function RenderText({ text, result, side }: { text: string; result: AnalysisResult; side: 'original' | 'anonymized' }) {
  return textParts(text, result.spans, side).map((part, i) => part.marked ? <mark key={i} title={part.category}>{part.text}</mark> : part.text);
}

/** Every word is a toggle: masked words are highlighted, manual changes are outlined. */
function ReviewText({ text, words, onToggle }: { text: string; words: Word[]; onToggle: (index: number) => void }) {
  const parts: ReactNode[] = [];
  const pattern = /\S+/g;
  let last = 0;
  let index = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const i = index++;
    const word = words[i];
    if (word) {
      const changed = word.masked !== word.engineMasked;
      const hint = word.masked ? `Masked${word.category ? ` · ${word.category}` : ''}${changed ? ' by you' : ''}. Click to unmask.` : `${changed ? 'Unmasked by you. ' : ''}Click to mask.`;
      parts.push(<button key={i} type="button" className={`word${changed ? ' manual' : ''}`} aria-pressed={word.masked} title={hint} onClick={() => onToggle(i)}>{word.masked ? <mark>{match[0]}</mark> : match[0]}</button>);
    } else parts.push(match[0]);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function ResultView({ result, words, rendered, onToggle, onReset, onClear }: { result: AnalysisResult; words: Word[] | null; rendered: Rendered | null; onToggle: (index: number) => void; onReset: () => void; onClear: () => void }) {
  const [view, setView] = useState('both');
  const [wrap, setWrap] = useState(true);
  const summary = rendered?.summary ?? result.summary;
  const changes = rendered?.changes ?? 0;
  const metrics = [
    ['Masked passages', summary.masked_spans], ['Words replaced', summary.substitutions],
    ['Reported categories', summary.categories?.length], ['Engine time', result.processing_ms == null ? null : `${(result.processing_ms / 1000).toFixed(1)} s`],
  ];
  return <div id="result-content">
    <div className="metrics" aria-label="Analysis summary from the engine">{metrics.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong className={value == null ? 'unavailable' : ''}>{value ?? 'Not provided'}</strong></div>)}</div>
    <div className="category-tags">{summary.categories?.map((c, i) => <span key={i}>{c}</span>)}</div>
    {words && <p className="annotation-note review-note">Click any word to mask or unmask it. Highlights, counts and the download update with your changes.</p>}
    {changes > 0 && <div className="review-bar" role="status"><span>{changes} {changes === 1 ? 'change' : 'changes'} made by you</span><XFileButton className="subtle-button" onClick={onReset}>Reset to engine result</XFileButton></div>}
    <p className="annotation-note">{result.spans == null ? 'The engine did not provide change positions. The complete text is shown without inferred highlights or counts.' : result.spans.length === 0 ? 'The engine reported zero masked passages. This does not guarantee that the document contains no personal data.' : `Highlights match the positions reported by the engine.${result.summary.categories_complete ? '' : ' Some categories were not provided.'}`}</p>
    <div className="viewer-toolbar"><div className="view-switch" role="group" aria-label="Document view">{([['both', 'Side by side'], ['original', 'Original'], ['anonymized', 'Anonymized']] as const).map(([v, label]) => <XFileButton className="view-button" key={v} aria-pressed={view === v} onClick={() => setView(v)}>{label}</XFileButton>)}</div><label className="wrap-toggle"><input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} />Wrap lines</label></div>
    <div id="document-viewer" className={`document-viewer${wrap ? '' : ' nowrap'}`} data-view={view}>
      <section id="original-pane" className="document-pane"><div className="document-label"><span>ORIGINAL</span><span>{result.page_count == null ? 'Pages not provided' : `${result.page_count} ${result.page_count === 1 ? 'page' : 'pages'}`}</span></div><pre tabIndex={0} aria-label="Original text">{words ? <ReviewText text={result.original_text} words={words} onToggle={onToggle} /> : <RenderText text={result.original_text} result={result} side="original" />}</pre></section>
      <section id="anonymized-pane" className="document-pane"><div className="document-label"><span>ANONYMIZED</span><span>TXT · UTF-8</span></div><pre tabIndex={0} aria-label="Anonymized text">{words && rendered ? <ReviewText text={rendered.text} words={words} onToggle={onToggle} /> : <RenderText text={result.anonymized_text} result={result} side="anonymized" />}</pre></section>
    </div>
    <XFileButton className="subtle-button" onClick={onClear}>Clear document and result</XFileButton>
  </div>;
}

export function Workspace() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<'empty' | 'processing' | 'error' | 'success'>('empty');
  const [operationError, setOperationError] = useState('');
  const [completed, setCompleted] = useState<{ result: AnalysisResult; bytes: Uint8Array<ArrayBuffer> } | null>(null);
  const [words, setWords] = useState<Word[] | null>(null);
  const rendered = useMemo(() => (completed && words ? renderReview(completed.result, words) : null), [completed, words]);
  const changes = rendered?.changes ?? 0;
  const [elapsed, setElapsed] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [mounted, setMounted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const selectionId = useRef(0);
  const healthId = useRef(0);
  const healthController = useRef<AbortController | null>(null);
  const operationController = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  useEffect(() => () => { if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); }, []);
  const download = () => {
    if (!completed) return;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    // Without manual changes: the exact verified engine bytes. With changes: the reviewed text.
    const bytes = rendered && changes > 0 ? new TextEncoder().encode(rendered.text) : completed.bytes;
    const name = changes > 0 ? reviewedFilename(completed.result.download.filename) : completed.result.download.filename;
    downloadUrl.current = URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = downloadUrl.current;
    link.download = name.replace(/[/\\\x00-\x1f]/g, '_') || 'anonymized-document.txt';
    document.body.append(link); link.click(); link.remove(); setToast('Download started.');
  };
  const busy = phase === 'processing';
  const reduced = useReducedMotion();
  const ready = !checking && health?.engine_ready && !health.busy;
  const limit = Math.min(health?.max_file_bytes ?? 10485760, 10485760);
  const refreshHealth = useCallback(async () => {
    if (!backendConfigured) { setHealth(null); return; }
    const id = ++healthId.current;
    healthController.current?.abort();
    healthController.current = new AbortController();
    setChecking(true);
    try { const h = await api.health(healthController.current.signal); if (id === healthId.current) { setHealth(h); setConnectionError(false); } }
    catch { if (id === healthId.current) { setHealth(null); setConnectionError(true); } }
    finally { if (id === healthId.current) setChecking(false); }
  }, []);
  useEffect(() => {
    setMounted(true);
    void refreshHealth();
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent); window.addEventListener('drop', prevent);
    return () => { ++healthId.current; ++selectionId.current; healthController.current?.abort(); operationController.current?.abort(); window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, [refreshHealth]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now(); setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', warn); };
  }, [busy]);
  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement;
    const timer = setTimeout(() => dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(), 0);
    return () => { clearTimeout(timer); if (previous instanceof HTMLElement) previous.focus(); };
  }, [confirm]);
  const clear = () => {
    ++selectionId.current; setFile(null); setFileError(''); setCompleted(null); setWords(null); setPhase('empty'); setOperationError('');
    if (input.current) input.current.value = '';
  };
  const select = async (selected: File) => {
    if (busy) return;
    clear(); const id = ++selectionId.current;
    const error = await validatePdf(selected, limit);
    if (id !== selectionId.current) return;
    if (error) { setFileError(error); if (input.current) input.current.value = ''; }
    else setFile(selected);
  };
  const analyze = async () => {
    if (!file || !health || !ready || busy) return;
    const error = validateSelection(file, limit);
    if (error) { setFileError(error); return; }
    setCompleted(null); setWords(null); setPhase('processing'); setOperationError('');
    operationController.current = new AbortController();
    try { const payload = await api.anonymize(file, health, operationController.current.signal); const validated = await readDownload(payload); setCompleted(validated); setWords(buildReview(validated.result)); setPhase('success'); }
    catch (error) {
      setCompleted(null); setWords(null); setPhase('error');
      setOperationError(error instanceof Error && error.name === 'AbortError' ? 'The request timed out. The engine may still be processing it. Check its status before trying again.' : error instanceof TypeError ? 'The server connection was interrupted. Your request may still be finishing.' : error instanceof Error ? error.message : 'The analysis could not be completed.');
    } finally { operationController.current = null; void refreshHealth(); }
  };
  const statusLabel = !backendConfigured ? 'Backend pending connection' : checking ? 'Connecting to the app' : connectionError ? 'Server disconnected' : ready ? 'Engine connected' : health?.busy ? 'Engine busy' : 'Engine not connected';
  const availabilityTitle = !backendConfigured ? 'Interface ready. Backend pending connection.' : checking ? 'Checking the connection' : connectionError ? 'The app is not connected to the backend' : ready ? 'Ready to analyze' : health?.busy ? 'An analysis is already in progress' : 'Interface ready. Engine in development.';
  const availabilityMessage = !backendConfigured ? 'You can select a PDF. Analysis will be enabled when the team’s Python engine is integrated. Documents cannot be anonymized yet.' : checking ? 'The engine status will be checked before you send your document.' : connectionError ? 'Start the Python server and check the connection again. Your file will not be sent while the connection is unavailable.' : ready ? 'The app is connected to the team’s engine. Select an authorized document and review the result before using it.' : health?.busy ? 'Wait for the current request to finish before sending another document.' : health?.engine_status === 'configuration_error' ? 'The engine connection could not be loaded. Check the server configuration. No simulated results will be generated.' : 'You can select a PDF. Analysis will be enabled when the team’s Python engine is integrated. Documents cannot be anonymized yet.';
  const hint = busy ? 'Your request has been sent. Waiting for the result.' : !backendConfigured ? 'Waiting for the backend to connect.' : checking ? 'Waiting for a fresh engine status before analysis.' : !health ? 'Start the Python server to get started.' : !health.engine_ready ? 'Analysis will be available once the engine is connected.' : health.busy ? 'The engine is still busy. Check the connection again shortly.' : !file ? 'Select a PDF to continue.' : 'All set. Your PDF will be sent when you start the analysis.';
  const entrance = { initial: reduced ? false as const : { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: reduced ? 0 : -8 }, transition: { duration: reduced ? 0 : .18 } };
  let content: ReactNode;
  if (phase === 'processing') content = <div className="processing" role="status"><motion.span className="spinner" aria-hidden="true" animate={reduced ? {} : { rotate: 360 }} transition={{ duration: .8, ease: 'linear', repeat: Infinity }} /><h4>Analyzing your document</h4><p>The engine is identifying sensitive data and preparing your result.</p><span>{elapsed} s elapsed</span><small>Keep this page open. Processing time depends on the document.</small></div>;
  else if (phase === 'error') content = <div className="operation-error" role="alert"><span aria-hidden="true">!</span><h4>Unable to complete the analysis</h4><p>{operationError}</p><small>No result or download was created.</small></div>;
  else content = <div className="empty-result"><div className="empty-documents" aria-hidden="true"><div><i /><i /><i /></div><span>→</span><div><i /><b>* * *</b><i /></div></div><h4>Keep what gives it meaning.</h4><p>After analysis, compare the original text with the result and download your anonymized document.</p><span className="empty-caption">NO PRELOADED RESULTS</span></div>;
  return <section id="workspace" className="workspace" aria-labelledby="workspace-title">
    <div className="workspace-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="workspace-title">Your document. Handled with care.</h2></div><div className="connection"><span className={`status-pill ${ready ? 'ready' : connectionError ? 'offline' : 'waiting'}`} role="status"><i /><AnimatePresence mode="popLayout" initial={false}><motion.span key={statusLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}>{statusLabel}</motion.span></AnimatePresence></span><XFileButton className="icon-button" title="Check connection" aria-label="Check connection" onClick={() => { void refreshHealth(); if (!backendConfigured) setToast('Backend pending connection. No document was sent.'); }} disabled={busy || checking}><RefreshCw /></XFileButton></div></div>
    <div className={`notice${ready ? ' ready' : ''}`} role="status"><span className="notice-icon" aria-hidden="true">i</span><div><strong>{availabilityTitle}</strong><p>{availabilityMessage}</p></div></div>
    <div className="work-grid">
      <section className="upload-panel" aria-labelledby="upload-title">
        <div className="panel-header"><span className="step-number">01</span><h3 id="upload-title">Select a document</h3><span className="file-type">PDF</span></div>
        <label className={`drop-zone${dragging ? ' dragging' : ''}${busy ? ' disabled' : ''}`} htmlFor="pdf-file" onDragEnter={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (busy) return; if (e.dataTransfer.files.length !== 1) { clear(); setFileError('Select one PDF at a time.'); } else { const selected = e.dataTransfer.files[0]; if (selected) void select(selected); } }}><svg className="upload-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M15 7h14l8 8v26H11V7h4Zm14 0v9h8M24 33V22m-5 5 5-5 5 5" /></svg><strong>Drop your PDF here</strong><span>or <u>choose a file</u></span><small id="upload-limit">Up to {Math.round(limit / 1048576)} MB · {health ? health.max_pages == null ? 'Page limit not provided' : `${health.max_pages} pages` : '40 pages'}</small><input ref={input} id="pdf-file" type="file" accept=".pdf,application/pdf" disabled={busy} aria-describedby="upload-limit file-error" onChange={e => { const selected = e.target.files?.[0]; if (selected) void select(selected); }} /></label>
        {file && <motion.div className="selected-file" initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={reduced ? { duration: 0 } : { duration: .18 }}><div className="file-badge" aria-hidden="true">PDF</div><div className="file-info"><strong title={file.name}>{file.name}</strong><span>{file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(2)} MB`}</span></div><XFileButton className="icon-button" aria-label="Remove selected file" disabled={busy} onClick={clear}><X /></XFileButton></motion.div>}
        <p id="file-error" className="error-message" role="alert" hidden={!fileError}>{fileError}</p>
        <div className="privacy-note"><ShieldCheck /><p>Your file is only sent when you start the analysis. This interface does not store documents on the server.</p></div>
        <XFileButton className="primary-button" disabled={busy || !ready || !file} onClick={() => void analyze()}><span>{busy ? 'Analysis in progress…' : 'Anonymize document'}</span><ArrowRight /></XFileButton>
        <p className="action-hint">{hint}</p><p className="privacy-footnote">Do not use real personal documents in a public demo. The provider’s terms apply to the team’s engine.</p>
      </section>
      <section className="result-panel" aria-labelledby="results-title" aria-busy={busy}>
        <div className="panel-header"><span className="step-number">02</span><h3 id="results-title">Review the result</h3><span className="result-state">{phase === 'empty' ? 'Not started' : phase === 'processing' ? 'Analyzing' : phase === 'success' ? 'Completed' : 'Not completed'}</span></div>
        {phase === 'success' && completed ? <ResultView result={completed.result} words={words} rendered={rendered} onToggle={i => setWords(w => (w ? toggleWord(w, i) : w))} onReset={() => setWords(w => (w ? resetWords(w) : w))} onClear={() => setConfirm(true)} /> : <AnimatePresence mode="wait" initial={false}><motion.div key={phase} data-state-motion {...entrance}>{content}</motion.div></AnimatePresence>}
        <div className="download-row"><div><strong>{!completed ? 'Nothing to download yet' : changes > 0 ? 'Your reviewed result is ready to download' : 'Your result is ready to download'}</strong><p>{!completed ? 'The result appears here when the analysis finishes.' : changes > 0 ? `Includes ${changes} ${changes === 1 ? 'change' : 'changes'} you made. The engine output itself is not modified.` : 'The exact engine output, unchanged by the interface.'}</p></div><XFileButton className="primary-button" disabled={!completed} onClick={download}><Download />Download .txt</XFileButton></div>
      </section>
    </div>
    {mounted && createPortal(<><AnimatePresence>{confirm && <motion.div className="confirm-overlay" {...entrance} onClick={e => { if (e.target === e.currentTarget) setConfirm(false); }}><div ref={dialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-title" onKeyDown={e => { if (e.key === 'Escape') setConfirm(false); if (e.key === 'Tab') { const buttons = dialog.current?.querySelectorAll('button'); const first = buttons?.[0]; const last = buttons?.[buttons.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}><h3 id="clear-title">Clear document and result?</h3><p>This removes the selected PDF and result from this page. Download your result first if you want to keep it.</p><div className="confirm-actions"><XFileButton className="subtle-button" onClick={() => setConfirm(false)}>Keep document</XFileButton><XFileButton className="primary-button" onClick={() => { clear(); setConfirm(false); setToast('Document and result cleared from this page.'); }}>Clear document and result</XFileButton></div></div></motion.div>}</AnimatePresence>
    <div className="toast-position"><AnimatePresence>{toast && <motion.div id="toast" className="visible" role="status" aria-live="polite" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>{toast}</motion.div>}</AnimatePresence></div></>, document.body)}
  </section>;
}
