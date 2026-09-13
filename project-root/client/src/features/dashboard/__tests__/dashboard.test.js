import React, { act } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import DashboardFeature from '../Dashboard';
import { useAuth } from '../../../context/AuthContext';
import { fetchDashboardData } from '../services/dashboardService';

const mockNavigate = jest.fn();

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../services/dashboardService', () => ({
  fetchDashboardData: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const dashboardData = {
  analytics: {
    total_files: 7,
    encrypted_files: 7,
    total_downloads: 9,
    total_share_links: 3,
    active_share_links: 2,
    total_share_views: 12,
    total_notifications: 2,
    unread_notifications: 1,
    storage: {
      used_bytes: 1500000000,
      quota_bytes: 5000000000,
      used_gb: 1.5,
      quota_gb: 5,
      percent: 30,
    },
    upload_trend: [
      { date: 'Mon', count: 0 },
      { date: 'Tue', count: 2 },
    ],
    top_file_types: { pdf: 2, png: 1 },
  },
  files: [
    {
      id: 1,
      original_name: 'quarterly-report.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      encrypted: true,
      created_at: '2026-08-01T10:30:00Z',
    },
  ],
  notifications: [
    {
      id: 1,
      title: 'File shared',
      message: 'A new secure share is available.',
      is_read: false,
      created_at: '2026-08-01T10:30:00Z',
    },
  ],
};

function renderDashboard() {
  return render(<DashboardFeature />);
}

describe('DashboardFeature', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { name: 'Abhishek Gupta', mfa_enabled: false },
    });
    mockNavigate.mockClear();
    fetchDashboardData.mockReset();
  });

  test('shows an accessible loading state while dashboard data is pending', () => {
    fetchDashboardData.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
  });

  test('renders dashboard statistics, storage, and the complete encrypted-file total', async () => {
    fetchDashboardData.mockResolvedValue(dashboardData);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Total files')).toBeInTheDocument());
    expect(screen.getAllByText('Active links').length).toBeGreaterThan(0);
    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('Downloads').closest('article')).toHaveTextContent('9');
    expect(screen.getByText('Unread alerts')).toBeInTheDocument();
    expect(screen.getByText('1.5 GB used')).toBeInTheDocument();
    expect(screen.getByLabelText('30% storage used')).toBeInTheDocument();

    const securityPanel = screen.getByText('Encrypted files').closest('section');
    expect(securityPanel).toHaveTextContent('7');
  });

  test('renders recent files, metadata, encryption status, and notifications', async () => {
    fetchDashboardData.mockResolvedValue(dashboardData);

    renderDashboard();

    expect(await screen.findByText('quarterly-report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText('Encrypted')).toBeInTheDocument();
    expect(screen.getByText('File shared')).toBeInTheDocument();
    expect(screen.getByText('A new secure share is available.')).toBeInTheDocument();
  });

  test('shows the API error and retries into a successful dashboard render', async () => {
    fetchDashboardData
      .mockRejectedValueOnce(new Error('Dashboard service is unavailable'))
      .mockResolvedValueOnce(dashboardData);

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard service is unavailable');
    await act(async () => {
      userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => expect(fetchDashboardData).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Total files')).toBeInTheDocument();
  });

  test('renders empty states without crashing for a valid empty dashboard', async () => {
    fetchDashboardData.mockResolvedValue({
      analytics: {
        ...dashboardData.analytics,
        total_files: 0,
        encrypted_files: 0,
        total_share_links: 0,
        active_share_links: 0,
        total_share_views: 0,
        total_notifications: 0,
        unread_notifications: 0,
        upload_trend: [],
        top_file_types: {},
      },
      files: [],
      notifications: [],
    });

    renderDashboard();

    expect(await screen.findByText('No files have been uploaded yet.')).toBeInTheDocument();
    expect(screen.getByText('No file-type data available.')).toBeInTheDocument();
    expect(screen.getByText('No notifications available.')).toBeInTheDocument();
  });

  test('routes all dashboard quick actions to their current destinations', async () => {
    fetchDashboardData.mockResolvedValue(dashboardData);

    renderDashboard();
    await screen.findByText('Quick actions');
    const quickActions = screen.getByText('Quick actions').closest('section');

    userEvent.click(within(quickActions).getByRole('button', { name: 'Upload file' }));
    userEvent.click(within(quickActions).getByRole('button', { name: 'Browse files' }));
    userEvent.click(within(quickActions).getByRole('button', { name: 'Create share' }));
    userEvent.click(within(quickActions).getByRole('button', { name: 'Security' }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/my-files');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/my-files');
    expect(mockNavigate).toHaveBeenNthCalledWith(3, '/sharing');
    expect(mockNavigate).toHaveBeenNthCalledWith(4, '/settings?tab=security');
    expect(mockNavigate).not.toHaveBeenCalledWith('/admin');
  });

  test('limits recent file rendering to six items while preserving aggregate metrics', async () => {
    const files = Array.from({ length: 7 }, (_, index) => ({
      ...dashboardData.files[0],
      id: index + 1,
      original_name: `file-${index + 1}.pdf`,
    }));
    fetchDashboardData.mockResolvedValue({ ...dashboardData, files });

    renderDashboard();

    expect(await screen.findByText('file-1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file-6.pdf')).toBeInTheDocument();
    expect(screen.queryByText('file-7.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Encrypted files').closest('section')).toHaveTextContent('7');
  });
});
