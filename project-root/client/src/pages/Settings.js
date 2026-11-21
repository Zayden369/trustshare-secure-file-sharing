import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../utils/api';
import { 
  Eye, EyeOff, Laptop, Smartphone, Monitor, Shield, Lock, 
  Clock, Trash2, CheckCircle2, ShieldAlert
} from 'lucide-react';
import MFACard from './MFACard';
import './Settings.css';

const getApiErrorMessage = (err, fallback) => {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

const formatLastActive = (isoString) => {
  if (!isoString) return 'Unknown';
  try {
    const then = new Date(isoString);
    const now = new Date();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return then.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return isoString;
  }
};

// ── Interactive Segmented Sliding Toggle Switch ──────────────────────
function Toggle({ on, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative rounded-full transition-colors duration-250 shrink-0 ${on ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-slate-200"}`}
      style={{ 
        height: "22px", 
        width: "40px",
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        border: 'none',
        outline: 'none',
        background: on ? 'linear-gradient(135deg, #808080, #606060)' : 'var(--bg-hover)',
        boxShadow: on ? '0 2px 6px rgba(128, 128, 128, 0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.15)',
        transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        flexShrink: 0,
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: '3px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
          left: on ? '21px' : '3px',
        }}
      />
    </button>
  );
}

// ── Real-Time Password Strength Meter Component ──────────────────────
function PasswordStrengthMeter({ password }) {
  const evaluateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'transparent', textClass: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: '#606060', textClass: 'text-danger' };
    if (score <= 4) return { score, label: 'Medium', color: '#a0a0a0', textClass: 'text-warning' };
    return { score, label: 'Strong security', color: '#a0a0a0', textClass: 'text-success' };
  };

  const strength = evaluateStrength(password);
  if (!password) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Password strength:</span>
        <span className={strength.textClass} style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'capitalize' }}>
          {strength.label}
        </span>
      </div>
      <div style={{ height: '4px', background: 'var(--bg-hover)', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ 
          height: '100%', 
          background: strength.color, 
          width: `${(strength.score / 5) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
}

const Settings = () => {
  const { user, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs = ['profile', 'security', 'sessions', 'notifications'];
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && activeTab === 'security') {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [activeTab]);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [searchParams]);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Profile Tab State
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [organization, setOrganization] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sessions Tab State
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  // Notification Preferences Tab State
  const [notifPrefs, setNotifPrefs] = useState({
    file_shares: { in_app: true, email: true },
    downloads: { in_app: true, email: false },
    security_alerts: { in_app: true, email: true },
    link_expirations: { in_app: false, email: true },
    access_changes: { in_app: true, email: false },
    system_updates: { in_app: false, email: false },
  });
  const [digestFrequency, setDigestFrequency] = useState('daily');

  useEffect(() => {
    settingsAPI.getProfile().then(({ data }) => {
      setFullName(data.name || '');
      setEmailAddress(data.email || '');
      setOrganization(data.organization || '');
      setAvatarUrl(data.avatar_url || null);
    }).catch((err) => {
      setErrorMsg(getApiErrorMessage(err, 'Failed to load profile.'));
    });

    setLoadingSessions(true);
    settingsAPI.getSessions()
      .then(({ data }) => setSessions(data))
      .catch((err) => {
        setErrorMsg(getApiErrorMessage(err, 'Failed to load active sessions.'));
      })
      .finally(() => setLoadingSessions(false));

    settingsAPI.getNotificationPreferences().then(({ data }) => {
      const { digest_frequency, ...rest } = data;
      setNotifPrefs(rest);
      setDigestFrequency(digest_frequency);
    }).catch((err) => {
      setErrorMsg(getApiErrorMessage(err, 'Failed to load notification preferences.'));
    });
  }, []);

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.name || '');
      setEmailAddress((prev) => prev || user.email || '');
      setAvatarUrl((prev) => prev || user.avatar_url || null);
    }
  }, [user]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'profile') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
    setSuccessMsg('');
    setErrorMsg('');
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 2 MB');
        setSuccessMsg('');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result);
        setErrorMsg('');
        setSuccessMsg('Photo uploaded! Click "Save Changes" to apply.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    setErrorMsg('');
    setSuccessMsg('Photo removed! Click "Save Changes" to apply.');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!fullName.trim() || !emailAddress.trim()) {
      setErrorMsg('Full Name and Email Address are required.');
      return;
    }

    try {
      const updateData = {
        name: fullName,
        email: emailAddress,
        organization,
        avatar_url: avatarUrl,
      };
      const { data } = await settingsAPI.updateProfile(updateData);

      if (setUser && user) {
        const updatedUser = {
          ...user,
          name: data.name || fullName,
          email: data.email || emailAddress,
          organization: data.organization !== undefined ? data.organization : organization,
          avatar_url: data.avatar_url !== undefined ? data.avatar_url : avatarUrl,
        };
        setUser(updatedUser);
      }

      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Failed to update profile.'));
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your new password.');
      return;
    }

    try {
      await settingsAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccessMsg(
        'Password changed successfully! Other devices have been signed out for security.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      settingsAPI.getSessions()
        .then(({ data }) => setSessions(data))
        .catch(() => { });
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Failed to update password.'));
    }
  };

  const handleSignOutSession = async (id) => {
    if (!window.confirm('Sign out this device? It will need to authenticate again.')) return;
    setSuccessMsg('');
    setErrorMsg('');
    setRevokingId(id);
    try {
      await settingsAPI.logoutSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSuccessMsg('Signed out of session successfully.');
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Failed to sign out session.'));
    } finally {
      setRevokingId(null);
    }
  };

  const handleSignOutAllOthers = async () => {
    if (!window.confirm('Sign out every other device? Your current session will remain active.')) return;
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await settingsAPI.logoutAllSessions();
      setSessions((prev) => prev.filter((s) => s.is_current));
      setSuccessMsg('Signed out of all other sessions successfully.');
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Failed to sign out other sessions.'));
    }
  };

  const handleTogglePref = (activityKey, channel) => {
    setNotifPrefs((prev) => ({
      ...prev,
      [activityKey]: {
        ...prev[activityKey],
        [channel]: !prev[activityKey][channel],
      },
    }));
  };

  const handleSavePreferences = async () => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const data = {
        ...notifPrefs,
        digest_frequency: digestFrequency,
      };
      const { data: res } = await settingsAPI.updateNotificationPreferences(data);
      const { digest_frequency, ...savedPreferences } = res;
      setNotifPrefs(savedPreferences);
      setDigestFrequency(digest_frequency);
      setSuccessMsg('Notification preferences saved successfully!');
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Failed to update notification preferences.'));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'TS';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getDeviceIcon = (deviceType) => {
    const type = String(deviceType || '').toLowerCase();
    if (type === 'mobile' || type === 'phone') return <Smartphone size={18} />;
    if (type === 'tablet') return <Laptop size={18} />;
    return <Monitor size={18} />;
  };

  return (
    <div className="settings-container fade-in">
      <div className="page-header-left">
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Settings</h1>
        <p className="settings-subtitle">Manage your account, security and preferences.</p>
      </div>

      {/* Tabs list */}
      <div className="settings-tabs-wrapper">
        <div className="settings-tabs">
          {['profile', 'security', 'sessions', 'notifications'].map((t) => (
            <button
              key={t}
              className={`settings-tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => handleTabChange(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t === 'notifications' ? 'Preferences' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Feedback Messaging */}
      {successMsg && (
        <div className="alert-feedback alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert-feedback alert-error" style={{ marginBottom: 16 }}>
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── PROFILE TAB ────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Profile Information</h2>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="avatar-section">
              <div
                className="avatar-preview-container"
                style={{
                  background: !avatarUrl ? 'linear-gradient(135deg, #808080, #606060)' : 'var(--bg-input)',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User avatar" className="avatar-preview-image" />
                ) : (
                  <span className="avatar-initials">{getInitials(fullName)}</span>
                )}
              </div>

              <div className="avatar-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png, image/jpeg, image/jpg"
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={triggerFileInput}
                  >
                    Change Photo
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleRemoveAvatar}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <span className="avatar-helper-text">JPG, PNG up to 2 MB</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="form-input"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="emailAddress">Email Address</label>
              <input
                id="emailAddress"
                type="email"
                className="form-input"
                placeholder="Your email address"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="organization">Organization</label>
              <input
                id="organization"
                type="text"
                className="form-input"
                placeholder="Your organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SECURITY TAB ───────────────────────────────────────── */}
      {activeTab === 'security' && (
        <>
          <div className="settings-card">
            <div className="settings-card-header">
              <h2 className="settings-card-title">Change Password</h2>
              <p className="settings-card-subtitle">
                Use a strong, unique password. Changing your password will log out other devices.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="currentPassword">Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-visibility-btn"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-visibility-btn"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Verify new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-visibility-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <button type="submit" className="btn btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>

          <div id="mfa">
            <MFACard
              onSuccess={(msg) => { setSuccessMsg(msg); setErrorMsg(''); }}
              onError={(msg) => { setErrorMsg(msg); setSuccessMsg(''); }}
            />
          </div>
        </>
      )}

      {/* ── SESSIONS TAB ───────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="settings-card">
          <div className="sessions-list-header">
            <div>
              <h2 className="settings-card-title">Active Sessions</h2>
              <p className="settings-card-subtitle">Devices currently signed into your account.</p>
            </div>
            {sessions.filter((s) => !s.is_current).length > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleSignOutAllOthers}
              >
                Sign out all others
              </button>
            )}
          </div>

          {loadingSessions ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
              <div className="my-files-spinner" />
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No active sessions found.
                </div>
              )}
              {sessions.map((s) => (
                <div key={s.id} className={`session-item ${s.is_current ? 'is-current' : ''}`}>
                  <div className="session-info-left">
                    <div className="session-icon-box">
                      {getDeviceIcon(s.device_type)}
                    </div>
                    <div className="session-text">
                      <div className="session-device-meta">
                        <span className="session-device-name">{s.device_name || 'Unknown Device'}</span>
                        {s.is_current && <span className="session-badge-current">Current</span>}
                      </div>
                      <span className="session-details">
                        {[s.browser_name, s.location, s.ip_address]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="session-time-label">
                        {s.is_current ? 'Active now' : formatLastActive(s.last_active)}
                      </span>
                    </div>
                  </div>

                  {!s.is_current && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleSignOutSession(s.id)}
                      disabled={revokingId === s.id}
                    >
                      {revokingId === s.id ? '...' : 'Sign Out'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ──────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Notification Preferences</h2>
            <p className="settings-card-subtitle">Choose how you want to be notified for each activity.</p>
          </div>

          <div className="notification-matrix">
            <div className="notification-matrix-header">
              <span>Activity Type</span>
              <span style={{ textAlign: 'center' }}>In-App</span>
              <span style={{ textAlign: 'center' }}>Email</span>
            </div>

            {[
              { key: 'file_shares', label: 'File Shares', desc: 'When someone shares a file or folder with you' },
              { key: 'downloads', label: 'Downloads', desc: 'When someone downloads your shared file' },
              { key: 'security_alerts', label: 'Security Alerts', desc: 'When there is a new login or suspicious activity' },
              { key: 'link_expirations', label: 'Link Expirations', desc: 'When your shared links are about to expire' },
              { key: 'access_changes', label: 'Access Changes', desc: 'When your access permissions are modified' },
              { key: 'system_updates', label: 'System Updates', desc: 'Important news and updates about TrustShare' },
            ].map((row) => (
              <div key={row.key} className="notification-row">
                <div className="notification-info">
                  <span className="notification-name">{row.label}</span>
                  <span className="notification-desc">{row.desc}</span>
                </div>

                <div className="notification-toggle-cell">
                  <Toggle
                    on={notifPrefs[row.key]?.in_app || false}
                    onToggle={() => handleTogglePref(row.key, 'in_app')}
                  />
                </div>

                <div className="notification-toggle-cell">
                  <Toggle
                    on={notifPrefs[row.key]?.email || false}
                    onToggle={() => handleTogglePref(row.key, 'email')}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="digest-section">
            <h3 className="digest-title">Email Digest Frequency</h3>
            <p className="digest-subtitle">Select how often you would like to receive general notification digests.</p>

            {/* Sliding Segmented Controls */}
            <div className="sharing-perm-toggle" style={{ width: '100%', padding: '3px' }}>
              {['instant', 'daily', 'weekly', 'never'].map((freq) => (
                <button
                  key={freq}
                  type="button"
                  className={`sharing-perm-toggle-btn ${digestFrequency === freq ? 'is-active download' : ''}`}
                  onClick={() => setDigestFrequency(freq)}
                  style={{ textTransform: 'capitalize', flex: 1, justifyContent: 'center' }}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSavePreferences}
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
