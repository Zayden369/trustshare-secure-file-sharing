// client/src/layout/UserDropdownMenu.js

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  User,
  KeyRound,
  ShieldCheck,
  LogOut,
  HardDrive,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Archive,
  File as FileIcon,
} from "lucide-react";
import { authAPI } from "../utils/api";
import { events, EVENTS } from "../utils/events";
import "./UserDropdownMenu.css";

const CATEGORY_ICONS = {
  Documents: FileText,
  Media: ImageIcon,
  Archives: Archive,
  Other: FileIcon,
};

export default function UserDropdownMenu({
  open,
  onClose,
  triggerRef,
  user,
  onLogout,
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [freshUser, setFreshUser] = useState(user);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, breakdownRes] = await Promise.all([
        authAPI.me(),
        authAPI.storageBreakdown(),
      ]);
      setFreshUser(userRes.data);
      setBreakdown(breakdownRes.data);
    } catch (err) {
      console.error("Failed to fetch storage data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  useEffect(() => {
    const unsubscribe = events.on(EVENTS.STORAGE_CHANGED, () => {
      if (open) fetchData();
      else setFreshUser(null);
    });
    return unsubscribe;
  }, [open, fetchData]);

  useEffect(() => {
    if (!open || !triggerRef?.current) return;
    const updatePos = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Combine fresh user data while preserving avatar_url from context if not in response
  const displayUser = useMemo(() => {
    const base = freshUser || user;
    if (!base) return user;
    return {
      ...base,
      avatar_url: base.avatar_url || user?.avatar_url || null,
    };
  }, [freshUser, user]);

  const initials = useMemo(() => {
    if (!displayUser?.name) return "TS";
    return displayUser.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }, [displayUser?.name]);

  const storageUsed = displayUser?.storage_used || 0;
  const storageQuota = displayUser?.storage_quota || 5368709120;
  const storagePct = Math.min(
    Math.round((storageUsed / storageQuota) * 100),
    100
  );

  const getStorageStatus = () => {
    if (storagePct >= 95) return { level: "critical", color: "#606060", label: "Critical" };
    if (storagePct >= 80) return { level: "warning", color: "#a0a0a0", label: "Warning" };
    if (storagePct >= 60) return { level: "caution", color: "#c0c0c0", label: "Caution" };
    return { level: "healthy", color: "#a0a0a0", label: "Healthy" };
  };
  const storageStatus = getStorageStatus();
  const showWarning = storagePct >= 80;

  const formatSize = (bytes) => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${kb.toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const usedDisplay = formatSize(storageUsed);
  const totalDisplay = formatSize(storageQuota);

  const roleLabel = {
    admin: "Admin",
    member: "Member",
    guest: "Guest",
  }[displayUser?.role] || "Member";

  const rolePillClass = {
    admin: "user-dropdown-role--admin",
    member: "user-dropdown-role--member",
    guest: "user-dropdown-role--guest",
  }[displayUser?.role] || "user-dropdown-role--member";

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const menuItems = [
    { icon: User, label: "View Profile", onClick: () => handleNavigate("/settings?tab=profile") },
    { icon: KeyRound, label: "Change Password", onClick: () => handleNavigate("/settings?tab=security") },
    { icon: ShieldCheck, label: "Security & MFA", onClick: () => handleNavigate("/settings?tab=security#mfa") },
  ];

  if (!open) return null;

  const activeCategories = breakdown?.categories?.filter((c) => c.size_bytes > 0) || [];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          className="user-dropdown"
          role="menu"
          style={{
            position: "fixed",
            left: pos.left,
            bottom: window.innerHeight - pos.top + 8,
            width: pos.width,
            minWidth: 260,
          }}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        >
          {/* Profile header */}
          <div className="user-dropdown-header">
            <div
              className="user-dropdown-avatar"
              style={{
                background: displayUser?.avatar_url
                  ? "transparent"
                  : (displayUser?.avatar_color || "linear-gradient(135deg, #808080, #606060)"),
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {displayUser?.avatar_url ? (
                <img
                  src={displayUser.avatar_url}
                  alt={displayUser.name || "Profile"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials
              )}
            </div>
            <div className="user-dropdown-identity">
              <div className="user-dropdown-name-row">
                <span className="user-dropdown-name">
                  {displayUser?.name || "Guest User"}
                </span>
                <span className={`user-dropdown-role ${rolePillClass}`}>
                  {roleLabel}
                </span>
              </div>
              <span className="user-dropdown-email">
                {displayUser?.email || "guest@user.com"}
              </span>
            </div>
          </div>

          {/* Storage section */}
          <div className="user-dropdown-storage">
            <div className="user-dropdown-storage-header">
              <div className="user-dropdown-storage-label">
                <HardDrive size={12} />
                <span>Storage</span>
                {loading && (
                  <span className="user-dropdown-storage-loading">•</span>
                )}
              </div>
              <span className="user-dropdown-storage-value">
                {usedDisplay} / {totalDisplay}
              </span>
            </div>

            <div className="user-dropdown-storage-track">
              <motion.div
                className="user-dropdown-storage-fill"
                initial={{ width: 0 }}
                animate={{ width: `${storagePct}%` }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.1 }}
                style={{
                  background:
                    storagePct >= 95
                      ? "linear-gradient(90deg, #606060, #404040)"
                      : storagePct >= 80
                      ? "linear-gradient(90deg, #a0a0a0, #808080)"
                      : storagePct >= 60
                      ? "linear-gradient(90deg, #c0c0c0, #808080)"
                      : "linear-gradient(90deg, #808080, #606060)",
                }}
              />
            </div>

            <div className="user-dropdown-storage-footer">
              <span
                className="user-dropdown-storage-pct"
                style={{ color: storageStatus.color }}
              >
                {storagePct}% used
              </span>
              <span
                className="user-dropdown-storage-status"
                style={{ color: storageStatus.color }}
              >
                {storageStatus.label}
              </span>
            </div>

            {showWarning && (
              <motion.div
                className={`user-dropdown-warning user-dropdown-warning--${storageStatus.level}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.2 }}
              >
                <AlertTriangle size={12} />
                <span>
                  {storagePct >= 95
                    ? "Storage almost full!"
                    : `You're at ${storagePct}% capacity`}
                </span>
              </motion.div>
            )}

            {activeCategories.length > 0 && (
              <motion.div
                className="user-dropdown-breakdown"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <div className="user-dropdown-breakdown-label">Breakdown</div>

                <div className="user-dropdown-breakdown-bar">
                  {activeCategories.map((cat, i) => (
                    <motion.div
                      key={cat.name}
                      className="user-dropdown-breakdown-segment"
                      style={{
                        width: `${cat.pct}%`,
                        background: cat.color,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.pct}%` }}
                      transition={{
                        duration: 0.5,
                        delay: 0.2 + i * 0.05,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                      title={`${cat.name}: ${cat.pct}%`}
                    />
                  ))}
                </div>

                <div className="user-dropdown-breakdown-list">
                  {activeCategories.map((cat, i) => {
                    const Icon = CATEGORY_ICONS[cat.name] || FileIcon;
                    return (
                      <motion.div
                        key={cat.name}
                        className="user-dropdown-breakdown-item"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: 0.25 + i * 0.04 }}
                      >
                        <div className="user-dropdown-breakdown-info">
                          <span
                            className="user-dropdown-breakdown-dot"
                            style={{ background: cat.color }}
                          />
                          <Icon size={11} className="user-dropdown-breakdown-icon" />
                          <span className="user-dropdown-breakdown-name">
                            {cat.name}
                          </span>
                          <span className="user-dropdown-breakdown-count">
                            ({cat.count})
                          </span>
                        </div>
                        <span className="user-dropdown-breakdown-size">
                          {formatSize(cat.size_bytes)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* Menu items */}
          <div className="user-dropdown-menu">
            {menuItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  className="user-dropdown-item"
                  onClick={item.onClick}
                  role="menuitem"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: 0.04 * i + 0.15,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon size={15} className="user-dropdown-item-icon" />
                  <span>{item.label}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="user-dropdown-divider" />

          {/* Sign out */}
          <motion.button
            className="user-dropdown-item user-dropdown-item--danger"
            onClick={() => {
              onClose();
              onLogout();
            }}
            role="menuitem"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.2,
              delay: 0.3,
              ease: [0.32, 0.72, 0, 1],
            }}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={15} className="user-dropdown-item-icon" />
            <span>Sign out</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
