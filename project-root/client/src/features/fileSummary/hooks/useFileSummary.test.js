import { renderHook, act, waitFor } from '@testing-library/react';
import useFileSummary from './useFileSummary';
import { fileSummaryAPI } from '../../../utils/api';
jest.mock('../../../utils/api', () => ({ fileSummaryAPI: { latest: jest.fn(), get: jest.fn(), create: jest.fn(), regenerate: jest.fn(), revisions: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

test('restores a completed summary as cached rather than fresh inference', async () => {
  fileSummaryAPI.latest.mockResolvedValue({ data: { id: 1, status: 'completed', summary_text: 'Existing summary' } });
  const { result } = renderHook(() => useFileSummary(7));
  await waitFor(() => expect(result.current.summary?.cached).toBe(true));
  expect(fileSummaryAPI.create).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
});

test('a late response from a different file cannot replace the current document', async () => {
  let previous;
  fileSummaryAPI.latest.mockImplementationOnce(() => new Promise(resolve => { previous = resolve; }));
  fileSummaryAPI.latest.mockResolvedValueOnce({ data: { id: 2, status: 'completed', summary_text: 'Current file' } });
  const { result, rerender } = renderHook(({ id }) => useFileSummary(id), { initialProps: { id: 7 } });
  rerender({ id: 8 });
  await waitFor(() => expect(result.current.summary?.id).toBe(2));
  await act(async () => { previous({ data: { id: 1, status: 'completed', summary_text: 'Old file' } }); });
  expect(result.current.summary.summary_text).toBe('Current file');
});

test('duplicate generation reconnects to the existing job', async () => {
  fileSummaryAPI.latest.mockRejectedValue({ response: { status: 404 } });
  fileSummaryAPI.create.mockRejectedValue({ response: { status: 409, data: { detail: { summary_id: 9, message: 'Already generating' } } } });
  fileSummaryAPI.get.mockResolvedValue({ data: { id: 9, status: 'completed', summary_text: 'Recovered result' } });
  const { result } = renderHook(() => useFileSummary(7));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.generate({ summary_length: 'short' }); });
  expect(result.current.summary.id).toBe(9);
  expect(result.current.error).toBe('');
  expect(fileSummaryAPI.get).toHaveBeenCalledWith(7, 9);
});
