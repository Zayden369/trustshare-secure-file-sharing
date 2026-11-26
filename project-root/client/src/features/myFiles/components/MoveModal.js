import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, ChevronLeft, FolderPlus, ArrowRight, Loader2 } from 'lucide-react';
import { foldersAPI } from '../../../utils/api';

export default function MoveModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount = 0,
}) {
  const [currentPath, setCurrentPath] = useState([]); 
  const [subfolders, setSubfolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
  const currentFolderName = currentPath.length > 0 ? currentPath[currentPath.length - 1].name : 'My Files (Root)';

  const loadSubfolders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await foldersAPI.list(activeFolderId);
      setSubfolders(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError('Failed to list folders at this level.');
    } finally {
      setLoading(false);
    }
  }, [activeFolderId]);

  useEffect(() => {
    if (isOpen) {
      loadSubfolders();
    }
  }, [isOpen, loadSubfolders]);

  if (!isOpen) return null;

  const handleEnterFolder = (folder) => {
    setCurrentPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleGoBack = () => {
    setCurrentPath((prev) => prev.slice(0, -1));
  };

  const handleConfirmMove = () => {
    onConfirm(activeFolderId, currentFolderName);
  };

  return (
    <div className="my-files-modal-overlay">
      <motion.div
        className="my-files-modal"
        style={{ maxWidth: 480, textAlign: 'left' }}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
      >
        <button className="my-files-modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div className="sharing-stat-icon blue">
            <Folder size={20} />
          </div>
          <div>
            <h2 className="my-files-modal-title" style={{ margin: 0 }}>Move {selectedCount} items</h2>
            <p className="my-files-modal-message" style={{ margin: 0 }}>
              Select a target directory to organize your encrypted files.
            </p>
          </div>
        </div>

        {/* Directory Navigator Path Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 12,
        }}>
          {currentPath.length > 0 && (
            <button
              type="button"
              className="my-files-quick-btn"
              onClick={handleGoBack}
              style={{ width: 24, height: 24, borderRadius: 6 }}
              title="Go back"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Location: <strong style={{ color: 'var(--text-primary)' }}>{currentFolderName}</strong>
          </span>
        </div>

        {/* Subfolders List */}
        <div style={{
          height: 220,
          border: '1.5px solid var(--border-medium)',
          borderRadius: 12,
          background: 'var(--bg-input)',
          overflowY: 'auto',
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
              <Loader2 size={24} className="animate-spin text-muted" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crawl directory…</span>
            </div>
          ) : error ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--rose-400)' }}>
              {error}
            </div>
          ) : subfolders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <Folder size={28} strokeWidth={1.5} style={{ marginBottom: 6 }} />
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>No subfolders found here</span>
            </div>
          ) : (
            subfolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => handleEnterFolder(folder)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Folder size={16} color="#a0a0a0" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {folder.name}
                  </span>
                </div>
                <ArrowRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            ))
          )}
        </div>

        {/* Modal Buttons */}
        <div className="my-files-modal-actions">
          <button
            type="button"
            className="my-files-btn my-files-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="my-files-btn my-files-btn--primary"
            onClick={handleConfirmMove}
            disabled={loading}
          >
            Move Here
          </button>
        </div>
      </motion.div>
    </div>
  );
}
