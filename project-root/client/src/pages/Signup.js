import RegistrationVerification from '../components/RegistrationVerification';
import BrandMark from '../components/BrandMark';
import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Check, Server, Award, Sun, Moon } from 'lucide-react';
import '../styles/apple-auth.css';
import AuthArtwork from '../components/AuthArtwork';

export default function Signup() {
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fe, setFe] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verification,setVerification]=useState(null);
  const updateVerification=useCallback(proof=>{setVerification(proof);if(proof)setFe({});},[]);



  const str = (() => { const p = form.password; let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s; })();
  const sL = ['', 'Weak', 'Fair', 'Good', 'Strong'][str];
  const sC = ['', 'var(--text-muted)', 'var(--text-secondary)', 'var(--text-primary)', 'var(--accent)'][str];

  const next = () => {
    const e = {};
    if (step === 1 && !form.name.trim()) e.name = 'Required';
    if (step === 2) { if (!form.email) e.email = 'Required'; else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid'; }
    if (step === 3) { if (!form.password) e.password = 'Required'; else if (form.password.length < 8) e.password = 'Min 8 chars'; if (form.confirmPassword !== form.password) e.cp = 'No match'; }
    if(step===2&&(!verification||verification.expires<=Date.now()||verification.email!==form.email.trim().toLowerCase()))e.email='Verify this email before continuing.';
    setFe(e); if (Object.keys(e).length) return;
    if (step < 3) setStep(step + 1); else doSubmit();
  };

  const doSubmit = async () => {
    setError(''); setLoading(true);
    try {
      if (!verification || verification.expires <= Date.now()) {setVerification(null); setStep(2); setError('Please verify your email again.'); return;}
      await register(form.name, verification.email, form.password, verification.token); navigate('/dashboard'); }
    catch (err) { setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Account creation failed. Please check your details.'); }
    finally { setLoading(false); }
  };

  const labels = ['Name', 'Email', 'Password'];

  return (
    <div className="ap">

      <nav className="ap-nav">
        <Link to="/" className="ap-logo">
          <BrandMark/>
          TrustShare
        </Link>
        <div className="ap-nav-r">
          <Link to="/login" className="ap-nav-a ap-nav-cta">Sign In</Link>
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
            <AuthArtwork/>
            <span className="ap-narrative-eyebrow">Create your workspace</span>
            <h1 className="ap-narrative-h1">
              Create your<br /><span className="italic-gradient">secure account.</span>
            </h1>
            <p className="ap-narrative-p">
              A secure home for your files. Organize your workspace, manage access, and share with the people you choose.
            </p>
            <div className="ap-narrative-features">
              {[
                { t: 'Encrypted file storage', i: Server },
                { t: 'Control over shared access', i: Award }
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
                <div className="ap-card-ic"><User size={24} /></div>
                <h2 className="ap-card-t">Sign up</h2>
                <p className="ap-card-s">Step {step} of 3 — {labels[step - 1]}</p>
              </div>

              <div className="ap-steps">
                {[1,2,3].map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`ap-step ${s === step ? 'on' : ''} ${s < step ? 'done' : ''}`}>
                      <div className="ap-step-d">{s < step ? <Check size={12} /> : s}</div>
                      <span className="ap-step-l">{labels[i]}</span>
                    </div>
                    {i < 2 && <div className="ap-step-line"><div className="ap-step-line-fill" style={{ width: s < step ? '100%' : '0%' }} /></div>}
                  </React.Fragment>
                ))}
              </div>

              {error && <div className="ap-berr">{error}</div>}

              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  {step === 1 && (
                    <div className="ap-f"><div className="ap-fi">
                      <span className="ap-ic"><User size={16} /></span>
                      <input className="ap-in" type="text" aria-label="Full name" placeholder="Full name" value={form.name} onChange={e => { setForm(f => ({...f, name: e.target.value})); setFe({}); }} autoFocus required />
                    </div>{fe.name && <div className="ap-err">{fe.name}</div>}</div>
                  )}
                  {step === 2 && (
                    <div className="ap-f"><div className="ap-fi">
                      <span className="ap-ic"><Mail size={16} /></span>
                      <input className="ap-in" type="email" aria-label="Work email" placeholder="Work email" value={form.email} onChange={e => { setForm(f => ({...f, email: e.target.value})); setFe({}); setVerification(null); }} autoFocus required />
                    </div>{fe.email && <div className="ap-err">{fe.email}</div>}<RegistrationVerification key={form.email} email={form.email} existing={verification} onVerified={updateVerification}/></div>
                  )}
                  {step === 3 && (
                    <>
                      <div className="ap-f"><div className="ap-fi">
                        <span className="ap-ic"><Lock size={16} /></span>
                        <input className="ap-in" type={showPw ? 'text' : 'password'} aria-label="Password" placeholder="Password" value={form.password} onChange={e => { setForm(f => ({...f, password: e.target.value})); setFe({}); }} autoFocus required />
                        <button type="button" className="ap-tog" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw(v => !v)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      </div>{fe.password && <div className="ap-err">{fe.password}</div>}
                      {form.password && <div className="ap-str"><div className="ap-str-bar">{[1,2,3,4].map(i => (<div key={i} className="ap-str-s" style={{ background: i <= str ? sC : undefined }} />))}</div><div className="ap-str-t" style={{ color: sC }}>{sL}</div></div>}
                      </div>
                      <div className="ap-f"><div className="ap-fi">
                        <span className="ap-ic"><Lock size={16} /></span>
                        <input className="ap-in" type="password" aria-label="Confirm password" placeholder="Confirm password" value={form.confirmPassword} onChange={e => { setForm(f => ({...f, confirmPassword: e.target.value})); setFe({}); }} required />
                      </div>{fe.cp && <div className="ap-err">{fe.cp}</div>}</div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                {step > 1 && <button className="ap-btn" type="button" aria-label="Previous step" onClick={() => setStep(step - 1)} style={{ width: 46, minWidth: 46, padding: 0, background: 'var(--input)', color: 'var(--t1)' }}><ArrowLeft size={16} /></button>}
                <button className="ap-btn" type="button" onClick={next} disabled={loading}>
                  {loading ? <><span className="ap-spin" /></> : step < 3 ? <>Continue <ArrowRight size={14} /></> : 'Create Account'}
                </button>
              </div>

              <div className="ap-foot">Already have an account? <Link to="/login" className="ap-a">Sign in</Link></div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
