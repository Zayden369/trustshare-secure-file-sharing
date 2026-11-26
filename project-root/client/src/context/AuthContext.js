import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, setAuthTokens } from '../utils/api';

const AuthContext = createContext(null);

// FIX ISS-D9: only wipe auth-related keys, preserve theme/settings/etc.
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'user'];

const ASSISTANT_SESSION_KEYS = [
  'trustshare_bubble_conversation_id',
  'trustshare_bubble_open',
];

const clearAuthStorage = () => {
  AUTH_STORAGE_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  
  ASSISTANT_SESSION_KEYS.forEach((k) => {
    sessionStorage.removeItem(k);
  });
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // The backend is the authority; stored profile data never establishes a session.
  useEffect(() => {
    let live = true, version = 0, timer;
    const restore = async () => {
      const requestVersion = ++version;
      setLoading(true); setUser(null);
      const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
      if (!token) {setLoading(false); return;}
      try {
        const {data} = await authAPI.me();
        if (live && requestVersion === version) setUser(data);
      } catch {
        if (live && requestVersion === version) clearAuthStorage();
      } finally {
        if (live && requestVersion === version) setLoading(false);
      }
    };
    const changed = event => {
      // A tab-only session takes precedence over another tab's remembered login.
      if (!AUTH_STORAGE_KEYS.includes(event.key) || sessionStorage.getItem('access_token')) return;
      clearTimeout(timer);
      timer = setTimeout(restore, 30);
    };
    restore();
    window.addEventListener('storage', changed);
    return () => {live=false;version++;clearTimeout(timer);window.removeEventListener('storage', changed);};
  }, []);

  const login = useCallback(async (email, password, rememberMe = true) => {
    const { data } = await authAPI.login(email, password);
    // If MFA is required, we don't store tokens yet (backend won't return access_token/refresh_token)
    if (!data.mfa_required) {
      setAuthTokens(data.access_token, data.refresh_token, rememberMe);
      setUser(data.user);
    } else {
      clearAuthStorage();
      setUser(null);
    }
    return data;
  }, []);

  const register = useCallback(async (name, email, password, verificationToken) => {
    const { data } = await authAPI.signup(name, email, password, verificationToken);
    setAuthTokens(data.access_token, data.refresh_token, true);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch {}
    clearAuthStorage();              // FIX ISS-D9: targeted clear
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx || { user: null, loading: false, login: () => {}, register: () => {}, logout: () => {} };
}
