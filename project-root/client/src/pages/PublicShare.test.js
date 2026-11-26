import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PublicShare from './PublicShare';
import { sharesAPI } from '../utils/api';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ token: 'public-token' }),
}));

jest.mock('../utils/api', () => ({
  sharesAPI: {
    publicDetails: jest.fn(),
    publicContent: jest.fn(),
  },
}));

const shareDetails = {
  token: 'public-token',
  file_name: 'Roadmap.pdf',
  mimetype: 'application/pdf',
  size: 2048,
  permission: 'view',
  expires_at: null,
  access_count: 0,
  max_views: 3,
  password_required: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  sharesAPI.publicDetails.mockResolvedValue({ data: shareDetails });
});

test('loads and renders safe public share metadata without authentication', async () => {
  render(<PublicShare />);

  expect(await screen.findByText('Roadmap.pdf')).toBeInTheDocument();
  expect(screen.getByText(/2.0 KB/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Open Secure Preview/i })).toBeInTheDocument();
  expect(sharesAPI.publicDetails).toHaveBeenCalledWith('public-token', undefined);
});

test('prompts for and submits a password when the share is protected', async () => {
  sharesAPI.publicDetails
    .mockRejectedValueOnce({ response: { status: 401 } })
    .mockResolvedValueOnce({ data: { ...shareDetails, password_required: true } });
  render(<PublicShare />);

  const passwordInput = await screen.findByLabelText('Passphrase');
  userEvent.type(passwordInput, 'safe-pass');
  userEvent.click(screen.getByRole('button', { name: 'Unlock shared file' }));

  await waitFor(() => expect(sharesAPI.publicDetails).toHaveBeenLastCalledWith('public-token', 'safe-pass'));
  expect(await screen.findByText('Roadmap.pdf')).toBeInTheDocument();
});

test('requests content only after the visitor chooses to open the file', async () => {
  const createObjectURL = jest.fn(() => 'blob:public-share');
  const revokeObjectURL = jest.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  sharesAPI.publicContent.mockResolvedValue({ data: new Blob(['document']) });
  render(<PublicShare />);

  userEvent.click(await screen.findByRole('button', { name: /Open Secure Preview/i }));

  await waitFor(() => expect(sharesAPI.publicContent).toHaveBeenCalledWith('public-token', undefined));
});
