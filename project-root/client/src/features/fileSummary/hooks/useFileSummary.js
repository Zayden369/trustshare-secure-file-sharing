import { useCallback, useEffect, useRef, useState } from 'react';
import { fileSummaryAPI } from '../../../utils/api';

const TERMINAL = new Set(['completed', 'failed']);
export default function useFileSummary(fileId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [revisions, setRevisions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(null);
  const timer = useRef(null);
  const version = useRef(0);
  const started = useRef(null);
  const stop = useCallback(() => { clearTimeout(timer.current); timer.current = null; }, []);

  const accept = useCallback((data, expected) => {
    if (version.current !== expected) return false;
    setSummary(data);
    if (TERMINAL.has(data.status)) {
      setLoading(false);
      if (started.current !== null) setElapsedMs(performance.now() - started.current);
    }
    return true;
  }, []);

  const poll = useCallback(async (summaryId, expected) => {
    try {
      const { data } = await fileSummaryAPI.get(fileId, summaryId);
      if (!accept(data, expected)) return;
      if (!TERMINAL.has(data.status)) timer.current = setTimeout(() => poll(summaryId, expected), 750);
    } catch (requestError) {
      if (version.current !== expected) return;
      setError(requestError.response?.data?.detail || 'Unable to check summary status. Reopen the summary to reconnect.');
      setLoading(false);
    }
  }, [fileId, accept]);

  useEffect(() => {
    stop(); const expected = ++version.current;
    setSummary(null); setError(''); setRevisions([]); setHistoryOpen(false); setHistoryLoading(false); setHistoryError(''); setElapsedMs(null); setLoading(true);
    started.current = performance.now();
    fileSummaryAPI.latest(fileId).then(({ data }) => {
      if (!accept(data.status === 'completed' ? { ...data, cached: true } : data, expected)) return;
      if (!TERMINAL.has(data.status)) timer.current = setTimeout(() => poll(data.id, expected), 750);
    }).catch(requestError => {
      if (version.current !== expected) return;
      if (requestError.response?.status !== 404) setError('Unable to restore the latest summary. Please retry.');
      setLoading(false);
    });
    return () => { version.current += 1; stop(); };
  }, [fileId, accept, poll, stop]);

  const request = useCallback(async (operation) => {
    stop(); const expected = ++version.current;
    setError(''); setRetryAfter(0); setRevisions([]); setHistoryOpen(false); setHistoryLoading(false); setHistoryError(''); setLoading(true); setElapsedMs(null);
    started.current = performance.now();
    try {
      const { data } = await operation();
      if (!accept(data, expected)) return;
      if (!TERMINAL.has(data.status)) timer.current = setTimeout(() => poll(data.id, expected), 750);
    } catch (requestError) {
      if (version.current !== expected) return;
      const detail = requestError.response?.data?.detail;
      if (requestError.response?.status === 409 && detail?.summary_id) {
        await poll(detail.summary_id, expected);
        return;
      }
      setError(typeof detail === 'object' ? detail.message : detail || 'Summary generation failed.');
      setRetryAfter(typeof detail === 'object' ? Number(detail.retry_after) || 0 : 0);
      setLoading(false);
    }
  }, [accept, poll, stop]);
  const generate = useCallback(options => request(() => fileSummaryAPI.create(fileId, options)), [fileId, request]);
  const regenerate = useCallback(() => summary && request(() => fileSummaryAPI.regenerate(fileId, summary.id)), [fileId, request, summary]);
  const changeOptions = useCallback(() => { stop(); version.current += 1; setSummary(null); setError(''); setLoading(false); setRevisions([]); setHistoryOpen(false); setHistoryLoading(false); setHistoryError(''); }, [stop]);
  const loadRevisions = useCallback(async () => {
    if (!summary) return;
    const expected = version.current;
    setHistoryOpen(true); setHistoryLoading(true); setHistoryError('');
    try {
      const { data } = await fileSummaryAPI.revisions(fileId, summary.id);
      if (version.current === expected) setRevisions(data.revisions || []);
    } catch {
      if (version.current === expected) setHistoryError('Earlier summaries could not be retrieved. Please retry.');
    } finally {
      if (version.current === expected) setHistoryLoading(false);
    }
  }, [fileId, summary]);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const countdown = setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(countdown);
  }, [retryAfter]);
  return { summary, loading, error, retryAfter, generate, regenerate, changeOptions, revisions, loadRevisions, historyOpen, historyLoading, historyError, closeHistory, elapsedMs };
}
