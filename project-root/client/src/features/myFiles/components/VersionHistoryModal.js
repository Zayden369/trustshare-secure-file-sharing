import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, History, Upload, Download, RotateCcw,
  ShieldCheck, Loader2
} from 'lucide-react';
import { filesAPI } from '../../../utils/api';

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(1)} ${units[index]}`;
};

export default function VersionHistoryModal({
  file,
  isOpen,
  onClose,
  onVersionUpdated,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const fileInputRef = useRef(null);

  const loadVersions = async () => {
    if (!file?.id) return;
    setLoading(true);
    try {
      const res = await filesAPI.listVersions(file.id);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load versions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && file?.id) {
      loadVersions();
    }
  }, [isOpen, file?.id]);

  if (!isOpen || !file) return null;

  const handleUploadNewVersion = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await filesAPI.uploadVersion(file.id, formData);
      await loadVersions();
      onVersionUpdated?.();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to upload new version.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadHistorical = async (v) => {
    setActionInProgress(v.id);
    try {
      const response = await filesAPI.downloadVersion(file.id, v.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `v${v.version_number}_${file.original_name || file.name}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert('Failed to download historical version.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestore = async (v) => {
    if (!window.confirm(`Restore Version ${v.version_number} as the new active document? All historical versions will remain saved.`)) return;
    setActionInProgress(v.id);
    try {
      await filesAPI.restoreVersion(file.id, v.id);
      await loadVersions();
      onVersionUpdated?.();
    } catch (err) {
      alert('Failed to restore version.');
    } finally {
      setActionInProgress(null);
    }
  };

  const versionsList = data?.versions || [];

  return (
    <div className="my-files-modal-overlay">
      <motion.div
        className="my-files-modal version-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        style={{ maxWidth: 540, textAlign: 'left' }}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        <button className="my-files-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* Header */}
        <div className="version-history-header">
          <div className="version-history-heading">
            <div className="sharing-stat-icon blue">
              <History size={20} />
            </div>
            <div className="version-history-copy">
              <div className="version-history-title-line">
                <h2 id="version-history-title" className="my-files-modal-title" style={{ margin: 0 }}>Version History</h2>
                <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 7px' }}>
                  {versionsList.length} {versionsList.length === 1 ? 'Version' : 'Versions'}
                </span>
              </div>
              <p className="my-files-modal-message version-history-filename" title={file.original_name || file.name}>
                {file.original_name || file.name}
              </p>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUploadNewVersion}
          />
          <button
            type="button"
            className="my-files-btn my-files-btn--primary"
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={13} strokeWidth={2.2} />
            {uploading ? 'Uploading…' : 'New Version'}
          </button>
        </div>

        {/* Timeline Content */}
        <div style={{
          maxHeight: 340,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingRight: 4,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <span>Fetching audit timeline…</span>
            </div>
          ) : (
            versionsList.map((v) => (
              <div
                key={`ver-item-${v.version_number}-${v.id}`}
                className="version-history-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '3px',
                  background: v.is_current ? 'rgba(128, 128, 128, 0.08)' : 'var(--bg-input)',
                  border: v.is_current ? '1.5px solid var(--blue-500)' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    background: v.is_current ? 'var(--accent)' : 'var(--bg-hover)',
                    color: v.is_current ? 'var(--accent-contrast)' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                  }}>
                    v{v.version_number}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                        Version {v.version_number}
                      </strong>
                      {v.is_current && (
                        <span className="badge badge-emerald" style={{ fontSize: 10, padding: '2px 7px' }}>
                          Current Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatSize(v.size)} · {new Date(v.created_at).toLocaleString()}
                    </div>
                    {v.hash_sha256 && (
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 2 }}>
                        SHA256: {v.hash_sha256.slice(0, 16)}…
                      </div>
                    )}
                  </div>
                </div>

                {!v.is_current && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="my-files-quick-btn"
                      title="Download this past version"
                      onClick={() => handleDownloadHistorical(v)}
                      disabled={actionInProgress === v.id}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      className="my-files-quick-btn my-files-quick-btn--ai"
                      title="Restore this version as active"
                      onClick={() => handleRestore(v)}
                      disabled={actionInProgress === v.id}
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11.5,
          color: 'var(--text-muted)',
        }}>
          <ShieldCheck size={14} color="var(--emerald-400)" />
          <span>Every version is preserved with an immutable AES-256 encrypted snapshot.</span>
        </div>
      </motion.div>
    </div>
  );
}
