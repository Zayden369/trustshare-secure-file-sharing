// client/src/features/analytics/components/panels/PerformancePanel.js

import React from "react";
import { motion } from "framer-motion";
import {
  Zap, Users, Upload, Download, Share2,
  Clock, Gauge, Activity, Server
} from "lucide-react";
import Card from "../shared/Card";
import Skeleton from "../shared/Skeleton";

const isHidden = (val) => val === null || val === undefined;

export default function PerformancePanel({
  performanceData = null,
  loading = false,
  config = {},
}) {
  const title = config.title || "Performance Metrics";
  const subtitle = config.subtitle || "Concurrent handling & processing speed";

  if (loading) {
    return (
      <Card delay={0.4}>
        <div className="an-card-header">
          <div>
            <h3 className="an-card-title">{title}</h3>
            <p className="an-chart-meta" style={{ marginTop: 4 }}>{subtitle}</p>
          </div>
        </div>
        <div className="an-perf-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      </Card>
    );
  }

  if (!performanceData) {
    return (
      <Card delay={0.4}>
        <div className="an-card-header">
          <div>
            <h3 className="an-card-title">{title}</h3>
            <p className="an-chart-meta" style={{ marginTop: 4 }}>{subtitle}</p>
          </div>
        </div>
        <div className="an-perf-empty">
          <Activity size={40} strokeWidth={1.5} />
          <p>No performance data available.</p>
        </div>
      </Card>
    );
  }

  const {
    active_now,
    peak_concurrent_users,
    peak_hour,
    peak_hour_events,
    concurrent_uploads,
    concurrent_downloads,
    concurrent_shares,
    files_processed,
    avg_file_size_mb,
    max_file_size_mb,
    total_processed_mb,
    avg_processing_time_ms,
    db_response_ms,
    api_status,
    api_color,
    events_per_minute,
  } = performanceData;

  const formatPeakHour = (hour) => {
    if (hour === null || hour === undefined) return "N/A";
    const period = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 || 12;
    return `${h}:00 ${period}`;
  };

  return (
    <Card delay={0.4}>
      <div className="an-card-header">
        <div>
          <h3 className="an-card-title">{title}</h3>
          <p className="an-chart-meta" style={{ marginTop: 4 }}>{subtitle}</p>
        </div>
        <motion.div
          className="an-perf-status-badge"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          style={{
            background: `${api_color}15`,
            color: api_color,
            borderColor: `${api_color}30`,
          }}
        >
          <Zap size={12} strokeWidth={2.5} />
          {api_status}
        </motion.div>
      </div>

      <div className="an-perf-sections">
        {/* ═══ Section 1: CONCURRENT HANDLING ═══ */}
        <div className="an-perf-section">
          <div className="an-perf-section-label">
            <Users size={11} strokeWidth={2.5} />
            Concurrent Handling
          </div>
          <div className="an-perf-grid">
            {!isHidden(active_now) && (
              <PerfStat
                icon={<Users size={16} />}
                value={active_now}
                label="Active Now"
                sub="last 5 minutes"
                color="#a0a0a0"
                delay={0.1}
              />
            )}
            {!isHidden(peak_concurrent_users) && (
              <PerfStat
                icon={<Activity size={16} />}
                value={peak_concurrent_users}
                label="Peak Today"
                sub={peak_hour !== null ? `at ${formatPeakHour(peak_hour)}` : ""}
                color="#808080"
                delay={0.15}
              />
            )}
            <PerfStat
              icon={<Upload size={16} />}
              value={concurrent_uploads}
              label="Uploads/hr"
              sub="last hour"
              color="#808080"
              delay={0.2}
            />
            <PerfStat
              icon={<Download size={16} />}
              value={concurrent_downloads}
              label="Downloads/hr"
              sub="last hour"
              color="#a0a0a0"
              delay={0.25}
            />
          </div>
        </div>

        {/* ═══ Section 2: PROCESSING SPEED ═══ */}
        <div className="an-perf-section">
          <div className="an-perf-section-label">
            <Gauge size={11} strokeWidth={2.5} />
            File Processing Speed
          </div>
          <div className="an-perf-grid">
            <PerfStat
              icon={<Clock size={16} />}
              value={`${avg_processing_time_ms}`}
              unit="ms"
              label="Avg Processing"
              sub="per file"
              color="#a0a0a0"
              delay={0.3}
            />
            <PerfStat
              icon={<Upload size={16} />}
              value={files_processed}
              label="Files Processed"
              sub={`${total_processed_mb.toFixed(1)} MB total`}
              color="#a0a0a0"
              delay={0.35}
            />
            <PerfStat
              icon={<Activity size={16} />}
              value={avg_file_size_mb}
              unit="MB"
              label="Avg Size"
              sub={`max ${max_file_size_mb.toFixed(1)} MB`}
              color="#808080"
              delay={0.4}
            />
            <PerfStat
              icon={<Zap size={16} />}
              value={performanceData.encryption_speed_mbs ?? 10}
              unit="MB/s"
              label="Encryption Speed"
              sub="AES-256"
              color="#606060"
              delay={0.45}
            />
          </div>
        </div>

        {/* ═══ Section 3: API PERFORMANCE ═══ */}
        <div className="an-perf-section">
          <div className="an-perf-section-label">
            <Server size={11} strokeWidth={2.5} />
            API Performance
          </div>
          <div className="an-perf-grid">
            <PerfStat
              icon={<Clock size={16} />}
              value={db_response_ms}
              unit="ms"
              label="DB Response"
              sub={api_status.toLowerCase()}
              color={api_color}
              delay={0.5}
            />

            {!isHidden(events_per_minute) && (
              <PerfStat
                icon={<Activity size={16} />}
                value={events_per_minute}
                label="Events/min"
                sub="throughput"
                color="#808080"
                delay={0.55}
              />
            )}
            <PerfStat
              icon={<Share2 size={16} />}
              value={concurrent_shares}
              label="Shares/hr"
              sub="last hour"
              color="#808080"
              delay={0.6}
            />
            {!isHidden(peak_hour_events) && (
              <PerfStat
                icon={<Activity size={16} />}
                value={peak_hour_events}
                label="Peak Events"
                sub="busiest hour"
                color="#a0a0a0"
                delay={0.65}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PerfStat({ icon, value, unit, label, sub, color, delay }) {
  return (
    <motion.div
      className="an-perf-stat"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -2 }}
    >
      <div
        className="an-perf-stat-icon"
        style={{ background: `${color}15`, color: color }}
      >
        {icon}
      </div>
      <div className="an-perf-stat-body">
        <div className="an-perf-stat-value">
          {value}
          {unit && <span className="an-perf-stat-unit">{unit}</span>}
        </div>
        <div className="an-perf-stat-label">{label}</div>
        {sub && <div className="an-perf-stat-sub">{sub}</div>}
      </div>
    </motion.div>
  );
}
