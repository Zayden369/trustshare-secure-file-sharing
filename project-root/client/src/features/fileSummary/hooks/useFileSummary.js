import { useCallback, useEffect, useRef, useState } from 'react';
import { fileSummaryAPI } from '../../../utils/api';

const TERMINAL = new Set(['completed', 'failed']);

export default function useFileSummary(fileId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(async (summaryId) => {
    try {
      const { data } = await fileSummaryAPI.get(fileId, summaryId);
      setSummary(data);
      if (!TERMINAL.has(data.status)) timer.current = setTimeout(() => poll(summaryId), 2000);
      else setLoading(false);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to check summary status.');
      setLoading(false);
    }
  }, [fileId]);

  const generate = useCallback(async (options) => {
    stop(); setError(''); setRetryAfter(0); setLoading(true);
    try {
      const { data } = await fileSummaryAPI.create(fileId, options);
      setSummary(data);
      if (!TERMINAL.has(data.status)) timer.current = setTimeout(() => poll(data.id), 800);
      else setLoading(false);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'object' ? detail.message : detail || 'Summary generation failed.');
      setRetryAfter(typeof detail === 'object' ? Number(detail.retry_after) || 0 : 0);
      setLoading(false);
    }
  }, [fileId, poll, stop]);

  const regenerate = useCallback(async () => {
    if (!summary) return;
    stop(); setError(''); setRetryAfter(0); setLoading(true);
    try {
      const { data } = await fileSummaryAPI.regenerate(fileId, summary.id);
      setSummary(data);
      timer.current = setTimeout(() => poll(data.id), 800);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'object' ? detail.message : detail || 'Regeneration failed.');
      setRetryAfter(typeof detail === 'object' ? Number(detail.retry_after) || 0 : 0);
      setLoading(false);
    }
  }, [fileId, poll, stop, summary]);

  const changeOptions = useCallback(() => {
    stop();
    setSummary(null);
    setError('');
    setLoading(false);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const countdown = setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(countdown);
  }, [retryAfter]);

  return { summary, loading, error, retryAfter, generate, regenerate, changeOptions };
}
