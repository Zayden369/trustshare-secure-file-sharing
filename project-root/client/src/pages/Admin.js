import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Users, Shield, ShieldCheck, ShieldAlert, Activity, HardDrive,
  Link2, Database, Server, Clock, AlertTriangle, CheckCircle2,
  Search, RefreshCw, UserCheck, UserX, KeyRound, Lock, Eye,
  Globe, FileText, BadgeCheck, AlertCircle, Share2
} from 'lucide-react';
import { adminAPI, auditAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const timeAgo = (d) => {
  if (!d) return '—';
  const secs = Math.floor((Date.now() - new Date(d)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
};

const LEVEL_BADGE = {
  info: 'badge-blue',
  warn: 'badge-amber',
  warning: 'badge-amber',
  error: 'badge-rose',
  success: 'badge-emerald',
  critical: 'badge-rose',
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users');

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [editingUserRoleId, setEditingUserRoleId] = useState(null);

  const [auditSearch, setAuditSearch] = useState('');
  const [auditLevelFilter, setAuditLevelFilter] = useState('all');

  const [highlightUserId, setHighlightUserId] = useState(location.state?.highlightUserId || null);
  const highlightRef = useRef(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        adminAPI.listUsers(),
        auditAPI.list(100),
        adminAPI.getStats().catch(() => null),
      ]);
      setUsers(Array.isArray(uRes.data) ? uRes.data : []);
      setLogs(Array.isArray(lRes.data) ? lRes.data : []);
      setStats(sRes?.data || null);
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard'); return; }
    loadData(true);
    const interval = setInterval(() => loadData(false), 10000);
    return () => clearInterval(interval);
  }, [user, navigate, loadData]);

  useEffect(() => {
    if (!highlightUserId || loading) return;
    setTab('users');
    setTimeout(() => {
      if (highlightRef.current) highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    const timer = setTimeout(() => setHighlightUserId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightUserId, loading]);

  const toggleActive = async (u) => {
    try {
      await adminAPI.updateUser(u.id, { role: u.role, is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
    } catch (err) {
      console.error('Failed to toggle user:', err);
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole.toLowerCase()) {
      setEditingUserRoleId(null);
      return;
    }
    try {
      await adminAPI.updateUser(targetUser.id, { role: newRole.toLowerCase(), is_active: targetUser.is_active });
      setUsers(prev => prev.map(x => x.id === targetUser.id ? { ...x, role: newRole.toLowerCase() } : x));
    } catch (err) {
      console.error('Failed to update user role:', err);
    } finally {
      setEditingUserRoleId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const needle = userSearch.toLowerCase();
      const matchesSearch = !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle);
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const needle = auditSearch.toLowerCase();
      const matchesSearch =
        !needle ||
        (l.action || '').toLowerCase().includes(needle) ||
        (l.resource_name || '').toLowerCase().includes(needle) ||
        (l.resource_type || '').toLowerCase().includes(needle) ||
        (l.user_email || '').toLowerCase().includes(needle) ||
        (l.ip_address || '').toLowerCase().includes(needle) ||
        (l.details || '').toLowerCase().includes(needle);

      const level = (l.level || 'info').toLowerCase();
      const matchesLevel =
        auditLevelFilter === 'all' ||
        (auditLevelFilter === 'info' && level === 'info') ||
        (auditLevelFilter === 'warn' && (level === 'warn' || level === 'warning')) ||
        (auditLevelFilter === 'error' && (level === 'error' || level === 'critical'));

      return matchesSearch && matchesLevel;
    });
  }, [logs, auditSearch, auditLevelFilter]);

  const tabs = [
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'audit', label: 'Audit Log', icon: FileText, count: logs.length },
    { id: 'security', label: 'Security', icon: ShieldAlert, count: stats?.flagged_events || 0 },
    { id: 'system', label: 'System', icon: Server, count: null },
  ];

  if (user?.role !== 'admin') return null;

  return (
    <div className="my-files-page fade-in">
      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <h1 className="flat-page-title">Admin Panel</h1>
          <p className="flat-page-subtitle">
            System management, user administration, security monitoring, and infrastructure health.
          </p>
        </div>
        <div className="flat-header-actions">
          <span className="badge badge-purple" style={{ padding: '6px 14px', fontSize: 12 }}>
            <Shield size={12} /> Admin Access
          </span>
          <button type="button" className="my-files-btn my-files-btn--secondary" onClick={() => loadData(true)}>
            <RefreshCw size={15} strokeWidth={2.2} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <section className="sharing-stats-grid">
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon blue"><Users size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats?.total_users || users.length}</span>
            <span className="sharing-stat-label">Total Users</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon emerald"><UserCheck size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats?.active_users || users.filter(u => u.is_active).length}</span>
            <span className="sharing-stat-label">Active Users</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon purple"><HardDrive size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{formatBytes(stats?.total_storage_bytes || 0)}</span>
            <span className="sharing-stat-label">Total Storage</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon" style={{ background: 'rgba(96, 96, 96,.12)', color: 'var(--rose-400)' }}><ShieldAlert size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats?.flagged_events || 0}</span>
            <span className="sharing-stat-label">Flagged Events</span>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="activity-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`activity-tab-btn ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={15} />
            {t.label}
            {t.count !== null && <span className="activity-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="my-files-loading"><div className="my-files-spinner" /><p>Loading admin data…</p></div>
      ) : tab === 'users' ? (
        <>
          {/* User Search & Filters */}
          <section className="activity-toolbar">
            <div className="activity-search-wrap">
              <Search size={16} className="activity-search-icon" />
              <input className="activity-search-input" placeholder="Search users by name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <div className="activity-toolbar-right">
              <select className="activity-date-select" value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="member">Members</option>
              </select>
            </div>
          </section>

          {/* User Table */}
          <div className="my-files-list" style={{ marginTop: '4px' }}>
            <div className="my-files-list-header" style={{ gridTemplateColumns: '40px 1.5fr 1fr 1fr 1fr 1fr 140px', padding: '12px 20px' }}>
              <div />
              <div>User Identity</div>
              <div>System Role</div>
              <div>License Plan</div>
              <div>MFA Setup</div>
              <div>Storage quota</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="my-files-empty" style={{ padding: '48px 16px' }}>
                <div className="my-files-empty-icon"><Users size={32} /></div>
                <h3 className="my-files-empty-title">No matching users</h3>
              </div>
            ) : filteredUsers.map(u => {
              const isHighlighted = highlightUserId === u.id;
              return (
                <div
                  key={u.id}
                  ref={isHighlighted ? highlightRef : null}
                  className="my-files-list-row"
                  style={{
                    gridTemplateColumns: '40px 1.5fr 1fr 1fr 1fr 1fr 140px',
                    padding: '12px 20px',
                    alignItems: 'center',
                    background: isHighlighted ? 'rgba(128, 128, 128, 0.05)' : '',
                    borderColor: isHighlighted ? 'var(--blue-500)' : '',
                  }}
                >
                  <div />
                  {/* Identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div className="avatar av-sm" style={{ background: 'linear-gradient(135deg,#808080,#808080)', flexShrink: 0 }}>
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</span>
                    </div>
                  </div>

                  {/* Role Inline Edit */}
                  <div>
                    {editingUserRoleId === u.id && u.id !== user?.id ? (
                      <select
                        className="form-select-custom"
                        style={{ padding: '4px 24px 4px 10px', fontSize: 11, borderRadius: 8, height: 'auto', width: '110px' }}
                        defaultValue={u.role}
                        autoFocus
                        onBlur={(e) => handleRoleChange(u, e.target.value)}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <button
                        type="button"
                        className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}
                        style={{ cursor: u.id === user?.id ? 'not-allowed' : 'pointer', border: 'none' }}
                        onClick={() => u.id !== user?.id && setEditingUserRoleId(u.id)}
                        title={u.id !== user?.id ? "Click to change role" : undefined}
                      >
                        {u.role}
                      </button>
                    )}
                  </div>

                  {/* Status / Plan */}
                  <div>
                    <span className={`badge ${u.plan === 'enterprise' ? 'badge-emerald' : 'badge-cyan'}`}>{u.plan}</span>
                  </div>

                  {/* MFA */}
                  <div>
                    {u.mfa_enabled ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-success"><BadgeCheck size={14} /> Active</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted"><AlertCircle size={14} /> Off</span>
                    )}
                  </div>

                  {/* Storage */}
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <strong>{formatBytes(u.storage_used)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> / {formatBytes(u.storage_quota)}</span>
                  </div>

                  {/* Actions */}
                  <div className="my-files-list-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`my-files-btn ${u.is_active ? 'my-files-btn--danger' : 'my-files-btn--primary'}`}
                      style={{ fontSize: 11, padding: '4px 12px' }}
                      onClick={() => toggleActive(u)}
                      disabled={u.id === user?.id}
                    >
                      {u.is_active ? 'Suspend' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : tab === 'audit' ? (
        <>
          {/* Audit Search & Filter Toolbar */}
          <section className="activity-toolbar" style={{ marginBottom: '14px' }}>
            <div className="activity-search-wrap">
              <Search size={16} className="activity-search-icon" />
              <input
                className="activity-search-input"
                placeholder="Search audit events, actions, resources, or IP addresses…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <div className="activity-toolbar-right">
              <select
                className="activity-date-select"
                value={auditLevelFilter}
                onChange={(e) => setAuditLevelFilter(e.target.value)}
              >
                <option value="all">All Severity Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warning / Alert</option>
                <option value="error">Error / Critical</option>
              </select>
            </div>
          </section>

          {/* Audit Log Table */}
          {filteredLogs.length === 0 ? (
            <div className="my-files-empty" style={{ padding: '48px 16px' }}>
              <div className="my-files-empty-icon"><FileText size={36} /></div>
              <h3 className="my-files-empty-title">
                {auditSearch || auditLevelFilter !== 'all' ? 'No matching audit logs' : 'No audit events'}
              </h3>
              <p className="my-files-empty-subtitle">
                {auditSearch || auditLevelFilter !== 'all' ? 'Try clearing your search terms or filters.' : 'System-wide audit trail logs will render dynamically.'}
              </p>
            </div>
          ) : (
            <div className="my-files-list" style={{ marginTop: '4px' }}>
              <div
                className="my-files-list-header"
                style={{ gridTemplateColumns: '36px 1.4fr 1.2fr 1fr 1fr 120px', padding: '12px 20px' }}
              >
                <div />
                <div>Action & Severity</div>
                <div>Target Resource</div>
                <div>User / Initiator</div>
                <div>IP & Connection</div>
                <div style={{ textAlign: 'right' }}>Timestamp</div>
              </div>

              {filteredLogs.map((l) => {
                const level = (l.level || 'info').toLowerCase();
                const isFlagged = ['warn', 'warning', 'error', 'critical'].includes(level);

                return (
                  <div
                    key={l.id}
                    className="my-files-list-row"
                    style={{
                      gridTemplateColumns: '36px 1.4fr 1.2fr 1fr 1fr 120px',
                      padding: '12px 20px',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: isFlagged ? 'rgba(96, 96, 96,.12)' : 'rgba(128, 128, 128,.12)',
                          color: isFlagged ? 'var(--rose-400)' : 'var(--blue-400)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isFlagged ? <AlertTriangle size={14} /> : <Activity size={14} />}
                      </div>
                    </div>

                    {/* Action & Severity */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {l.action}
                        </strong>
                        <span className={`badge ${LEVEL_BADGE[level] || 'badge-blue'}`} style={{ fontSize: 10 }}>
                          {l.level || 'info'}
                        </span>
                      </div>
                      {l.details && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.details}
                        </span>
                      )}
                    </div>

                    {/* Target Resource */}
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', minWidth: 0 }}>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.resource_name || 'System / Account'}
                      </strong>
                      {l.resource_type && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.resource_type}</span>
                      )}
                    </div>

                    {/* User / Initiator */}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 0 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.user_email || l.user_id || 'System Event'}
                      </span>
                    </div>

                    {/* IP Address */}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {l.ip_address ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Globe size={11} /> {l.ip_address}
                        </span>
                      ) : (
                        'Internal'
                      )}
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {timeAgo(l.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : tab === 'security' ? (
        <div className="sharing-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="sharing-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="var(--rose-400)" /> Security Overview
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>MFA Adoption</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald-400)' }}>
                  {stats?.mfa_enabled_count || 0} / {stats?.total_users || 0} users
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Logins (24h)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)' }}>{stats?.login_events_24h || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Failed Logins (24h)</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: (stats?.failed_logins_24h || 0) > 0 ? 'var(--rose-400)' : 'var(--emerald-400)' }}>
                  {stats?.failed_logins_24h || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Flagged Events</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: (stats?.flagged_events || 0) > 0 ? 'var(--amber-400)' : 'var(--emerald-400)' }}>
                  {stats?.flagged_events || 0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Encryption Standard</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald-400)' }}><Lock size={12} /> AES-256 Active</span>
              </div>
            </div>
          </div>

          {/* Sharing Reports Progress Bars */}
          <div className="sharing-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Share2 size={18} color="var(--purple-400)" /> Sharing Reports
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: "External shares active", value: stats?.active_shares || 0, denominator: stats?.total_shares || 1, color: "linear-gradient(90deg, #808080, #606060)" },
                { label: "Password protected shares", value: stats?.password_protected_shares || 0, denominator: stats?.active_shares || 1, color: "linear-gradient(90deg, #a0a0a0, #808080)" },
                { label: "Links expiring in 48h", value: stats?.expiring_soon_shares || 0, denominator: stats?.active_shares || 1, color: "linear-gradient(90deg, #a0a0a0, #808080)" },
                { label: "Shares without expiry", value: stats?.no_expiry_shares || 0, denominator: stats?.active_shares || 1, color: "linear-gradient(90deg, #606060, #404040)" },
              ].map((row) => {
                const percentage = Math.round((row.value / row.denominator) * 100) || 0;
                return (
                  <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{row.value} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({percentage}%)</span></strong>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: row.color, borderRadius: '999px', width: `${percentage}%`, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
              
              {stats?.no_expiry_shares > 0 && (
                <div style={{
                  marginTop: 4,
                  padding: '10px 14px',
                  background: 'rgba(160, 160, 160, 0.06)',
                  border: '1px dashed rgba(160, 160, 160, 0.3)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <AlertTriangle size={13} color="var(--amber-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{stats?.no_expiry_shares} links</strong> have no expiration date. Add expiry dates to improve your workspace's security posture.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* System Tab with Pulsing Services */
        <div className="sharing-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="sharing-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="var(--blue-400)" /> Infrastructure Health
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { name: 'API Gateway', status: 'Healthy', ok: true },
                { name: 'Auth Service', status: 'Running', ok: true },
                { name: 'File Service', status: 'Running', ok: true },
                { name: 'Encryption Service', status: 'AES-256 Active', ok: true },
                { name: 'Sharing Service', status: 'Running', ok: true },
                { name: `${stats?.db_engine || 'PostgreSQL'} DB`, status: 'Connected', ok: true },
              ].map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ position: 'relative', width: '12px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.ok ? 'var(--emerald-500)' : 'var(--rose-500)' }} />
                      {s.ok && (
                        <div className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--emerald-500)', opacity: 0.4 }} />
                      )}
                    </div>
                    <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: s.ok ? 'var(--emerald-400)' : 'var(--rose-400)', fontSize: 12 }}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sharing-card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="var(--emerald-400)" /> Storage & Resources
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Storage Used</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(stats?.total_storage_bytes || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Files</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{stats?.total_files || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Audit Log Entries</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{stats?.total_audit_events || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>System Status</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald-400)' }}><CheckCircle2 size={12} /> {stats?.uptime_info || 'Running'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
