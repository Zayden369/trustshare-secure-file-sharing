import BrandMark from '../components/BrandMark';
import PreparationMark from '../components/PreparationMark';
import '../styles/oauth-callback.css';
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import axios from 'axios';
import { API_BASE_URL } from '../data/constants';

export default function OAuthCallback() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  // ── FIX: Prevent double execution in React StrictMode ──────────────────────
  const hasRun = useRef(false);

  useEffect(() => {
    // ── Prevent second execution in React StrictMode ──
    if (hasRun.current) return;
    hasRun.current = true;

    const query = new URLSearchParams(location.search);
    const exchangeCode = query.get('code');

    if (!exchangeCode) {
      setError('OAuth login failed: exchange code was not returned. Please try again.');
      return;
    }

    const finishLogin = async () => {
      try {
        // ── Exchange code for actual tokens via POST ──────────────────────────
        const { data: tokenData } = await axios.post(
          `${API_BASE_URL}/api/auth/oauth/exchange`,
          { code: exchangeCode }
        );

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        if (!accessToken || !refreshToken) {
          throw new Error('Token exchange failed');
        }

        // Store the tokens
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);

        // Fetch the logged-in user profile
        const { data } = await authAPI.me();
        setUser(data);

        navigate('/dashboard', { replace: true });
      } catch (err) {
        // ── Only clear tokens if they were not already successfully stored ──
        const alreadyLoggedIn = !!localStorage.getItem('access_token');
        if (!alreadyLoggedIn) {
          setError('Failed to complete authentication. Please try signing in again.');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        } else {
          // Tokens already stored successfully by first call — just navigate
          authAPI.me().then(({ data }) => {
            setUser(data);
            navigate('/dashboard', { replace: true });
          }).catch(() => {
            setError('Failed to complete authentication. Please try signing in again.');
          });
        }
      }
    };

    finishLogin();
  }, [location, setUser, navigate]);

  return (
    <div className="oauth-stage"><div className="oauth-panel"><div className="oauth-brand"><BrandMark/><span>TrustShare</span></div>
        {error ? (
          <>
            <span className="oauth-error-symbol" aria-hidden="true">!</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Authentication Error
            </h2>
            <p style={{ color: 'var(--rose-500)', fontSize: '.875rem', marginBottom: '24px', lineHeight: 1.6 }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary w-full"
              style={{ padding: '12px', borderRadius: '8px' }}
            >
              Return to Login
            </button>
          </>
        ) : (
          <>
            <PreparationMark/>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Completing login…
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>
              Verifying credentials and setting up your session.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
