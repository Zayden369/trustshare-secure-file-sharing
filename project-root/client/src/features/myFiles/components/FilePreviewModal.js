import React, { useEffect, useState, useRef } from 'react';
import PreparationMark from '../../../components/PreparationMark';
import {
  X,
  Download,
  Trash2,
  FileText,
  AlertCircle,
  ExternalLink,
  Maximize2,
  Minimize2,
  Lock,
  Play,
} from 'lucide-react';
import { filesAPI, sharedWithMeAPI } from '../../../utils/api';

// ── File type detection ────────────────────────────────────────────────
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const TEXT_EXTENSIONS  = new Set(['txt', 'md', 'json', 'xml', 'csv', 'log']);
const PDF_EXTENSIONS   = new Set(['pdf']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'avi', 'mov', 'mkv']);

const getExtension = (name = '') => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const getPreviewType = (file) => {
  const ext = getExtension(file?.name || file?.original_name || '');
  const mime = (file?.mimetype || '').toLowerCase();

  if (PDF_EXTENSIONS.has(ext) || mime === 'application/pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) return 'image';
  if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return 'text';
  if (AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/')) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/')) return 'video';
  return 'unsupported';
};

const formatSize = (size) => {
  if (!size || isNaN(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1073741824) return `${(size / 1048576).toFixed(1)} MB`;
  return `${(size / 1073741824).toFixed(2)} GB`;
};

export default function FilePreviewModal({
  file,
  isShared = false,
  canDownload = true,
  onClose,
  onDelete,
  onDownload,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const objectUrlRef = useRef(null);

  const fileName = file?.name || file?.original_name || 'Untitled';
  const fileSize = formatSize(file?.size);
  const isEncrypted = file?.encrypted !== false;
  const previewType = getPreviewType(file);

  const targetId = file?.file_id || file?.id;
  const isSharedFile = isShared || file?.isShared || Boolean(file?.shared_by) || Boolean(file?.shared_by_email);
  
  const userCanDownload = canDownload && file?.can_download !== false && file?.permission !== 'view';

  useEffect(() => {
    if (!targetId) return;
    if (previewType === 'unsupported') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setTextContent('');
    setPreviewUrl(null);

    (async () => {
      try {
        const response = isSharedFile
          ? await sharedWithMeAPI.view(targetId)
          : await filesAPI.download(targetId);

        if (cancelled) return;

        if (previewType === 'text') {
          const text = await response.data.text();
          if (cancelled) return;
          setTextContent(text);
        } else {
          const blob = new Blob([response.data], {
            type: file?.mimetype || response.headers?.['content-type'] || 'application/octet-stream',
          });
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setPreviewUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
            err?.message ||
            'Failed to load preview. The file may be corrupted or you may not have permission.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [targetId, isSharedFile, previewType, file?.mimetype]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
      if (e.key === 'f' || e.key === 'F') {
        if (previewType !== 'unsupported') setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isFullscreen, previewType]);

  const handleDownloadClick = () => {
    if (onDownload && userCanDownload) onDownload(file);
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      onDelete(targetId);
      onClose();
    }
  };

  const handleOpenNewTab = () => {
    if (previewUrl) window.open(previewUrl, '_blank');
  };

  return (
    <div
      className={`file-preview-overlay ${isFullscreen ? 'is-fullscreen' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="file-preview-panel" role="dialog" aria-modal="true">
        {/* Header */}
        <header className="file-preview-header">
          <div className="file-preview-header-left">
            <div className="file-preview-header-icon">
              <FileText size={16} strokeWidth={2} />
            </div>
            <div className="file-preview-header-info">
              <h2 className="file-preview-title" title={fileName}>{fileName}</h2>
              <div className="file-preview-meta">
                {fileSize && <span>{fileSize}</span>}
                {fileSize && isEncrypted && <span className="file-preview-meta-sep">·</span>}
                {isEncrypted && (
                  <span className="file-preview-meta-encrypted">
                    <Lock size={10} strokeWidth={2.4} />
                    {userCanDownload ? 'Encrypted' : 'Encrypted (View Only)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="file-preview-header-actions">
            {previewType !== 'unsupported' && !loading && !error && (
              <button
                type="button"
                className="file-preview-icon-btn"
                onClick={() => setIsFullscreen((prev) => !prev)}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize2 size={15} strokeWidth={2.2} /> : <Maximize2 size={15} strokeWidth={2.2} />}
              </button>
            )}
            {previewType === 'pdf' && previewUrl && !loading && (
              <button
                type="button"
                className="file-preview-icon-btn"
                onClick={handleOpenNewTab}
                title="Open in new tab"
                aria-label="Open in new tab"
              >
                <ExternalLink size={15} strokeWidth={2.2} />
              </button>
            )}
            {userCanDownload && onDownload && (
              <button
                type="button"
                className="file-preview-action-btn file-preview-action-btn--primary"
                onClick={handleDownloadClick}
                title="Download file"
              >
                <Download size={14} strokeWidth={2.2} />
                <span>Download</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="file-preview-action-btn file-preview-action-btn--danger"
                onClick={handleDeleteClick}
                title="Delete file"
              >
                <Trash2 size={14} strokeWidth={2.2} />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              className="file-preview-icon-btn file-preview-icon-btn--close"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="file-preview-body">
          {loading && (
            <div className="file-preview-state">
              <PreparationMark/>
              <p className="file-preview-state-title">Loading preview…</p>
              <p className="file-preview-state-subtitle">Preparing your file for viewing</p>
            </div>
          )}

          {!loading && error && (
            <div className="file-preview-state">
              <div className="file-preview-state-icon file-preview-state-icon--error">
                <AlertCircle size={32} strokeWidth={1.8} />
              </div>
              <p className="file-preview-state-title">Unable to preview</p>
              <p className="file-preview-state-subtitle">{error}</p>
              {userCanDownload && onDownload && (
                <button
                  type="button"
                  className="my-files-btn my-files-btn--secondary"
                  onClick={handleDownloadClick}
                  style={{ marginTop: 20 }}
                >
                  <Download size={14} strokeWidth={2.2} />
                  Download instead
                </button>
              )}
            </div>
          )}

          {!loading && !error && previewType === 'unsupported' && (
            <div className="file-preview-state">
              <div className="file-preview-state-icon file-preview-state-icon--info">
                <FileText size={32} strokeWidth={1.5} />
              </div>
              <p className="file-preview-state-title">Preview not available</p>
              <p className="file-preview-state-subtitle">
                This file type cannot be previewed in your browser.
                {userCanDownload
                  ? ' Download the file to view it in a compatible application.'
                  : ' This file is restricted to in-browser viewing only.'}
              </p>
              {userCanDownload && onDownload && (
                <button
                  type="button"
                  className="my-files-btn my-files-btn--primary"
                  onClick={handleDownloadClick}
                  style={{ marginTop: 20 }}
                >
                  <Download size={14} strokeWidth={2.2} />
                  Download File
                </button>
              )}
            </div>
          )}

          {!loading && !error && previewType === 'pdf' && previewUrl && (
            <div className="file-preview-pdf">
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title={fileName}
                className="file-preview-pdf-frame"
              />
            </div>
          )}

          {!loading && !error && previewType === 'image' && previewUrl && (
            <div className="file-preview-image-wrap">
              <img
                src={previewUrl}
                alt={fileName}
                className="file-preview-image"
              />
            </div>
          )}

          {!loading && !error && previewType === 'text' && (
            <div className="file-preview-text-wrap">
              <pre className="file-preview-text">{textContent}</pre>
            </div>
          )}

          {/* Secure Audio Playback */}
          {!loading && !error && previewType === 'audio' && previewUrl && (
            <div className="file-preview-state" style={{ padding: '40px 24px', maxWidth: '440px' }}>
              <div className="my-files-icon-box my-files-icon--audio" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 18 }}>
                <Play size={28} style={{ marginLeft: 3 }} />
              </div>
              <p className="file-preview-state-title">Decrypted Audio Stream</p>
              <p className="file-preview-state-subtitle" style={{ marginBottom: 24 }}>{fileName}</p>
              <audio
                src={previewUrl}
                controls
                controlsList={userCanDownload ? undefined : "nodownload"}
                style={{ width: '100%', maxWidth: '360px' }}
              />
            </div>
          )}

          {/* Secure Video Playback */}
          {!loading && !error && previewType === 'video' && previewUrl && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 12 }}>
              <video
                src={previewUrl}
                controls
                controlsList={userCanDownload ? undefined : "nodownload"}
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 12px 36px rgba(0,0,0,0.5)' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
