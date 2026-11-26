import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileSummaryPanel from './FileSummaryPanel';
import useFileSummary from '../hooks/useFileSummary';

jest.mock('../hooks/useFileSummary');

test('shows accessible generation options and submits them', () => {
  const generate = jest.fn();
  useFileSummary.mockReturnValue({ summary: null, loading: false, error: '', generate, regenerate: jest.fn() });
  render(<FileSummaryPanel file={{ id: 7, original_name: 'report.pdf' }} onClose={jest.fn()} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate summary' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Summary length'), { target: { value: 'detailed' } });
  fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'bullet_points' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate summary' }));
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({
    summary_length: 'detailed', output_format: 'bullet_points', output_language: 'original',
  }));
  expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
});

test('renders completed summary, key points and copy action', async () => {
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
  useFileSummary.mockReturnValue({
    loading: false, error: '', generate: jest.fn(), regenerate: jest.fn(),
    summary: { id: 1, status: 'completed', title: 'Report', summary_text: 'Safe summary.', key_points: ['First point'], keywords: ['security'], provider: 'ollama', source_file_version: 2, updated_at: '2026-07-28T00:00:00Z' },
  });
  render(<FileSummaryPanel file={{ id: 7, original_name: 'report.pdf' }} onClose={jest.fn()} />);
  expect(screen.getByText('Safe summary.')).toBeInTheDocument();
  expect(screen.getByText('First point')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy summary' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});

test('shows the live retry countdown and disables retry until it expires', () => {
  useFileSummary.mockReturnValue({
    summary: null, loading: false, error: 'Too many summary requests.', retryAfter: 26,
    generate: jest.fn(), regenerate: jest.fn(),
  });
  render(<FileSummaryPanel file={{ id: 7, original_name: 'report.pdf' }} onClose={jest.fn()} />);
  expect(screen.getByText('Too many summary requests. Please try again in 26 seconds.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again in 26s' })).toBeDisabled();
});

test('shows cached provider and offers a way to change summary options', () => {
  const changeOptions = jest.fn();
  useFileSummary.mockReturnValue({
    loading: false, error: '', generate: jest.fn(), regenerate: jest.fn(), changeOptions,
    summary: { id: 2, status: 'completed', cached: true, provider: 'extractive_fallback',
      summary_length: 'short', output_format: 'bullet_points', title: 'Report', summary_text: '- A fact',
      key_points: [], keywords: [], source_file_version: 1, updated_at: '2026-11-26T00:00:00Z' },
  });
  render(<FileSummaryPanel file={{ id: 7, original_name: 'report.pdf' }} onClose={jest.fn()} />);
  expect(screen.getByText('Cached · extractive_fallback')).toBeInTheDocument();
  expect(screen.getByText('short · Bullet points')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Summary' })).toHaveTextContent('A fact');
  expect(screen.queryByRole('heading', { name: 'Key points' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Change options' }));
  expect(changeOptions).toHaveBeenCalledTimes(1);
});
