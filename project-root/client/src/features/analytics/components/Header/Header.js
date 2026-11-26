// client/src/features/analytics/components/Header/Header.js

import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download, Check, RefreshCw, ChevronDown,
  FileText, FileSpreadsheet, Zap, ZapOff, Shield
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { exportAnalyticsPDF } from "../../services/analyticsService";
import DateRangeDropdown from "./DateRangeDropdown";

export default function Header({
  activeTab,
  setActiveTab,
  data,
  uiConfig,
  dateRange,
  setDateRange,
  onRefresh,
  autoRefreshEnabled = true,
  toggleAutoRefresh,
  lastRefreshedAt,
  nextRefreshIn = 30,
}) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  const isAdmin = user?.role === "admin" || data?.current_user_role === "admin";
  const tabs = uiConfig?.tabs || [];
  const dateRanges = uiConfig?.date_ranges || [];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format = "pdf") => {
    if (exporting || !data) return;

    setShowExportMenu(false);

    const daysMap = { "7days": 7, "30days": 30, "90days": 90, "all": 365 };
    let days       = daysMap[dateRange] || 30;
    let customStart = null;
    let customEnd   = null;

    if (dateRange?.startsWith("custom-")) {
      const parts = dateRange.replace("custom-", "").split("-to-");
      if (parts.length === 2) {
        customStart      = parts[0];
        customEnd        = parts[1];
        const start      = new Date(customStart);
        const end        = new Date(customEnd);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          days = Math.max(
            1,
            Math.min(3650, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1)
          );
        }
      }
    }

    setExporting(true);
    try {
      if (format === "csv") {
        const { exportAnalyticsCSV } = await import("../../services/analyticsService");
        const csvTab = activeTab === "security" ? "security" : "file";
        await exportAnalyticsCSV(csvTab, days, customStart, customEnd);
      } else {
        await exportAnalyticsPDF(activeTab, days, customStart, customEnd);
      }
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const getLastRefreshedText = () => {
    if (!lastRefreshedAt) return "";
    const seconds = Math.floor((Date.now() - lastRefreshedAt) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  };

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="an-header">
      <div className="an-header-left">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="an-header-title">Analytics</h1>
          {isAdmin && (
            <span className="badge badge-purple" style={{ padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Shield size={12} /> Admin Access
            </span>
          )}
        </div>
        <p className="an-header-sub">
          Workspace performance and security insights.
        </p>

        {lastRefreshedAt && (
          <motion.div
            className="an-live-indicator"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {autoRefreshEnabled && (
              <span className="an-live-dot" />
            )}
            <span className="an-live-text">
              {autoRefreshEnabled
                ? `Live · Updated ${getLastRefreshedText()} · Next in ${nextRefreshIn}s`
                : `Updated ${getLastRefreshedText()}`
              }
            </span>
          </motion.div>
        )}
      </div>

      <div className="an-header-right">
        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="an-tab-switch">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`an-tab-btn ${activeTab === t.value ? "an-tab-btn--active" : ""}`}
                onClick={() => setActiveTab(t.value)}
              >
                {activeTab === t.value && (
                  <motion.div
                    className="an-tab-pill"
                    layoutId="an-tab-pill"
                    transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  />
                )}
                <span className="an-tab-btn-label">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        <DateRangeDropdown
          options={dateRanges}
          value={dateRange}
          onChange={setDateRange}
        />

        {toggleAutoRefresh && (
          <motion.button
            className={`an-autorefresh-btn ${autoRefreshEnabled ? "an-autorefresh-btn--active" : ""}`}
            onClick={toggleAutoRefresh}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            title={autoRefreshEnabled ? "Auto-refresh ON (click to disable)" : "Auto-refresh OFF (click to enable)"}
          >
            <AnimatePresence mode="wait">
              {autoRefreshEnabled ? (
                <motion.span
                  key="on"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: "flex" }}
                >
                  <Zap size={14} strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="off"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: "flex" }}
                >
                  <ZapOff size={14} strokeWidth={2.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}

        {/* Refresh button */}
        <motion.button
          className="an-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          title="Refresh data"
        >
          <motion.span
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            style={{ display: "flex" }}
          >
            <RefreshCw size={14} />
          </motion.span>
        </motion.button>

        {/* Export Dropdown Button */}
        <div style={{ position: "relative" }} ref={exportMenuRef}>
          <motion.button
            className={`an-export-btn ${exported ? "an-export-btn--success" : ""}`}
            onClick={() => !exporting && setShowExportMenu(!showExportMenu)}
            disabled={exporting || !data}
            whileHover={!exporting ? { y: -2, boxShadow: "0 12px 24px rgba(96, 96, 96,0.30)" } : {}}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          >
            <AnimatePresence mode="wait">
              {exporting ? (
                <motion.span
                  key="exporting"
                  className="an-export-inner"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <svg className="an-spinner" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Exporting…
                </motion.span>
              ) : exported ? (
                <motion.span
                  key="done"
                  className="an-export-inner"
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Check size={14} />
                  Exported!
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  className="an-export-inner"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                  <Download size={14} />
                  Export Report
                  <motion.span
                    animate={{ rotate: showExportMenu ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: "flex", marginLeft: 2 }}
                  >
                    <ChevronDown size={14} />
                  </motion.span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showExportMenu && !exporting && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  minWidth: 220,
                  background: "var(--an-card-bg, #ffffff)",
                  border: "1px solid var(--an-select-border, #e0e0e0)",
                  borderRadius: 12,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                  padding: 6,
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                {/* PDF Option */}
                <button
                  onClick={() => handleExport("pdf")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                    color: "var(--an-text-primary, #181818)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--an-hover-bg, #f0f0f0)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "rgba(96, 96, 96, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#606060",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Export as PDF</div>
                    <div style={{ fontSize: 11, color: "var(--an-text-secondary, #808080)", marginTop: 2 }}>
                      Formatted report document
                    </div>
                  </div>
                </button>

                {/* Divider */}
                <div style={{ height: 1, background: "var(--an-select-border, #e0e0e0)", margin: "4px 8px" }} />

                {/* CSV Option */}
                <button
                  onClick={() => handleExport("csv")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                    color: "var(--an-text-primary, #181818)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--an-hover-bg, #f0f0f0)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "rgba(160, 160, 160, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#a0a0a0",
                      flexShrink: 0,
                    }}
                  >
                    <FileSpreadsheet size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Export as CSV</div>
                    <div style={{ fontSize: 11, color: "var(--an-text-secondary, #808080)", marginTop: 2 }}>
                      Spreadsheet-friendly data
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
