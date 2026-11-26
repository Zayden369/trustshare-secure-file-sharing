import React, { useState } from 'react';
import { authAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldCheck, ShieldOff, Mail, Lock } from 'lucide-react';

const getApiErrorMessage = (err, fallback) => {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

const MFACard = ({ onSuccess, onError }) => {
  const { user, setUser } = useAuth();
  const isMfaEnabled = !!user?.mfa_enabled;

  // Enable flow states
  const [enableStep, setEnableStep] = useState(null); // null | 'otp'
  const [otpCode, setOtpCode] = useState('');
  const [enableLoading, setEnableLoading] = useState(false);

  // Disable flow states
  const [disableStep, setDisableStep] = useState(null); // null | 'password'
  const [confirmPassword, setConfirmPassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  const notify = (msg, type = 'success') => {
    if (type === 'success' && onSuccess) onSuccess(msg);
    if (type === 'error' && onError) onError(msg);
  };

  // ── ENABLE FLOW ──────────────────────────────────────────────
  const startEnable = async () => {
    setEnableLoading(true);
    try {
      await authAPI.mfaSetup();
      setEnableStep('otp');
      notify(`Verification code sent to ${user.email}`, 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to send verification code.'), 'error');
    } finally {
      setEnableLoading(false);
    }
  };

  const submitEnableOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      notify('Please enter the 6-digit verification code.', 'error');
      return;
    }
    setEnableLoading(true);
    try {
      const { data } = await authAPI.mfaVerifySetup(otpCode);
      if (setUser) {
        setUser((prev) => ({ ...prev, ...data, mfa_enabled: true }));
      }
      setEnableStep(null);
      setOtpCode('');
      notify('Two-factor authentication enabled successfully!', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Invalid or expired verification code.'), 'error');
    } finally {
      setEnableLoading(false);
    }
  };

  const cancelEnable = () => {
    setEnableStep(null);
    setOtpCode('');
  };

  const resendOtp = async () => {
    setEnableLoading(true);
    try {
      await authAPI.mfaSetup();
      notify(`New code sent to ${user.email}`, 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Failed to resend code.'), 'error');
    } finally {
      setEnableLoading(false);
    }
  };

  // ── DISABLE FLOW ─────────────────────────────────────────────
  const startDisable = () => {
    setDisableStep('password');
    setConfirmPassword('');
  };

  const submitDisable = async () => {
    if (!confirmPassword) {
      notify('Please enter your password to disable MFA.', 'error');
      return;
    }
    setDisableLoading(true);
    try {
      const { data } = await authAPI.mfaDisableWithPassword(confirmPassword);
      if (setUser) {
        setUser((prev) => ({ ...prev, ...data, mfa_enabled: false }));
      }
      setDisableStep(null);
      setConfirmPassword('');
      notify('Two-factor authentication disabled.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Incorrect password.'), 'error');
    } finally {
      setDisableLoading(false);
    }
  };

  const cancelDisable = () => {
    setDisableStep(null);
    setConfirmPassword('');
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div className="settings-card" style={{ marginTop: 24 }}>
      <div className="settings-card-header">
        <h2 className="settings-card-title">
          <Shield size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Two-Factor Authentication
        </h2>
        <p className="settings-card-subtitle">
          Add an extra layer of security. A 6-digit code will be emailed to you on every login.
        </p>
      </div>

      {/* Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: isMfaEnabled
            ? 'linear-gradient(135deg, rgba(160, 160, 160,0.08), rgba(160, 160, 160,0.02))'
            : 'linear-gradient(135deg, rgba(160, 160, 160,0.08), rgba(160, 160, 160,0.02))',
          border: `1px solid ${isMfaEnabled ? 'rgba(160, 160, 160,0.25)' : 'rgba(160, 160, 160,0.2)'}`,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        {isMfaEnabled ? (
          <ShieldCheck size={28} color="#a0a0a0" />
        ) : (
          <ShieldOff size={28} color="#a0a0a0" />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
            {isMfaEnabled ? 'MFA is Enabled' : 'MFA is Disabled'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {isMfaEnabled
              ? 'Your account has an extra layer of protection.'
              : 'Enable MFA to secure your account.'}
          </div>
        </div>
      </div>

      {/* ENABLE FLOW */}
      {!isMfaEnabled && enableStep === null && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={startEnable}
          disabled={enableLoading}
        >
          {enableLoading ? 'Sending code...' : 'Enable Two-Factor Authentication'}
        </button>
      )}

      {!isMfaEnabled && enableStep === 'otp' && (
        <div
          style={{
            padding: 20,
            background: 'var(--bg-input)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Mail size={18} color="var(--text-primary)" />
            <strong style={{ color: 'var(--text-primary)' }}>Check your email</strong>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            We sent a 6-digit verification code to <strong>{user?.email}</strong>. It expires in 5 minutes.
          </p>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Verification Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{ fontSize: 20, letterSpacing: 6, textAlign: 'center', fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitEnableOtp}
              disabled={enableLoading || otpCode.length !== 6}
            >
              {enableLoading ? 'Verifying...' : 'Verify & Enable'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resendOtp}
              disabled={enableLoading}
            >
              Resend Code
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelEnable}
              disabled={enableLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DISABLE FLOW */}
      {isMfaEnabled && disableStep === null && (
        <button
          type="button"
          className="btn btn-danger"
          onClick={startDisable}
        >
          Disable Two-Factor Authentication
        </button>
      )}

      {isMfaEnabled && disableStep === 'password' && (
        <div
          style={{
            padding: 20,
            background: 'var(--bg-input)',
            borderRadius: 12,
            border: '1px solid rgba(96, 96, 96,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Lock size={18} color="#606060" />
            <strong style={{ color: 'var(--text-primary)' }}>Confirm your identity</strong>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Enter your password to disable MFA. This will remove extra login protection from your account.
          </p>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your account password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={submitDisable}
              disabled={disableLoading || !confirmPassword}
            >
              {disableLoading ? 'Disabling...' : 'Confirm Disable'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelDisable}
              disabled={disableLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MFACard;
