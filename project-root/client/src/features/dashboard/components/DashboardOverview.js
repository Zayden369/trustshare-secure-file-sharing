import React from 'react';
import {
  Archive,
  Bell,
  Download,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  HardDrive,
  KeyRound,
  Link2,
  LockKeyhole,
  Share2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../layout/PageHeader';

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getFileIcon(mimetype = '') {
  if (mimetype.startsWith('image/')) return FileImage;
  if (mimetype.startsWith('video/')) return FileVideo;
  if (mimetype.startsWith('audio/')) return FileAudio;
  if (mimetype.includes('zip') || mimetype.includes('archive')) return Archive;
  return FileText;
}

function StatCard({ icon: Icon, label, meta, tone, value }) {
  return (
    <article className="dashboard-stat-card">
      <span className={`dashboard-stat-icon dashboard-stat-icon-${tone}`}>
        <Icon aria-hidden="true" size={20} />
      </span>
      <div>
        <p className="dashboard-stat-label">{label}</p>
        <strong className="dashboard-stat-value">{value}</strong>
        <p className="dashboard-stat-meta">{meta}</p>
      </div>
    </article>
  );
}

function PanelHeader({ action, onAction, title }) {
  return (
    <div className="dashboard-panel-header">
      <h2>{title}</h2>
      {action && (
        <button className="dashboard-text-action" onClick={onAction} type="button">
          {action}
        </button>
      )}
    </div>
  );
}

export default function DashboardOverview({ dashboardData = {}, user }) {
  const navigate = useNavigate();
  const analytics = dashboardData?.analytics || {};
  const files = dashboardData?.files || [];
  const notifications = dashboardData?.notifications || [];
  const recentFiles = files.slice(0, 6);
  const recentNotifications = notifications.slice(0, 4);
  const uploadTrend = analytics.upload_trend || [];
  const fileTypes = Object.entries(analytics.top_file_types || {}).sort(
    (left, right) => right[1] - left[1],
  );
  const fileTypeTotal = fileTypes.reduce((total, [, count]) => total + count, 0);
  const maxUploads = Math.max(...uploadTrend.map((item) => item.count), 1);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? 'Good morning'
      : greetingHour < 18
        ? 'Good afternoon'
        : 'Good evening';

  const stats = [
    {
      icon: FileText,
      label: 'Total files',
      meta: 'Stored in your workspace',
      tone: 'blue',
      value: analytics.total_files,
    },
    {
      icon: Link2,
      label: 'Active links',
      meta: `${analytics.total_share_links} total share links`,
      tone: 'purple',
      value: analytics.active_share_links,
    },
    {
      icon: Download,
      label: 'Downloads',
      meta: 'All-time file downloads',
      tone: 'green',
      value: analytics.total_downloads,
    },
    {
      icon: Bell,
      label: 'Unread alerts',
      meta: `${analytics.total_notifications} total notifications`,
      tone: 'amber',
      value: analytics.unread_notifications,
    },
  ];

  return (
    <div className="dashboard-view">
      <PageHeader
        buttonIcon={<Upload aria-hidden="true" size={16} />}
        buttonText="Upload file"
        onButtonClick={() => navigate('/my-files')}
        subtitle={new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(
          new Date(),
        )}
        title={`${greeting}, ${firstName}`}
      />

      <section aria-label="Dashboard statistics" className="dashboard-stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="dashboard-content-grid">
        <div className="dashboard-primary-column">
          <section className="card dashboard-panel">
            <PanelHeader
              action="View all"
              onAction={() => navigate('/my-files')}
              title="Recent files"
            />
            {recentFiles.length === 0 ? (
              <div className="dashboard-empty-state">
                <FolderOpen aria-hidden="true" size={28} />
                <p>No files have been uploaded yet.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/my-files')}
                  type="button"
                >
                  Upload your first file
                </button>
              </div>
            ) : (
              <div className="dashboard-file-list">
                {recentFiles.map((file) => {
                  const FileIcon = getFileIcon(file.mimetype);
                  return (
                    <article className="dashboard-file-row" key={file.id}>
                      <span className="dashboard-file-icon">
                        <FileIcon aria-hidden="true" size={20} />
                      </span>
                      <div className="dashboard-file-copy">
                        <strong title={file.original_name}>{file.original_name}</strong>
                        <span>
                          {formatBytes(file.size)} · {formatDate(file.created_at)}
                        </span>
                      </div>
                      {file.encrypted && (
                        <span className="dashboard-secure-badge">
                          <LockKeyhole aria-hidden="true" size={12} />
                          Encrypted
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card dashboard-panel">
            <PanelHeader title="Quick actions" />
            <div className="dashboard-actions-grid">
              {[
                ['Upload file', Upload, '/my-files'],
                ['Browse files', FolderOpen, '/my-files'],
                ['Create share', Share2, '/sharing'],
                ['Security', ShieldCheck, '/settings?tab=security'],
              ].map(([label, Icon, route]) => (
                <button
                  className="dashboard-action"
                  key={label}
                  onClick={() => navigate(route)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={20} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card dashboard-panel">
            <PanelHeader title="Seven-day upload trend" />
            <div className="dashboard-trend" role="img" aria-label="Uploads during the last seven days">
              {uploadTrend.map((item) => (
                <div className="dashboard-trend-item" key={item.date}>
                  <span className="dashboard-trend-count">{item.count}</span>
                  <div className="dashboard-trend-track">
                    <span
                      className="dashboard-trend-bar"
                      style={{ height: `${Math.max((item.count / maxUploads) * 100, 5)}%` }}
                    />
                  </div>
                  <span className="dashboard-trend-label">{item.date}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-secondary-column">
          <section className="card dashboard-panel">
            <PanelHeader title="Storage" />
            <div className="dashboard-storage-summary">
              <span className="dashboard-storage-icon">
                <HardDrive aria-hidden="true" size={22} />
              </span>
              <div>
                <strong>{analytics.storage.used_gb} GB used</strong>
                <p>of {analytics.storage.quota_gb} GB</p>
              </div>
            </div>
            <div className="dashboard-progress" aria-label={`${analytics.storage.percent}% storage used`}>
              <span style={{ width: `${Math.min(analytics.storage.percent, 100)}%` }} />
            </div>
            <p className="dashboard-panel-note">{analytics.storage.percent}% of storage used</p>
          </section>

          <section className="card dashboard-panel">
            <PanelHeader title="File types" />
            {fileTypes.length === 0 ? (
              <p className="dashboard-panel-note">No file-type data available.</p>
            ) : (
              <div className="dashboard-type-list">
                {fileTypes.slice(0, 5).map(([type, count]) => (
                  <div className="dashboard-type-row" key={type}>
                    <div className="dashboard-type-copy">
                      <span>{type.toUpperCase()}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="dashboard-type-track">
                      <span style={{ width: `${(count / fileTypeTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card dashboard-panel">
            <PanelHeader
              action="Manage"
              onAction={() => navigate('/sharing')}
              title="Active shares"
            />
            <div className="dashboard-share-summary">
              <span>
                <Link2 aria-hidden="true" size={18} />
                Active links
              </span>
              <strong>{analytics.active_share_links}</strong>
            </div>
            <div className="dashboard-share-summary">
              <span>
                <Download aria-hidden="true" size={18} />
                Total accesses
              </span>
              <strong>{analytics.total_share_views}</strong>
            </div>
          </section>

          <section className="card dashboard-panel">
            <PanelHeader
              action="View all"
              onAction={() => navigate('/notifications')}
              title="Notifications"
            />
            {recentNotifications.length === 0 ? (
              <p className="dashboard-panel-note">No notifications available.</p>
            ) : (
              <div className="dashboard-notification-list">
                {recentNotifications.map((notification) => (
                  <article className="dashboard-notification" key={notification.id}>
                    <span className={notification.is_read ? '' : 'is-unread'} />
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <time dateTime={notification.created_at}>
                        {formatDate(notification.created_at)}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card dashboard-panel">
            <PanelHeader title="Security" />
            <div className="dashboard-security-row">
              <span>
                <KeyRound aria-hidden="true" size={18} />
                Multi-factor authentication
              </span>
              <strong className={user?.mfa_enabled ? 'is-positive' : 'is-warning'}>
                {user?.mfa_enabled ? 'Enabled' : 'Disabled'}
              </strong>
            </div>
            <div className="dashboard-security-row">
              <span>
                <LockKeyhole aria-hidden="true" size={18} />
                Encrypted files
              </span>
              <strong className="is-positive">
                {analytics.encrypted_files}
              </strong>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
