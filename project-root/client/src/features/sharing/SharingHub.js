import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Link2, Users, Search, Copy, Check, Lock,
  Calendar, Eye, Download, Trash2, ExternalLink,
  ShieldCheck, Clock, Share2
} from 'lucide-react';
import { sharesAPI, filesAPI, sharedWithMeAPI } from '../../utils/api';
import { events, EVENTS } from '../../utils/events';
import CreateLinkModal from './components/CreateLinkModal';
import DirectShareModal from './components/DirectShareModal';
import ConfirmModal from '../myFiles/components/ConfirmModal';
import SharedFileIcon from '../sharedWithMe/components/SharedFileIcon';
import { useLocation } from 'react-router-dom';
import './sharing.css';

export const getShareStatus = (share, now = new Date()) => {
  if (!share) return 'revoked';
  if (!share.is_active) return 'revoked';
  if (share.expires_at && new Date(share.expires_at) <= now) return 'expired';
  if (share.max_views != null && share.access_count >= share.max_views) return 'limit-reached';
  return 'active';
};

const formatAccessTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function SharingHub() {
  const [activeTab, setActiveTab] = useState('links');
  const [shares, setShares] = useState([]);
  const [files, setFiles] = useState([]);
  const [directShares, setDirectShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const location = useLocation();
  const [highlightShareId, setHighlightShareId] = useState(null);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [sharesRes, filesRes, directRes] = await Promise.all([
        sharesAPI.list(),
        filesAPI.list(),
        sharedWithMeAPI.listDirect(),
      ]);

      const rawShares = sharesRes.data;
      const parsedShares = Array.isArray(rawShares)
        ? rawShares
        : Array.isArray(rawShares?.shares)
        ? rawShares.shares
        : [];
      setShares(parsedShares);

      const rawFiles = filesRes.data;
      const parsedFiles = Array.isArray(rawFiles)
        ? rawFiles
        : Array.isArray(rawFiles?.files)
        ? rawFiles.files
        : [];
      setFiles(parsedFiles);

      const rawDirect = directRes.data;
      const parsedDirect = Array.isArray(rawDirect)
        ? rawDirect
        : Array.isArray(rawDirect?.shares)
        ? rawDirect.shares
        : [];
      setDirectShares(parsedDirect);
    } catch (err) {
      if (showSpinner) showToast('Failed to load sharing records', true);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const targetId = location.state?.highlightShareId || location.state?.highlightFileId;
    if (targetId) {
      setHighlightShareId(targetId);
      setActiveTab('links');
      setFilterType('all');
      setSearchQuery('');
      const timer = setTimeout(() => {
        setHighlightShareId(null);
        window.history.replaceState({}, document.title);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state?.highlightShareId, location.state?.highlightFileId]);

  useEffect(() => {
    if (highlightShareId && (shares.length > 0 || directShares.length > 0)) {
      const scrollTimer = setTimeout(() => {
        const el =
          document.querySelector(`[data-share-id="${highlightShareId}"]`) ||
          document.querySelector(`[data-file-id="${highlightShareId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(scrollTimer);
    }
  }, [highlightShareId, shares.length, directShares.length]);

  useEffect(() => {
    loadData(true);

    const unsubNotifs = events.on(EVENTS.NOTIFICATIONS_CHANGED, () => loadData(false));
    const unsubUpload = events.on(EVENTS.FILE_UPLOADED, () => loadData(false));

    const handleFocus = () => loadData(false);
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => loadData(false), 3000);

    return () => {
      unsubNotifs();
      unsubUpload();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadData]);

  const handleCreateShareLink = async (payload) => {
    setIsSubmitting(true);
    try {
      await sharesAPI.create(payload);
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
      showToast('Secure share link created successfully!');
      setShowCreateModal(false);
      await loadData(false);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create share link', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDirectShare = async (payload) => {
    setIsSubmitting(true);
    try {
      await sharedWithMeAPI.shareDirect(payload);
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
      showToast(`Access granted to ${payload.recipient_email}!`);
      setShowDirectModal(false);
      await loadData(false);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to grant teammate access', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetLinkPermission = async (share, newPermission) => {
    if (share.permission === newPermission) return;
    try {
      await sharesAPI.updatePermission(share.id, newPermission);
      showToast(`Link permission updated to "${newPermission === 'download' ? 'Download' : 'View Only'}"`);
      loadData(false);
    } catch (err) {
      showToast('Failed to update link permission.', true);
    }
  };

  const handleSetDirectPermission = async (ds, newPermission) => {
    if (ds.permission === newPermission) return;
    try {
      await sharedWithMeAPI.updateDirectPermission(ds.permission_id, newPermission);
      showToast(`Teammate permission updated to "${newPermission === 'download' ? 'Download' : 'View Only'}"`);
      loadData(false);
    } catch (err) {
      showToast('Failed to update teammate permission.', true);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      if (revokeTarget.type === 'link') {
        await sharesAPI.revoke(revokeTarget.id);
        showToast('Share link revoked.');
      } else {
        await sharedWithMeAPI.revokeDirect(revokeTarget.id);
        showToast('Teammate access removed.');
      }
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
      await loadData(false);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Revocation failed', true);
    } finally {
      setRevokeTarget(null);
    }
  };

  // ── FIX: BULLETPROOF CLIPBOARD COPY FOR NON-HTTPS (HTTP) DEPLOYMENTS ──
  const copyToClipboard = async (text, id) => {
    let success = false;
    
    // 1. Try modern clipboard API first (Localhost or HTTPS only)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('Modern clipboard API failed, attempting fallback...', err);
      }
    }

    // 2. Fallback: Invisible Textarea DOM injection (Works everywhere, including plain HTTP)
    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Fallback copy process failed entirely:', err);
      }
    }

    if (success) {
      setCopiedId(id);
      showToast('Secure link copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      showToast('Failed to copy link automatically.', true);
    }
  };

  // ── FIX: BULLETPROOF WEB SHARE API FOR DESKTOP & NON-HTTPS (HTTP) ──
  const handleNativeShare = async (share) => {
    // navigator.share strictly requires HTTPS and user engagement
    if (navigator.share && window.isSecureContext) {
      try {
        await navigator.share({
          title: `TrustShare Secure Link: ${share.file_name || 'Document'}`,
          text: `Here is a secure zero-knowledge encrypted file link via TrustShare:`,
          url: share.link,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') {
          return; // User canceled the native share sheet
        }
        console.warn('Native Web Share failed, falling back to copy...', err);
      }
    }

    // If HTTP deployment or Unsupported Desktop Browser, fall back to copy
    await copyToClipboard(share.link, share.id);
  };

  const safeShares = useMemo(() => (Array.isArray(shares) ? shares : []), [shares]);
  const safeDirectShares = useMemo(() => (Array.isArray(directShares) ? directShares : []), [directShares]);

  const activeLinksCount = useMemo(() => {
    return safeShares.filter((s) => getShareStatus(s) === 'active').length;
  }, [safeShares]);

  const totalLinkViews = useMemo(() => {
    return safeShares.reduce((acc, s) => acc + (s?.access_count || 0), 0);
  }, [safeShares]);

  const filteredShares = useMemo(() => {
    return safeShares.filter((s) => {
      const status = getShareStatus(s);
      const name = (s?.file_name || '').toLowerCase();
      const token = (s?.token || '').toLowerCase();
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = name.includes(q) || token.includes(q);

      if (!matchesSearch) return false;
      if (filterType === 'active') return status === 'active';
      if (filterType === 'password') return s?.password_protected === true;
      if (filterType === 'expired') return status === 'expired' || status === 'revoked' || status === 'limit-reached';
      return true;
    });
  }, [safeShares, searchQuery, filterType]);

  const filteredDirectShares = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return safeDirectShares.filter((ds) => {
      return (
        (ds?.file_name || '').toLowerCase().includes(q) ||
        (ds?.recipient_email || '').toLowerCase().includes(q) ||
        (ds?.recipient_name || '').toLowerCase().includes(q)
      );
    });
  }, [safeDirectShares, searchQuery]);

  return (
    <div className="sharing-page fade-in">
      {/* Notification Toast */}
      {toast && (
        <div className={`my-files-toast ${toast.isError ? 'is-error' : 'is-success'}`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <h1 className="flat-page-title">Sharing Center</h1>
          <p className="flat-page-subtitle">Distribute encrypted files via temporary access links or grant direct permissions to teammates.</p>
        </div>
        <div className="flat-header-actions">
          <button
            type="button"
            className="my-files-btn my-files-btn--secondary"
            onClick={() => setShowDirectModal(true)}
          >
            <Users size={15} strokeWidth={2.2} />
            Share with Teammate
          </button>
          <button
            type="button"
            className="my-files-btn my-files-btn--primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Link2 size={15} strokeWidth={2.2} />
            Create Share Link
          </button>
        </div>
      </div>

      {/* KPI Stats (Fixed Grid Layout) */}
      <section className="sharing-stats-grid">
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon blue"><Link2 size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{activeLinksCount}</span>
            <span className="sharing-stat-label">Active Share Links</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon purple"><Users size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{safeDirectShares.length}</span>
            <span className="sharing-stat-label">Teammate Grants</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon emerald"><Eye size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{totalLinkViews}</span>
            <span className="sharing-stat-label">Total Link Views</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon amber"><ShieldCheck size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">AES-256</span>
            <span className="sharing-stat-label">Encrypted file storage</span>
          </div>
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="sharing-tabs">
        <button
          className={`sharing-tab-btn ${activeTab === 'links' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          <Link2 size={16} />
          Public Share Links
          <span className="sharing-tab-badge">{safeShares.length}</span>
        </button>
        <button
          className={`sharing-tab-btn ${activeTab === 'direct' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          <Users size={16} />
          Direct Teammates
          <span className="sharing-tab-badge">{safeDirectShares.length}</span>
        </button>
      </div>

      {/* Toolbar */}
      <section className="sharing-toolbar">
        <div className="sharing-search-wrap">
          <Search size={16} className="sharing-search-icon" />
          <input
            className="sharing-search-input"
            placeholder={activeTab === 'links' ? "Search link names or tokens…" : "Search teammate email or file…"}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'links' && (
          <div className="my-files-chips">
            <button
              className={`my-files-chip ${filterType === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Links ({safeShares.length})
            </button>
            <button
              className={`my-files-chip ${filterType === 'active' ? 'is-active' : ''}`}
              onClick={() => setFilterType('active')}
            >
              Active ({activeLinksCount})
            </button>
            <button
              className={`my-files-chip ${filterType === 'password' ? 'is-active' : ''}`}
              onClick={() => setFilterType('password')}
            >
              Password Protected
            </button>
            <button
              className={`my-files-chip ${filterType === 'expired' ? 'is-active' : ''}`}
              onClick={() => setFilterType('expired')}
            >
              Expired / Revoked
            </button>
          </div>
        )}
      </section>

      {/* Content Body */}
      {loading ? (
        <div className="my-files-loading">
          <div className="my-files-spinner" />
          <p>Loading share permissions…</p>
        </div>
      ) : activeTab === 'links' ? (
        filteredShares.length === 0 ? (
          <div className="my-files-empty">
            <div className="my-files-empty-icon"><Link2 size={40} /></div>
            <h3 className="my-files-empty-title">No share links found</h3>
            <p className="my-files-empty-subtitle">
              {searchQuery ? "No links match your search." : "Create encrypted external links to share files securely with anyone."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                className="my-files-btn my-files-btn--primary"
                style={{ marginTop: 18 }}
                onClick={() => setShowCreateModal(true)}
              >
                <Link2 size={15} /> Create First Link
              </button>
            )}
          </div>
        ) : (
          <div className="sharing-grid">
            {filteredShares.map((s) => {
              const status = getShareStatus(s);
              const isAlive = status === 'active';
              const isHighlighted =
                highlightShareId &&
                (String(highlightShareId) === String(s.id) ||
                 String(highlightShareId) === String(s.file_id));

              return (
                <div
                  key={s.id}
                  data-share-id={s.id}
                  data-file-id={s.file_id}
                  className={`sharing-card ${!isAlive ? 'is-inactive' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                >
                  <div>
                    <div className="sharing-card-top">
                      <div className="sharing-card-file">
                        <SharedFileIcon mimetype={s.mimetype} name={s.file_name} />
                        <div className="sharing-card-details">
                          <h4 className="sharing-card-title" title={s.file_name || 'Secure File'}>
                            {s.file_name || `File #${s.file_id}`}
                          </h4>
                          <div className="sharing-card-meta">
                            <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {status === 'active' && <span className="badge badge-emerald">Active</span>}
                        {status === 'revoked' && <span className="badge badge-rose">Revoked</span>}
                        {status === 'expired' && <span className="badge badge-amber">Expired</span>}
                        {status === 'limit-reached' && <span className="badge badge-amber">View Limit</span>}
                      </div>
                    </div>

                    <div className="sharing-link-box" style={{ marginTop: 14 }}>
                      <span>{s.link}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="my-files-quick-btn"
                          onClick={() => handleNativeShare(s)}
                          title="Share Link"
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          className="my-files-quick-btn"
                          onClick={() => copyToClipboard(s.link, s.id)}
                          title="Copy Link"
                        >
                          {copiedId === s.id ? <Check size={14} color="var(--emerald-400)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="sharing-pill-row" style={{ marginTop: 12 }}>
                      {/* Segmented Sliding Permission Switch Control */}
                      <div className="sharing-perm-toggle">
                        <button
                          type="button"
                          className={`sharing-perm-toggle-btn ${s.permission === 'view' ? 'is-active view' : ''}`}
                          onClick={() => handleSetLinkPermission(s, 'view')}
                          disabled={!isAlive}
                          style={{ cursor: isAlive ? 'pointer' : 'not-allowed' }}
                        >
                          <Eye size={12} />
                          <span>View Only</span>
                        </button>
                        <button
                          type="button"
                          className={`sharing-perm-toggle-btn ${s.permission === 'download' ? 'is-active download' : ''}`}
                          onClick={() => handleSetLinkPermission(s, 'download')}
                          disabled={!isAlive}
                          style={{ cursor: isAlive ? 'pointer' : 'not-allowed' }}
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>
                      </div>

                      {s.password_protected && (
                        <span className="sharing-security-chip has-password">
                          <Lock size={11} /> Password
                        </span>
                      )}

                      <span className="sharing-security-chip">
                        <Eye size={11} /> {s.access_count}{s.max_views ? `/${s.max_views}` : ''} views
                      </span>

                      {s.last_accessed_at && (
                        <span className="sharing-security-chip">
                          <Clock size={11} /> Last accessed {formatAccessTime(s.last_accessed_at)}
                        </span>
                      )}

                      {s.expires_at && (
                        <span className="sharing-security-chip">
                          <Calendar size={11} /> Expires {new Date(s.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sharing-card-footer">
                    <button
                      className="my-files-btn my-files-btn--secondary"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => window.open(s.link, '_blank')}
                    >
                      <ExternalLink size={13} /> Visit
                    </button>

                    {isAlive && (
                      <button
                        className="my-files-btn my-files-btn--danger"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => setRevokeTarget({ id: s.id, type: 'link', name: s.file_name || s.link })}
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Direct Teammates Tab */
        filteredDirectShares.length === 0 ? (
          <div className="my-files-empty">
            <div className="my-files-empty-icon"><Users size={40} /></div>
            <h3 className="my-files-empty-title">No direct teammate shares</h3>
            <p className="my-files-empty-subtitle">
              Grant permissions directly to colleague accounts using their email.
            </p>
            <button
              type="button"
              className="my-files-btn my-files-btn--primary"
              style={{ marginTop: 18 }}
              onClick={() => setShowDirectModal(true)}
            >
              <Users size={15} /> Share with Teammate
            </button>
          </div>
        ) : (
          <div className="sharing-grid">
            {filteredDirectShares.map((ds) => {
              const isHighlighted =
                highlightShareId &&
                (String(highlightShareId) === String(ds.permission_id) ||
                 String(highlightShareId) === String(ds.file_id));

              return (
                <div
                  key={ds.permission_id}
                  data-share-id={ds.permission_id}
                  data-file-id={ds.file_id}
                  className={`sharing-card ${isHighlighted ? 'is-highlighted' : ''}`}
                >
                  <div>
                    {/* Row 1: Recipient identity with Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div
                        className="avatar av-md"
                        style={{ background: 'linear-gradient(135deg, #808080, #808080)', color: '#fff' }}
                      >
                        {ds.recipient_name?.slice(0, 2).toUpperCase() || 'TM'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ds.recipient_name}
                        </strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ds.recipient_email}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Shared File Info Block */}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}>
                      <SharedFileIcon name={ds.file_name} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ds.file_name}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Shared {new Date(ds.shared_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Row 3: Segmented Sliding Permission Switch Control */}
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-start' }}>
                      <div className="sharing-perm-toggle">
                        <button
                          type="button"
                          className={`sharing-perm-toggle-btn ${ds.permission === 'view' ? 'is-active view' : ''}`}
                          onClick={() => handleSetDirectPermission(ds, 'view')}
                        >
                          <Eye size={12} />
                          <span>View Only</span>
                        </button>
                        <button
                          type="button"
                          className={`sharing-perm-toggle-btn ${ds.permission === 'download' ? 'is-active download' : ''}`}
                          onClick={() => handleSetDirectPermission(ds, 'download')}
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>

                    {/* Row 4: Recipient Activity Tracker */}
                    <div className="sharing-pill-row">
                      <span className="sharing-security-chip">
                        <Eye size={11} /> {ds.access_count || 0} recipient views
                      </span>
                      {ds.last_accessed_at && (
                        <span className="sharing-security-chip">
                          <Clock size={11} /> Last viewed {formatAccessTime(ds.last_accessed_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sharing-card-footer" style={{ justifyContent: 'flex-end' }}>
                    <button
                      className="my-files-btn my-files-btn--danger"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => setRevokeTarget({
                        id: ds.permission_id,
                        type: 'direct',
                        name: `${ds.recipient_name}'s access to ${ds.file_name}`,
                      })}
                    >
                      Remove Access
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      <CreateLinkModal
        isOpen={showCreateModal}
        files={files}
        isSubmitting={isSubmitting}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateShareLink}
      />

      <DirectShareModal
        isOpen={showDirectModal}
        files={files}
        isSubmitting={isSubmitting}
        onClose={() => setShowDirectModal(false)}
        onSubmit={handleCreateDirectShare}
      />

      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
        icon={Trash2}
        title="Revoke Permission?"
        message={`Are you sure you want to revoke ${revokeTarget?.name}? Anyone with this link or permission will immediately lose access.`}
        confirmText="Revoke Access"
        variant="danger"
      />
    </div>
  );
}
