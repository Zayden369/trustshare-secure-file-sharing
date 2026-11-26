import BrandMark from '../components/BrandMark';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../utils/api';
import { Shield, Clock, RotateCcw, ShieldCheck, Mail, Sun, Moon } from 'lucide-react';
import '../styles/apple-auth.css';
import AuthArtwork from '../components/AuthArtwork';

export default function VerifyOtp() {
  const { setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cd, setCd] = useState(60);
  const q = new URLSearchParams(location.search);
  const email = q.get('email') || '';
  const mfaToken = q.get('mfa_token') || '';
  const rm = q.get('rememberMe') || 'true';
  const ref = useRef(null);



  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  useEffect(() => { if (cd <= 0) return; const t = setInterval(() => setCd(x => x - 1), 1000); return () => clearInterval(t); }, [cd]);

  const change = (e, i) => {
    const v = e.target.value;
    if (/[^0-9]/.test(v)) return;
    const n = [...otp]; n[i] = v; setOtp(n);
    if (v && i < 5) { const nx = document.getElementById(`o-${i + 1}`); if (nx) nx.focus(); }
  };

  const kd = (e, i) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      const p = document.getElementById(`o-${i - 1}`);
      if (p) p.focus();
    }
  };

  const paste = (e) => {
    e.preventDefault();
    const d = e.clipboardData.getData('text').trim().slice(0, 6);
    if (!/^\d+$/.test(d)) return;
    const n = [...otp];
    for (let j = 0; j < d.length; j++) n[j] = d[j];
    setOtp(n);
  };

  const submit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits of the code.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authAPI.verifyOTP(mfaToken, code);
      const st = rm === 'true' ? localStorage : sessionStorage;
      st.setItem('access_token', data.access_token);
      st.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setCd(60);
    setOtp(['', '', '', '', '', '']);
    try { await authAPI.resendOTP(mfaToken); } catch {}
  };

  return (
    <div className="ap">

      <nav className="ap-nav">
        <Link to="/login" className="ap-logo">
          <BrandMark/>
          TrustShare
        </Link>
        <div className="ap-nav-r">
          <Link to="/login" className="ap-nav-a">Back to Login</Link>
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

          {/* LEFT NARRATIVE PANEL */}
          <motion.div
            className="ap-auth-side-narrative"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <AuthArtwork/>
            <span className="ap-narrative-eyebrow">One more step</span>
            <h1 className="ap-narrative-h1">
              One more step.<br /><span className="italic-gradient">Back to your files.</span>
            </h1>
            <p className="ap-narrative-p">
              Enter the six-digit verification code sent to your email to finish signing in.
            </p>
            <div className="ap-narrative-features">
              {[
                { t: 'An additional sign-in check', i: ShieldCheck },
                { t: 'A code sent to your email', i: Mail }
              ].map((f, i) => (
                <div key={i} className="ap-narrative-feat">
                  <div className="ap-narrative-feat-circle"><f.i size={12} /></div>
                  <span>{f.t}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT MFA CARD */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div className="ap-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="ap-card-head">
                <div className="ap-card-ic"><Shield size={24} /></div>
                <h2 className="ap-card-t">Verification</h2>
                <p className="ap-card-s">Enter code sent to <strong>{email}</strong></p>
              </div>

              <form onSubmit={submit}>
                <div className="ap-otp">
                  {otp.map((d, i) => (
                    <motion.input
                      key={i}
                      id={`o-${i}`}
                      ref={i === 0 ? ref : null}
                      className="ap-otp-b" aria-label={`Verification code digit ${i + 1}`}
                      type="text"
                      maxLength="1"
                      value={d}
                      onChange={e => change(e, i)}
                      onKeyDown={e => kd(e, i)}
                      onPaste={i === 0 ? paste : null}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    />
                  ))}
                </div>

                {error && <div className="ap-berr">{error}</div>}

                <button className="ap-btn" type="submit" disabled={loading}>
                  {loading ? <><span className="ap-spin" /> Verifying…</> : 'Verify'}
                </button>
              </form>

              <div className="ap-cd">
                {cd > 0 ? (
                  <span><Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Resend in <span className="ap-cd-t">{cd}s</span></span>
                ) : (
                  <button className="ap-resend" onClick={resend}>
                    <RotateCcw size={11} /> Resend
                  </button>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
