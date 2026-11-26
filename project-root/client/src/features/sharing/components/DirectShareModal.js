import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Eye, Download, Shield, AlertCircle } from 'lucide-react';
import CustomFileSelect from './CustomFileSelect';

export default function DirectShareModal({
  isOpen,
  onClose,
  onSubmit,
  files = [],
  isSubmitting = false,
}) {
  const [fileId, setFileId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [permission, setPermission] = useState('view');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fileId || !recipientEmail) {
      setError('Please select a file and enter a teammate email.');
      return;
    }
    setError('');
    await onSubmit({
      file_id: parseInt(fileId, 10),
      recipient_email: recipientEmail.trim(),
      permission,
    });
  };

  return (
    <div className="my-files-modal-overlay">
      <motion.div
        className="my-files-modal"
        style={{ maxWidth: 520, textAlign: 'left' }}
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
          <div className="sharing-stat-icon purple">
            <Users size={22} />
          </div>
          <div>
            <h2 className="my-files-modal-title" style={{ margin: 0 }}>Share with Teammate</h2>
            <p className="my-files-modal-message" style={{ margin: 0 }}>
              Directly grant access to another registered TrustShare user.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Custom Interactive File Select */}
            <div>
              <label className="form-label">Select File *</label>
              <CustomFileSelect
                files={files}
                value={fileId}
                onChange={(id) => setFileId(id)}
                placeholder="Choose an encrypted file…"
              />
            </div>

            <div>
              <label className="form-label">Teammate Email Address *</label>
              <input
                className="form-input"
                type="email"
                placeholder="colleague@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Permission Grant</label>
              <div className="perm-tile-grid">
                <div
                  className={`perm-tile ${permission === 'view' ? 'is-selected' : ''}`}
                  onClick={() => setPermission('view')}
                >
                  <span className="perm-tile-title">
                    <Eye size={15} color="var(--blue-400)" /> View Only
                  </span>
                  <span className="perm-tile-desc">Recipient can preview without download ability.</span>
                </div>
                <div
                  className={`perm-tile ${permission === 'download' ? 'is-selected' : ''}`}
                  onClick={() => setPermission('download')}
                >
                  <span className="perm-tile-title">
                    <Download size={15} color="var(--purple-400)" /> Full Download
                  </span>
                  <span className="perm-tile-desc">Recipient can download and export decrypted data.</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            <Shield size={16} color="var(--blue-400)" />
            <span>The file will immediately appear in their "Shared with Me" hub.</span>
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
              disabled={isSubmitting || !fileId || !recipientEmail}
            >
              {isSubmitting ? 'Granting Access…' : 'Share File'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
