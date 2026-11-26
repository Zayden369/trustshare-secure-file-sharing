import React, { useEffect, useState, useRef } from 'react';
import {
  Download, Eye, LockKeyhole,
  ShieldCheck, ShieldAlert,
  X, Maximize2, Minimize2, Music, Film
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sharesAPI } from '../utils/api';
import SharedFileIcon from '../features/sharedWithMe/components/SharedFileIcon';

const formatSize = (size) => {
  if (!Number.isFinite(size)) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getExtension = (name = '') => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export default function PublicShare() {
  const { token } = useParams();
  const [details, setDetails] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    if (loading) {
      document.title = 'Verifying Secure Link · TrustShare';
    } else if (needsPassword) {
      document.title = 'Password Required · TrustShare Vault';
    } else if (details?.file_name) {
      document.title = `${details.file_name} · TrustShare Vault`;
    } else if (error) {
      document.title = 'Share Unavailable · TrustShare Vault';
    } else {
      document.title = 'TrustShare Vault';
    }

    return () => {
      document.title = 'TrustShare';
    };
  }, [loading, needsPassword, details, error]);

  const loadDetails = async (sharePassword = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await sharesAPI.publicDetails(token, sharePassword || undefined);
      setDetails(response.data);
      setNeedsPassword(false);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setNeedsPassword(true);
        if (sharePassword) setError('Incorrect share password. Please try again.');
      } else {
        setError(requestError.response?.data?.detail || 'This secure link is expired or unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [token]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const unlock = (event) => {
    event.preventDefault();
    loadDetails(password);
  };

  const handleDownload = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const response = await sharesAPI.publicContent(token, password || undefined);
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = details.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      setDetails((prev) => ({ ...prev, access_count: prev.access_count + 1 }));
    } catch (requestError) {
      setError(
        requestError.response?.status === 410
          ? 'This link has expired or reached its maximum view limit.'
          : 'Could not decrypt the requested document.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenPreview = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const response = await sharesAPI.publicContent(token, password || undefined);
      const ext = getExtension(details.file_name);
      const mime = details.mimetype || '';

      if (['txt', 'md', 'json', 'csv', 'xml', 'log'].includes(ext) || mime.startsWith('text/')) {
        const text = await response.data.text();
        setPreviewText(text);
      } else {
        const blob = new Blob([response.data], { type: mime || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setPreviewBlobUrl(url);
      }

      setPreviewing(true);
      setDetails((prev) => ({ ...prev, access_count: prev.access_count + 1 }));
    } catch (requestError) {
      setError(
        requestError.response?.status === 410
          ? 'This link has expired or reached its maximum view limit.'
          : 'Could not decrypt the requested document for preview.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewing(false);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewBlobUrl(null);
    setPreviewText('');
  };

  const ext = getExtension(details?.file_name || '');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) || details?.mimetype?.startsWith('image/');
  const isPdf = ext === 'pdf' || details?.mimetype === 'application/pdf';
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || details?.mimetype?.startsWith('audio/');
  const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext) || details?.mimetype?.startsWith('video/');
  const isText = Boolean(previewText);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--grad-bg)',
      }}
    >
      <motion.section
        className="card"
        style={{
          width: previewing ? 'min(980px, 96vw)' : 'min(500px, 100%)',
          padding: previewing ? '24px' : '36px 32px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          borderRadius: 24,
          transition: 'width 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!logoFailed ? (
              <img
                src="/logo.png"
                alt="TrustShare"
                style={{ width: 40, height: 40, objectFit: 'contain' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #202020, #606060)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={22} />
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                TrustShare Vault
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Zero-Trust Encrypted Transfer
              </p>
            </div>
          </div>

          {previewing && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="my-files-quick-btn"
                onClick={() => setPreviewFullscreen((prev) => !prev)}
                title="Toggle Fullscreen"
              >
                {previewFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                className="my-files-quick-btn my-files-quick-btn--danger"
                onClick={closePreview}
                title="Close Preview"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Verifying security token…</p>
          </div>
        ) : needsPassword ? (
          <form onSubmit={unlock}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(160, 160, 160, 0.1)',
              color: 'var(--amber-400)',
              fontSize: 13,
              marginBottom: 18,
            }}>
              <LockKeyhole size={18} />
              <span>This file requires a passkey to decrypt.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="share-password">Passphrase</label>
              <input
                id="share-password"
                className="form-input"
                type="password"
                placeholder="Enter passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p style={{ color: 'var(--rose-400)', fontSize: 13, marginTop: 8 }}>{error}</p>
            )}

            <button
              className="my-files-btn my-files-btn--primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}
              type="submit"
            >
              Decrypt & Unlock File
            </button>
          </form>
        ) : details ? (
          <div>
            {!previewing ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '18px',
                    borderRadius: 14,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: 20,
                  }}
                >
                  <SharedFileIcon mimetype={details.mimetype} name={details.file_name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {details.file_name}
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatSize(details.size)} · {details.permission === 'download' ? 'Downloadable' : 'View Only'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Access Allowance:</span>
                    <strong>
                      {details.max_views == null
                        ? `${details.access_count} views logged`
                        : `${Math.max(details.max_views - details.access_count, 0)} of ${details.max_views} remaining`}
                    </strong>
                  </div>
                  {details.expires_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Expires:</span>
                      <strong>{new Date(details.expires_at).toLocaleString()}</strong>
                    </div>
                  )}
                </div>

                {error && (
                  <p style={{ color: 'var(--rose-400)', fontSize: 13, marginBottom: 14 }}>{error}</p>
                )}

                {details.permission === 'download' ? (
                  <button
                    className="my-files-btn my-files-btn--primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}
                    type="button"
                    onClick={handleDownload}
                    disabled={previewLoading}
                  >
                    {previewLoading ? (
                      <span className="spinner spinner-sm" />
                    ) : (
                      <>
                        <Download size={16} /> Download Encrypted File
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    className="my-files-btn my-files-btn--primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}
                    type="button"
                    onClick={handleOpenPreview}
                    disabled={previewLoading}
                  >
                    {previewLoading ? (
                      <span className="spinner spinner-sm" />
                    ) : (
                      <>
                        <Eye size={16} /> Open Secure Preview
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div
                style={{
                  height: previewFullscreen ? 'calc(85vh - 100px)' : isAudio ? 'auto' : '520px',
                  minHeight: isAudio ? '240px' : '400px',
                  borderRadius: 14,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Images */}
                {isImage && previewBlobUrl && (
                  <img
                    src={previewBlobUrl}
                    alt={details.file_name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 16 }}
                  />
                )}

                {/* PDFs */}
                {isPdf && previewBlobUrl && (
                  <iframe
                    src={`${previewBlobUrl}#toolbar=0`}
                    title={details.file_name}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                )}

                {/* Audio Player in Vault */}
                {isAudio && previewBlobUrl && (
                  <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 440 }}>
                    <div className="my-files-icon-box my-files-icon--audio" style={{ width: 68, height: 68, borderRadius: 20, marginBottom: 18 }}>
                      <Music size={32} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)', textAlign: 'center', wordBreak: 'break-word' }}>
                      {details.file_name}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px' }}>
                      Decrypted In-Memory Stream ({formatSize(details.size)})
                    </p>
                    <audio
                      src={previewBlobUrl}
                      controls
                      autoPlay
                      controlsList={details.permission === 'download' ? undefined : 'nodownload'}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}

                {/* Video Player in Vault */}
                {isVideo && previewBlobUrl && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <video
                      src={previewBlobUrl}
                      controls
                      autoPlay
                      controlsList={details.permission === 'download' ? undefined : 'nodownload'}
                      style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }}
                    />
                  </div>
                )}

                {/* Text / Code */}
                {isText && (
                  <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: 20 }}>
                    <pre style={{
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                    }}>
                      {previewText}
                    </pre>
                  </div>
                )}

                {/* Unsupported formats */}
                {!isImage && !isPdf && !isAudio && !isVideo && !isText && (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>In-Browser Preview Not Available</p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      This file format cannot be rendered securely in-page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(96, 96, 96, 0.1)', color: 'var(--rose-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ShieldAlert size={28} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Share Unavailable</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {error || 'This share link is expired, revoked, or non-existent.'}
            </p>
          </div>
        )}

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 20,
          paddingTop: 14,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          Protected by TrustShare AES-256 Server-Side Envelope Encryption
        </div>
      </motion.section>
    </main>
  );
}
