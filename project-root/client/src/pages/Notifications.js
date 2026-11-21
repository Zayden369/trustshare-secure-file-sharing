import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, ChevronRight, Download, Eye, Share2,
  ShieldAlert, Upload, X, Shield, Clock, HardDrive, Sparkles, Trash2, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../utils/api';
import { events, EVENTS } from '../utils/events';
import './Notifications.css';

const TYPE_STYLE = {
  share: { bg: 'rgba(128, 128, 128,.12)', color: 'var(--blue-400)', Icon: Share2 },
  security: { bg: 'rgba(96, 96, 96,.12)', color: 'var(--rose-400)', Icon: ShieldAlert },
  upload: { bg: 'rgba(160, 160, 160,.12)', color: 'var(--emerald-400)', Icon: Upload },
  access: { bg: 'rgba(160, 160, 160,.12)', color: 'var(--amber-400)', Icon: Eye },
  download: { bg: 'rgba(128, 128, 128,.12)', color: 'var(--purple-400)', Icon: Download },
  summary: { bg: 'rgba(160, 160, 160,.12)', color: 'var(--cyan-400)', Icon: Sparkles },
};

const timeAgo = (dateStr) => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(dateStr)) / 1000));
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

export const getNotificationAction = (notification) => {
  const type = notification.type || '';
  const category = notification.category || '';
  const resourceId = notification.resource_id;

  if (type === 'security' || category === 'security') {
    return { label: 'Review active sessions', destination: '/settings?tab=sessions', resourceId: null };
  }
  if (type === 'expiration' || category === 'expirations') {
    return { label: 'Manage share links', destination: '/sharing', resourceId };
  }
  if (resourceId) {
    if (type === 'share' || category === 'shares') {
      return { label: 'View shared file', destination: '/shared-with-me', resourceId };
    }
    if (type === 'download' || category === 'downloads') {
      return { label: 'View file', destination: '/my-files', resourceId };
    }
    if (type === 'upload' || category === 'uploads') {
      return { label: 'Open file', destination: '/my-files', resourceId };
    }
    if (type === 'access') {
      return { label: 'View file', destination: '/my-files', resourceId };
    }
    return { label: 'View file', destination: '/my-files', resourceId };
  }
  if (type === 'share' || category === 'shares') {
    return { label: 'Open shared files', destination: '/shared-with-me', resourceId: null };
  }
  if (type === 'upload' || type === 'summary' || category === 'uploads') {
    return { label: 'Open My Files', destination: '/my-files', resourceId: null };
  }
  return { label: 'View activity log', destination: '/activity', resourceId: null };
};

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const response = await notificationsAPI.list();
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Notifications could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);

    const unsub = events.on(EVENTS.NOTIFICATIONS_CHANGED, () => load(false));

    const handleFocus = () => load(false);
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      load(false);
    }, 3000);

    return () => {
      unsub();
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const categoryFor = useCallback((notification) => {
    const type = notification.type || '';
    const cat = notification.category || '';
    if (type === 'download') return 'downloads';
    if (type === 'expiration') return 'expirations';
    if (type === 'system' || cat === 'activity' || cat === 'uploads') return 'system';
    return cat;
  }, []);

  const kpiStats = useMemo(() => {
    const stats = { security: 0, shares: 0, system: 0 };
    items.forEach((n) => {
      const cat = categoryFor(n);
      if (cat === 'security' && !n.is_read) stats.security++;
      else if (cat === 'shares' && !n.is_read) stats.shares++;
      else if (!n.is_read) stats.system++;
    });
    return stats;
  }, [items, categoryFor]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((n) => categoryFor(n) === filter);
  }, [items, filter, categoryFor]);

  const markRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
      return true;
    } catch {
      return false;
    }
  };

  const handleCardClick = async (notification) => {
    if (!notification.is_read) {
      await markRead(notification.id);
    }
    const action = getNotificationAction(notification);
    const isSharingPage = action.destination === '/sharing';

    navigate(action.destination, {
      state: action.resourceId
        ? (isSharingPage ? { highlightShareId: action.resourceId } : { highlightFileId: action.resourceId })
        : undefined,
    });
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await notificationsAPI.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not mark all as read.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    setDeleteFeedback(null);
    try {
      const beforeCount = items.length;
      await notificationsAPI.deleteAll();

      await load(false);
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);

      setShowDeleteConfirm(false);
      setDeleteFeedback({
        success: true,
        message: `${beforeCount} notification${beforeCount === 1 ? '' : 's'} deleted.`
      });
      setTimeout(() => setDeleteFeedback(null), 4000);
    } catch (err) {
      setDeleteFeedback({
        success: false,
        message: err.response?.data?.detail || 'Could not delete notifications.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsAPI.delete(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete notification.');
    }
  };

  const filters = [
    { value: 'all', label: 'All Alerts' },
    { value: 'shares', label: 'Shares' },
    { value: 'security', label: 'Security' },
    { value: 'downloads', label: 'Downloads' },
    { value: 'expirations', label: 'Expirations' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="notifications-page fade-in">
      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <h1 className="flat-page-title">Notifications</h1>
          <p className="flat-page-subtitle">Monitor secure document downloads, access requests, expirations, and security updates.</p>
        </div>
        <div className="flat-header-actions">
          {items.length > 0 && (
            <>
              <button
                type="button"
                className="my-files-btn my-files-btn--danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                style={{ padding: '8px 14px', fontSize: 12 }}
              >
                <Trash2 size={14} strokeWidth={2.2} />
                {deleting ? 'Deleting…' : 'Delete All'}
              </button>
              {unreadCount > 0 && (
                <button type="button" className="my-files-btn my-files-btn--primary" onClick={markAll} disabled={busy}>
                  <CheckCheck size={15} strokeWidth={2.2} />
                  {busy ? 'Updating…' : 'Mark All Read'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {deleteFeedback && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 500,
            background: deleteFeedback.success ? 'rgba(160, 160, 160,.12)' : 'rgba(96, 96, 96,.12)',
            color: deleteFeedback.success ? 'var(--emerald-400)' : 'var(--rose-400)',
            border: `1px solid ${deleteFeedback.success ? 'rgba(160, 160, 160,.3)' : 'rgba(96, 96, 96,.3)'}`,
          }}
        >
          {deleteFeedback.success ? <CheckCheck size={16} /> : <AlertTriangle size={16} />}
          <span style={{ flex: 1 }}>{deleteFeedback.message}</span>
          <button
            onClick={() => setDeleteFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
            aria-label="Dismiss feedback banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <section className="sharing-stats-grid">
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon blue"><Bell size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{unreadCount}</span>
            <span className="sharing-stat-label">Unread Alerts</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon" style={{ background: 'rgba(96, 96, 96,.12)', color: 'var(--rose-400)' }}><Shield size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{kpiStats.security}</span>
            <span className="sharing-stat-label">Security Warnings</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon purple"><Share2 size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{kpiStats.shares}</span>
            <span className="sharing-stat-label">Direct Shares</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon emerald"><HardDrive size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{kpiStats.system}</span>
            <span className="sharing-stat-label">Activity Updates</span>
          </div>
        </div>
      </section>

      <section className="notifications-toolbar-row">
        <div className="my-files-chips" style={{ width: '100%' }}>
          {filters.map(({ value, label }) => {
            const count = value === 'all' ? items.length : items.filter((item) => categoryFor(item) === value).length;
            const isActive = filter === value;
            return (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`my-files-chip ${isActive ? 'is-active' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {label}
                <span style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)', color: isActive ? '#fff' : 'var(--text-secondary)', padding: '2px 6px', borderRadius: '999px', fontSize: '11px', fontWeight: '700' }}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="card mb-4" role="alert" style={{ padding: 16, borderColor: 'var(--rose-400)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="text-sm" style={{ margin: 0, color: 'var(--rose-400)' }}>{error}</p>
          <button className="my-files-btn my-files-btn--secondary" style={{ padding: '6px 14px' }} onClick={() => load(true)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="my-files-loading"><div className="my-files-spinner" /><p>Scanning notifications inbox…</p></div>
      ) : filteredItems.length === 0 ? (
        <div className="my-files-empty">
          <div className="my-files-empty-icon"><Bell size={40} /></div>
          <h3 className="my-files-empty-title">{filter === 'all' ? 'All caught up!' : `No ${filter} notifications`}</h3>
          <p className="my-files-empty-subtitle">Secure transfer activity, file downloads, and access alerts will appear here automatically.</p>
        </div>
      ) : (
        <div className="notifications-timeline-list">
          <AnimatePresence initial={false}>
            {filteredItems.map((n) => {
              const style = TYPE_STYLE[n.type] || TYPE_STYLE.access;
              const NotificationIcon = style.Icon;
              const action = getNotificationAction(n);
              const isUnread = !n.is_read;

              return (
                <motion.article
                  key={n.id}
                  className={`notif-timeline-item ${isUnread ? 'is-unread' : ''} notif-row--${n.type}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCardClick(n)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                >
                  <div className="notif-timeline-accent" />
                  <div className="notif-timeline-icon-container">
                    <div className="notif-timeline-icon-box" style={{ background: style.bg, color: style.color }}>
                      <NotificationIcon size={18} strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="notif-timeline-content">
                    <div className="notif-timeline-header-info">
                      <h4 className="notif-timeline-title">{n.title}</h4>
                      <time className="notif-timeline-time"><Clock size={12} style={{ opacity: 0.7 }} />{timeAgo(n.created_at)}</time>
                    </div>
                    <p className="notif-timeline-message">{n.message}</p>
                    <div className="notif-timeline-footer-row">
                      <span className="notif-timeline-category-tag">#{n.category}</span>
                      <span className="notif-timeline-cta-btn">{action.label}<ChevronRight size={14} /></span>
                    </div>
                  </div>
                  <div className="notif-timeline-actions-column">
                    {isUnread && <div className="notif-timeline-unread-indicator" />}
                    <button type="button" className="notif-timeline-delete-btn" aria-label={`Delete: ${n.title}`} onClick={(e) => remove(n.id, e)}>
                      <X size={15} />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              padding: '20px',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-desc"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              className="card"
              style={{ maxWidth: 440, width: '100%', padding: '28px' }}
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(96, 96, 96,.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rose-400)',
                  flexShrink: 0,
                }}>
                  <AlertTriangle size={22} strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    id="delete-confirm-title"
                    style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    Delete All Notifications?
                  </h3>
                  <p
                    id="delete-confirm-desc"
                    style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}
                  >
                    This will permanently remove all {items.length} notification{items.length === 1 ? '' : 's'} from every category. This action cannot be undone.
                  </p>
                </div>
              </div>

              {deleteFeedback && !deleteFeedback.success && (
                <div
                  role="alert"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    background: 'rgba(96, 96, 96,.12)',
                    color: 'var(--rose-400)',
                    border: '1px solid rgba(96, 96, 96,.3)',
                  }}
                >
                  {deleteFeedback.message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="my-files-btn my-files-btn--secondary"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteFeedback(null); }}
                  disabled={deleting}
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="my-files-btn my-files-btn--danger"
                  onClick={deleteAll}
                  disabled={deleting}
                  style={{ padding: '8px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {deleting ? (
                    <>
                      <span className="spinner spinner-sm animate-spin" style={{ width: 14, height: 14 }} />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete All
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
