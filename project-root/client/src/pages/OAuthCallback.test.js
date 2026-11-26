import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import axios from 'axios';
import OAuthCallback from './OAuthCallback';
import { authAPI } from '../utils/api';

const mockNavigate = jest.fn();
const mockSetUser = jest.fn();
jest.mock('axios');
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '?code=one-use-code' }),
}));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ setUser: mockSetUser }) }));
jest.mock('../utils/api', () => ({
  authAPI: { me: jest.fn() },
  clearAuthStorage: () => { global.localStorage.clear(); global.sessionStorage.clear(); },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

test('OAuth MFA routes to verification without saving session tokens', async () => {
  axios.post.mockResolvedValue({ data: { mfa_required: true, mfa_token: 'pending', email: 'user@example.net' } });
  render(<OAuthCallback />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  const url = new URL(mockNavigate.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/verify-otp');
  expect(url.searchParams.get('mfa_token')).toBe('pending');
  expect(url.searchParams.get('email')).toBe('user@example.net');
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(authAPI.me).not.toHaveBeenCalled();
});

test('OAuth without MFA retains normal login', async () => {
  axios.post.mockResolvedValue({ data: { access_token: 'access', refresh_token: 'refresh' } });
  authAPI.me.mockResolvedValue({ data: { id: 1 } });
  render(<OAuthCallback />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  expect(localStorage.getItem('access_token')).toBe('access');
});

test('SMTP rejection is displayed and old tokens cannot bypass MFA', async () => {
  localStorage.setItem('access_token', 'old');
  axios.post.mockRejectedValue({ response: { data: { detail: 'Could not send verification email' } } });
  render(<OAuthCallback />);
  await screen.findByText('Could not send verification email');
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(authAPI.me).not.toHaveBeenCalled();
});

test('Incomplete MFA challenges fail closed', async () => {
  axios.post.mockResolvedValue({ data: { mfa_required: true } });
  render(<OAuthCallback />);
  await screen.findByText('Failed to complete authentication. Please try signing in again.');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(authAPI.me).not.toHaveBeenCalled();
});
