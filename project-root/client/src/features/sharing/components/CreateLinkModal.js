import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Link2, Eye, Download, ShieldCheck, AlertCircle
} from 'lucide-react';
import CustomFileSelect from './CustomFileSelect';

export default function CreateLinkModal({
  isOpen,
  onClose,
  onSubmit,
  files = [],
  isSubmitting = false,
}) {
  const [fileId, setFileId] = useState('');
  const [permission, setPermission] = useState('view');
  const [password, setPassword] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fileId) {
      setError('Please select a file to share.');
      return;
    }

    let expiryIso = null;
    if (expiresAt && expiresAt.trim() !== '') {
      const parsedDate = new Date(expiresAt);
      if (!isNaN(parsedDate.getTime())) {
        expiryIso = parsedDate.toISOString();
      }
    }

    setError('');
    await onSubmit({
      file_id: parseInt(fileId, 10),
      permission,
      password: password.trim() || null,
      max_views: maxViews ? parseInt(maxViews, 10) : null,
      expires_at: expiryIso,
    });
  };

  const handlePresetExpiry = (hours) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    const pad = (n) => String(n).padStart(2, '0');
    const localFormatted =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setExpiresAt(localFormatted);
  };

  return (
    <div className="my-files-modal-overlay">
      <motion.div
        className="my-files-modal"
        style={{ maxWidth: 540, textAlign: 'left' }}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        <button
          className="my-files-modal-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div className="sharing-stat-icon blue">
            <Link2 size={22} />
          </div>
          <div>
            <h2 className="my-files-modal-title" style={{ margin: 0 }}>Create Secure Share Link</h2>
            <p className="my-files-modal-message" style={{ margin: 0 }}>
              Generate an AES-256 protected external link with granular access controls.
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(96, 96, 96, 0.1)',
            color: 'var(--rose-400)',
            fontSize: 13,
            marginBottom: 16,
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-form-grid">
            {/* Custom Interactive File Selection */}
            <div className="modal-form-full">
              <label className="form-label">Select File *</label>
              <CustomFileSelect
                files={files}
                value={fileId}
                onChange={(id) => setFileId(id)}
                placeholder="Choose an encrypted file…"
              />
            </div>

            {/* Permission Tiles */}
            <div className="modal-form-full">
              <label className="form-label">Access Level</label>
              <div className="perm-tile-grid">
                <div
                  className={`perm-tile ${permission === 'view' ? 'is-selected' : ''}`}
                  onClick={() => setPermission('view')}
                >
                  <span className="perm-tile-title">
                    <Eye size={15} color="var(--blue-400)" /> View Only
                  </span>
                  <span className="perm-tile-desc">Recipient can view or play the file safely in-browser.</span>
                </div>
                <div
                  className={`perm-tile ${permission === 'download' ? 'is-selected' : ''}`}
                  onClick={() => setPermission('download')}
                >
                  <span className="perm-tile-title">
                    <Download size={15} color="var(--purple-400)" /> Downloadable
                  </span>
                  <span className="perm-tile-desc">Recipient can save decrypted original to disk.</span>
                </div>
              </div>
            </div>

            {/* Expiration Preset & Picker */}
            <div className="modal-form-full">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" style={{ margin: 0 }}>Link Expiry (Optional)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="my-files-btn my-files-btn--secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => handlePresetExpiry(24)}
                  >
                    +24h
                  </button>
                  <button
                    type="button"
                    className="my-files-btn my-files-btn--secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => handlePresetExpiry(168)}
                  >
                    +7d
                  </button>
                  <button
                    type="button"
                    className="my-files-btn my-files-btn--secondary"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setExpiresAt('')}
                  >
                    Never
                  </button>
                </div>
              </div>
              <input
                className="form-input"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            {/* Max Views */}
            <div>
              <label className="form-label">Max Views / Accesses</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="form-label">Password Protection</label>
              <input
                className="form-input"
                type="password"
                placeholder="Optional passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            <ShieldCheck size={16} color="var(--emerald-400)" />
            <span>Recipients can access this file according to the permissions and expiry you choose.</span>
          </div>

          <div className="my-files-modal-actions">
            <button
              type="button"
              className="my-files-btn my-files-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="my-files-btn my-files-btn--primary"
              disabled={isSubmitting || !fileId}
            >
              {isSubmitting ? 'Generating Link…' : 'Create Secure Link'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
