import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../utils/api';
import { Mail, Check, ArrowLeft, KeyRound, Lock, Sun, Moon } from 'lucide-react';
import '../styles/apple-auth.css';

const BgEnvironment = () => null;

export default function ForgotPassword() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const mouseX = 0;
  const mouseY = 0;



  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Invalid email'); return; }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ap">
      <BgEnvironment mouseX={mouseX} mouseY={mouseY} />

      <nav className="ap-nav">
        <Link to="/" className="ap-logo">
          <img src="/logo.png" alt="" onError={e => e.target.style.display='none'} />
          TrustShare
        </Link>
        <div className="ap-nav-r">
          <Link to="/login" className="ap-nav-a">Sign In</Link>
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
            <span className="ap-narrative-eyebrow">Access recovery</span>
            <h1 className="ap-narrative-h1">
              Reset Your<br /><span className="italic-gradient">Security Key.</span>
            </h1>
            <p className="ap-narrative-p">
              If your account credentials have compromised or forgotten, submit your work email address. We'll issue a dynamic, single-use login recovery link.
            </p>
            <div className="ap-narrative-features">
              {[
                { t: 'Dynamic single-use reset link dispatches', i: KeyRound },
                { t: 'Automatic previous session invalidation', i: Lock }
              ].map((f, i) => (
                <div key={i} className="ap-narrative-feat">
                  <div className="ap-narrative-feat-circle"><f.i size={12} /></div>
                  <span>{f.t}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div className="ap-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              {success ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="ap-card-ic"><Check size={24} /></div>
                  <h2 className="ap-card-t">Check your email</h2>
                  <p className="ap-card-s">A reset link has been sent to <strong>{email}</strong></p>
                  <Link to="/login" className="ap-btn" style={{ marginTop: 20, textDecoration: 'none' }}><ArrowLeft size={14} /> Back to sign in</Link>
                </div>
              ) : (
                <>
                  <div className="ap-card-head">
                    <div className="ap-card-ic"><Mail size={24} /></div>
                    <h2 className="ap-card-t">Forgot password?</h2>
                    <p className="ap-card-s">Enter your email and we'll send a reset link.</p>
                  </div>

                  <form onSubmit={submit}>
                    <div className="ap-f"><div className="ap-fi">
                      <span className="ap-ic"><Mail size={16} /></span>
                      <input
                        className="ap-in"
                        type="email"
                        aria-label="Email address" placeholder="Email address"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        required
                      />
                    </div></div>

                    {error && <div className="ap-berr">{error}</div>}

                    <button className="ap-btn" type="submit" disabled={loading}>
                      {loading ? <><span className="ap-spin" /></> : 'Send Reset Link'}
                    </button>

                    <div className="ap-foot">
                      <Link to="/login" className="ap-a"><ArrowLeft size={12} style={{verticalAlign:'middle', marginRight:4}} />Back to sign in</Link>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
