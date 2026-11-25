import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Clock, Download, FileText, Eye, KeyRound,
  LogIn, RefreshCw, Search, Share2, ShieldAlert,
  Sparkles, Trash2, Upload, Monitor, Smartphone, Laptop,
  Globe, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";
import { getActivities, getLoginSessions } from "./activityService";
import "./ActivityPage.css";

const FILTERS = ["All", "Uploads", "Downloads", "Shares", "Logins", "Security"];

function getActionMeta(action = "", level = "info") {
  const n = action.toUpperCase();
  if (n.includes("UPLOAD")) return { Icon: Upload, tone: "success", label: "Upload" };
  if (n.includes("DOWNLOAD")) return { Icon: Download, tone: "purple", label: "Download" };
  if (n.includes("SHARE") || n.includes("REVOKE")) return { Icon: Share2, tone: "blue", label: "Share" };
  if (n.includes("DELETE")) return { Icon: Trash2, tone: "danger", label: "Delete" };
  if (n.includes("LOGIN")) return { Icon: LogIn, tone: level === "error" ? "danger" : "success", label: "Login" };
  if (n.includes("VIEW") || n.includes("ACCESS")) return { Icon: Eye, tone: "blue", label: "Access" };
  if (n.includes("KEY_ROTATION")) return { Icon: KeyRound, tone: "warning", label: "Key Rotation" };
  if (n.includes("SUMMARY")) return { Icon: Sparkles, tone: "purple", label: "AI Summary" };
  if (n.includes("MFA") || n.includes("PASSWORD") || n.includes("RESET")) return { Icon: ShieldAlert, tone: "warning", label: "Security" };
  if (["warn", "warning", "error", "critical"].includes(level)) return { Icon: ShieldAlert, tone: "danger", label: "Security" };
  return { Icon: FileText, tone: "neutral", label: "Activity" };
}

function formatAction(action = "Activity") {
  return action.toLowerCase().split("_").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return "Just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getDeviceIcon(deviceType) {
  if (deviceType === "mobile") return Smartphone;
  if (deviceType === "tablet") return Monitor;
  return Laptop;
}

const isFlagged = (level) => ["warn", "warning", "error", "critical"].includes(level);

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [days, setDays] = useState("all");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [acts, sess] = await Promise.all([
        getActivities(200),
        getLoginSessions().catch(() => []),
      ]);
      setActivities(Array.isArray(acts) ? acts : []);
      setSessions(Array.isArray(sess) ? sess : []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Single unified filter — no conflicting tab + chip systems
  const filteredActivities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = days === "all" ? null : Date.now() - Number(days) * 86400000;

    return activities.filter((item) => {
      const n = (item.action || "").toUpperCase();
      const level = item.level || "info";

      // Filter chip matching
      const matchesFilter = filter === "All" ||
        (filter === "Uploads" && n.includes("UPLOAD")) ||
        (filter === "Downloads" && n.includes("DOWNLOAD")) ||
        (filter === "Shares" && (n.includes("SHARE") || n.includes("REVOKE"))) ||
        (filter === "Logins" && n.includes("LOGIN")) ||
        (filter === "Security" && (isFlagged(level) || n.includes("MFA") || n.includes("PASSWORD") || n.includes("KEY") || n.includes("RESET")));

      const matchesSuspicious = !suspiciousOnly || isFlagged(level);
      const matchesDate = !cutoff || new Date(item.created_at).getTime() >= cutoff;
      const searchable = `${item.action || ""} ${item.resource_name || ""} ${item.resource_type || ""}`.toLowerCase();
      const matchesSearch = !needle || searchable.includes(needle);

      return matchesFilter && matchesSuspicious && matchesDate && matchesSearch;
    });
  }, [activities, days, filter, query, suspiciousOnly]);

  const stats = useMemo(() => ({
    total: activities.length,
    downloads: activities.filter((a) => (a.action || "").toUpperCase().includes("DOWNLOAD")).length,
    logins: activities.filter((a) => (a.action || "").toUpperCase().includes("LOGIN")).length,
    flagged: activities.filter((a) => isFlagged(a.level)).length,
  }), [activities]);

  const exportCSV = () => {
    if (!filteredActivities.length) return;
    const rows = filteredActivities.map((item) => [
      item.created_at, formatAction(item.action), item.resource_type || "", item.resource_name || "", item.level || "info",
    ]);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Timestamp", "Action", "Type", "Resource", "Level"], ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="activity-page fade-in">
      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <h1 className="flat-page-title">Activity & Access Monitoring</h1>
          <p className="flat-page-subtitle">
            Complete audit trail of file access, downloads, logins, and security events.
          </p>
        </div>
        <div className="flat-header-actions">
          <button type="button" className="my-files-btn my-files-btn--secondary" onClick={exportCSV} disabled={!filteredActivities.length}>
            <Download size={15} strokeWidth={2.2} /> Export CSV
          </button>
          <button type="button" className="my-files-btn my-files-btn--secondary" onClick={() => loadData(true)}>
            <RefreshCw size={15} strokeWidth={2.2} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <section className="sharing-stats-grid">
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon blue"><Activity size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats.total}</span>
            <span className="sharing-stat-label">Total Events</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon purple"><Download size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats.downloads}</span>
            <span className="sharing-stat-label">Downloads</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon emerald"><LogIn size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats.logins}</span>
            <span className="sharing-stat-label">Login Events</span>
          </div>
        </div>
        <div className="sharing-stat-card">
          <div className="sharing-stat-icon" style={{ background: "rgba(96, 96, 96,.12)", color: "var(--rose-400)" }}><ShieldAlert size={20} /></div>
          <div className="sharing-stat-info">
            <span className="sharing-stat-value">{stats.flagged}</span>
            <span className="sharing-stat-label">Security Flags</span>
          </div>
        </div>
      </section>

      {/* Single Filter System (chips + search + date) */}
      <section className="activity-toolbar">
        <div className="activity-search-wrap">
          <Search size={16} className="activity-search-icon" />
          <input className="activity-search-input" placeholder="Search actions or file names…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="activity-toolbar-right">
          <select className="activity-date-select" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </section>

      <div className="activity-filter-row">
        {FILTERS.map((f) => (
          <button key={f} className={`my-files-chip ${filter === f ? "is-active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <button className={`activity-suspicious-chip ${suspiciousOnly ? "is-active" : ""}`} onClick={() => setSuspiciousOnly(!suspiciousOnly)}>
          <AlertTriangle size={13} /> Suspicious only
        </button>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, borderColor: "var(--rose-400)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "var(--rose-400)", fontSize: 13 }}>{error}</span>
          <button className="my-files-btn my-files-btn--secondary" style={{ padding: "6px 14px" }} onClick={() => loadData(true)}>Retry</button>
        </div>
      )}

      {/* Activity Timeline */}
      {loading ? (
        <div className="my-files-loading"><div className="my-files-spinner" /><p>Loading activity trail…</p></div>
      ) : filteredActivities.length === 0 ? (
        <div className="my-files-empty">
          <div className="my-files-empty-icon"><Activity size={40} /></div>
          <h3 className="my-files-empty-title">{activities.length ? "No matching activity" : "No activity recorded yet"}</h3>
          <p className="my-files-empty-subtitle">{activities.length ? "Try changing your search or filters." : "Uploads, downloads, shares, and security actions will appear here automatically."}</p>
        </div>
      ) : (
        <div className="activity-timeline">
          {filteredActivities.map((item) => {
            const meta = getActionMeta(item.action, item.level);
            const flagged = isFlagged(item.level);
            const toneClass = flagged ? (item.level === "critical" || item.level === "error" ? "is-danger" : "is-warning") : "is-success";
            return (
              <div key={item.id} className={`activity-timeline-item ${toneClass}`}>
                <div className="activity-timeline-accent" />
                <div className={`activity-timeline-icon tone-${meta.tone}`}><meta.Icon size={18} /></div>
                <div className="activity-timeline-content">
                  <div className="activity-timeline-title">
                    {formatAction(item.action)}
                    {formatAction(item.action).toLowerCase() !== meta.label.toLowerCase() && <span className="my-files-type-chip" style={{ fontSize: 10 }}>{meta.label}</span>}
                  </div>
                  <p className="activity-timeline-desc">{item.resource_name || `${item.resource_type || "Account"} activity`}</p>
                  <div className="activity-timeline-meta">
                    <span className="activity-timeline-time"><Clock size={11} /> {formatTime(item.created_at)}</span>
                    {item.ip_address && <span className="activity-timeline-ip"><Globe size={10} /> {item.ip_address}</span>}
                  </div>
                </div>
                <div className="activity-timeline-right">
                  <span className={`activity-risk-badge ${flagged ? "is-danger" : "is-success"}`}>
                    {flagged ? <><AlertTriangle size={10} /> Flagged</> : <><CheckCircle2 size={10} /> OK</>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Sessions Section (PSD 5.iii) */}
      <section className="activity-sessions-section">
        <button className="activity-sessions-toggle" onClick={() => setShowSessions(!showSessions)}>
          <Monitor size={18} />
          <span>Active Login Sessions</span>
          <span className="activity-tab-badge">{sessions.length}</span>
          {showSessions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSessions && (
          sessions.length === 0 ? (
            <div className="my-files-empty" style={{ padding: "32px 24px" }}>
              <h3 className="my-files-empty-title">No active sessions</h3>
              <p className="my-files-empty-subtitle">Your login sessions will appear here.</p>
            </div>
          ) : (
            <div className="activity-sessions-list">
              {sessions.map((s) => {
                const DeviceIcon = getDeviceIcon(s.device_type);
                return (
                  <div key={s.id} className={`activity-session-card ${s.is_current ? "is-current" : ""}`}>
                    <div className="activity-session-icon"><DeviceIcon size={20} /></div>
                    <div className="activity-session-info">
                      <p className="activity-session-device">{s.device_name || "Unknown Device"}</p>
                      <p className="activity-session-details">
                        {s.browser_name || "Unknown Browser"} · {s.ip_address || "Unknown IP"} · {s.location || "Unknown Location"}
                      </p>
                    </div>
                    <div className="activity-session-right">
                      {s.is_current && (
                        <span className="activity-current-badge"><CheckCircle2 size={11} /> Current</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>
    </div>
  );
}
