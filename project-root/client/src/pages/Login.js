import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../data/constants';
import { clearAuthStorage } from '../utils/api';
import { Mail, Lock, Eye, EyeOff, Shield, Terminal, Sun, Moon } from 'lucide-react';
import '../styles/apple-auth.css';

const BgEnvironment = () => null;

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fe, setFe] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [rm, setRm] = useState(true);
  const mouseX = 0;
  const mouseY = 0;



  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Required';
    setFe(e); return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault(); setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      clearAuthStorage();
      const d = await login(form.email, form.password, rm);
      if (d.mfa_required) navigate(`/verify-otp?email=${encodeURIComponent(form.email)}&mfa_token=${encodeURIComponent(d.mfa_token)}&rememberMe=${rm}`);
      else navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.detail || 'Invalid email or password'); }
    finally { setLoading(false); }
  };

  const oauth = (p) => { clearAuthStorage(); window.location.href = `${API_BASE_URL}/api/auth/oauth/${p}`; };

  return (
    <div className="ap">
      <BgEnvironment mouseX={mouseX} mouseY={mouseY} />

      <nav className="ap-nav">
        <Link to="/" className="ap-logo">
          <img src="/logo.png" alt="" onError={e => e.target.style.display='none'} />
          TrustShare
        </Link>
        <div className="ap-nav-r">
          <Link to="/signup" className="ap-nav-a ap-nav-cta">Create Account</Link>
          <div className="ap-nav-divider" />
          <button
            type="button"
            className="ap-theme-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </nav>

      <div className="ap-auth-split-wrapper">
        <div className="ap-auth-inner-split">

          <motion.div
            className="ap-auth-side-narrative"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16,1,0.3,1] }}
          >
            <span className="ap-narrative-eyebrow">Your workspace awaits</span>
            <h1 className="ap-narrative-h1">
              Sign in to your<br /><span className="italic-gradient">secure vault.</span>
            </h1>
            <p className="ap-narrative-p">
              Your files, conversations, and collaboration. Together in one considered workspace, with access on your terms.
            </p>
            <div className="ap-narrative-features">
              {[
                { t: 'AES-256 encrypted file storage', i: Shield },
                { t: 'Permission-based sharing', i: Terminal }
              ].map((f, i) => (
                <div key={i} className="ap-narrative-feat">
                  <div className="ap-narrative-feat-circle"><f.i size={12} /></div>
                  <span>{f.t}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div className="ap-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}>
              <div className="ap-card-head">
                <div className="ap-card-ic"><Lock size={24} /></div>
                <h2 className="ap-card-t">Welcome back</h2>
                <p className="ap-card-s">Sign in to your TrustShare workspace</p>
              </div>

              <form onSubmit={submit}>
                <div className="ap-f"><div className="ap-fi">
                  <span className="ap-ic"><Mail size={16} /></span>
                  <input className="ap-in" type="email" aria-label="Email address" placeholder="Email address" value={form.email} onChange={e => { setForm(f => ({...f, email: e.target.value})); setFe(f => ({...f, email: ''})); }} required />
                </div>{fe.email && <div className="ap-err">{fe.email}</div>}</div>

                <div className="ap-f"><div className="ap-fi">
                  <span className="ap-ic"><Lock size={16} /></span>
                  <input className="ap-in" type={showPw ? 'text' : 'password'} aria-label="Password" placeholder="Password" value={form.password} onChange={e => { setForm(f => ({...f, password: e.target.value})); setFe(f => ({...f, password: ''})); }} required />
                  <button type="button" className="ap-tog" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>{fe.password && <div className="ap-err">{fe.password}</div>}</div>

                <div className="ap-row">
                  <label className="ap-chk"><input type="checkbox" className="ap-chk-b" checked={rm} onChange={e => setRm(e.target.checked)} /><span className="ap-chk-l">Remember me</span></label>
                  <Link to="/forgot-password" className="ap-a">Forgot password?</Link>
                </div>

                {error && <div className="ap-berr">{error}</div>}

                <button className="ap-btn" type="submit" disabled={loading}>
                  {loading ? <><span className="ap-spin" /> Signing in…</> : 'Sign In'}
                </button>
              </form>

              <div className="ap-div">or</div>
              <div className="ap-oauth">
                <button className="ap-oa" onClick={() => oauth('google')}><svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Google</button>
              </div>

              <div className="ap-foot">Don't have an account? <Link to="/signup" className="ap-a">Create account</Link></div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
