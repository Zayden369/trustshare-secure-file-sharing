import React, { useRef, useState, useMemo } from "react";
import BrandMark from '../components/BrandMark';
import { NavLink, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { events, EVENTS } from "../utils/events";
import UserDropdownMenu from "./UserDropdownMenu";
import "./Sidebar.css";

import {
  LayoutDashboard,
  FolderOpen,
  Share2,
  UsersRound,
  Activity,
  Bell,
  BarChart3,
  Shield,
  Settings,
  ChevronUp,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { to: "/my-files",       label: "My Files",       icon: FolderOpen },
  { to: "/sharing",        label: "Sharing",        icon: Share2 },
  { to: "/shared-with-me", label: "Shared with Me", icon: UsersRound },
  { to: "/activity",       label: "Activity",       icon: Activity },
  { to: "/notifications",  label: "Notifications",  icon: Bell, badge: true },
  { to: "/analytics",      label: "Analytics",      icon: BarChart3 },
  { to: "/admin",          label: "Admin",          icon: Shield, adminOnly: true },
  { to: "/settings",       label: "Settings",       icon: Settings },
];

export default function Sidebar({
  unreadCount = 0,
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userTriggerRef = useRef(null);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter(item => !item.adminOnly || user?.role === "admin"),
    [user]
  );

  const initials = useMemo(() => {
    if (!user?.name) return "TS";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }, [user?.name]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile Toggle */}
      {!sidebarOpen && (
        <motion.button
          className="sidebar-mobile-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        >
          <Menu size={22} />
        </motion.button>
      )}

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <motion.div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}

      <aside
        className={`sidebar-modern
          ${sidebarOpen ? "sidebar-open" : ""}
          ${sidebarCollapsed ? "sidebar-collapsed" : ""}
        `}
      >
        {/* Mobile Close Button */}
        <div className="sidebar-header-mobile">
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Logo */}
        <div className="sidebar-logo">
          <button
            className="sidebar-brand"
            onClick={() => navigate("/dashboard")}
            aria-label="Go to dashboard"
          >
            <motion.div
              className="sidebar-logo-icon"
              whileHover={{ scale: 1.05, rotate: -5 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <BrandMark/>
            </motion.div>

            {!sidebarCollapsed && (
              <>
                <div className="sidebar-logo-text">
                  <span className="brand-title">TrustShare</span>
                </div>
                <span className="sidebar-beta">BETA</span>
              </>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (item.to === "/my-files") events.emit(EVENTS.MY_FILES_ROOT);
                  setSidebarOpen(false);
                }}
                data-tooltip={item.label}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                {({isActive}) => <>
                {isActive && <motion.span className="sidebar-active-indicator" layoutId="workspace-active-route" aria-hidden="true" transition={{duration:reducedMotion?0:.22,ease:[.2,.75,.25,1]}}/>}
                <span className="sidebar-link-icon">
                  <Icon size={18} />
                </span>

                {!sidebarCollapsed && (
                  <span className="sidebar-link-text">{item.label}</span>
                )}

                {!sidebarCollapsed && item.badge && unreadCount > 0 && (
                  <span className="sidebar-link-badge">{unreadCount}</span>
                )}

                {sidebarCollapsed && item.badge && unreadCount > 0 && (
                  <span className="sidebar-link-dot" />
                )}
                </>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer — User section */}
        <div className="sidebar-footer">
          <button
            ref={userTriggerRef}
            className={`sidebar-user ${userMenuOpen ? "sidebar-user--open" : ""}`}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="Open user menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            {/* ENHANCED AVATAR CONTAINER: Supports dynamic profile photos */}
            <div
              className="sidebar-avatar"
              style={{
                background: user?.avatar_url
                  ? "transparent"
                  : (user?.avatar_color || "linear-gradient(135deg, #808080, #606060)"),
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || "Profile"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials
              )}
            </div>

            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {user?.name || "Guest User"}
                </span>
                <span className="sidebar-user-email">
                  {user?.email || "guest@user.com"}
                </span>
              </div>
            )}

            {!sidebarCollapsed && (
              <motion.span
                className="sidebar-user-chevron"
                animate={{ rotate: userMenuOpen ? 0 : 180 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              >
                <ChevronUp size={14} />
              </motion.span>
            )}
          </button>
        </div>
      </aside>

      {/* Floating expand button when collapsed */}
      {sidebarCollapsed && (
        <motion.button
          className="sidebar-expand-btn"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronRight size={14} />
        </motion.button>
      )}

      {/* User dropdown menu */}
      <UserDropdownMenu
        open={userMenuOpen}
        onClose={() => setUserMenuOpen(false)}
        triggerRef={userTriggerRef}
        user={user}
        onLogout={handleLogout}
      />
    </>
  );
}
