import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Moon, Sun, CheckCheck, Sparkles, Shield } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  RiSearch2Line,
  RiFileTextLine,
  RiFolderOpenLine,
  RiShareForwardLine,
  RiNotification3Line,
  RiImageLine,
  RiFileZipLine,
  RiCodeBoxLine,
  RiVideoLine,
  RiShieldCheckLine,
  RiUserLine,
  RiFileSearchLine,
} from "react-icons/ri";
import { searchAPI, notificationsAPI } from "../utils/api";
import { events, EVENTS } from "../utils/events";
import ContentSearchModal from "../features/search/ContentSearchModal";
import { useAssistantStatus } from "../features/assistant/hooks/useAssistantStatus";
import AssistantBubbleWindow from "../features/assistant/AssistantBubbleWindow";
import { assistantAPI } from "../features/assistant/services/assistantAPI";
import "./Navbar.css";

// File type icon resolver
const FILE_ICON_MAP = {
  image: ["png", "jpg", "jpeg", "gif", "svg", "webp"],
  video: ["mp4", "avi", "mov", "mkv"],
  archive: ["zip", "rar", "7z"],
  code: ["js", "jsx", "ts", "tsx", "java", "py", "cpp", "css", "html"],
};

function getSearchFileIcon(filename) {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  if (FILE_ICON_MAP.image.includes(ext))
    return <RiImageLine className="search-icon" />;
  if (FILE_ICON_MAP.video.includes(ext))
    return <RiVideoLine className="search-icon" />;
  if (FILE_ICON_MAP.archive.includes(ext))
    return <RiFileZipLine className="search-icon" />;
  if (FILE_ICON_MAP.code.includes(ext))
    return <RiCodeBoxLine className="search-icon" />;
  return <RiFileTextLine className="search-icon" />;
}

function getNotificationIcon(notification) {
  const text = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (text.includes("share"))
    return <RiShareForwardLine className="notification-type-icon" />;
  if (text.includes("folder"))
    return <RiFolderOpenLine className="notification-type-icon" />;
  if (text.includes("security"))
    return <RiShieldCheckLine className="notification-type-icon" />;
  if (text.includes("file"))
    return <RiFileTextLine className="notification-type-icon" />;
  return <RiNotification3Line className="notification-type-icon" />;
}

// ── DEFENSIVE CRASH-PROOF HELPER ───────────────────────────────────────────
export function getUnreadNotificationPreview(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((notification) => notification && !notification.is_read).slice(0, 5);
}

export default function Navbar({
  unreadCount = 0,
  setSidebarOpen,
  connectionStatus,
}) {
  const [showContentModal, setShowContentModal] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { user } = useAuth();
  const { status: assistantStatus } = useAssistantStatus();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [bubbleConversationId, setBubbleConversationId] = useState(() => {
    try {
      const saved = sessionStorage.getItem("trustshare_bubble_conversation_id");
      return saved ? parseInt(saved, 10) : null;
    } catch { return null; }
  });

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notificationRef = useRef(null);
  const assistantRef = useRef(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    try {
      if (bubbleConversationId) {
        sessionStorage.setItem("trustshare_bubble_conversation_id", String(bubbleConversationId));
      } else {
        sessionStorage.removeItem("trustshare_bubble_conversation_id");
      }
    } catch { }
  }, [bubbleConversationId]);

  useEffect(() => {
    if (!user) {
      setBubbleConversationId(null);
      setAssistantOpen(false);
      try { sessionStorage.removeItem("trustshare_bubble_conversation_id"); } catch { }
      return;
    }
    if (!bubbleConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        await assistantAPI.getMessages(bubbleConversationId);
      } catch (err) {
        if (cancelled) return;
        const s = err?.response?.status;
        if (s === 404 || s === 403 || s === 401) setBubbleConversationId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!assistantOpen) return;
    const handler = (e) => {
      if (assistantRef.current && !assistantRef.current.contains(e.target)) {
        setAssistantOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [assistantOpen]);

  const handleConversationCreated = useCallback((newId) => setBubbleConversationId(newId), []);
  const handleNewChat = useCallback(() => setBubbleConversationId(null), []);
  const handleConversationNotFound = useCallback(() => setBubbleConversationId(null), []);

  useEffect(() => {
    const handleOpenAssistant = () => {
      setAssistantOpen(true);
      setTimeout(() => {
        const textarea = document.querySelector(".asst-bubble-window .asst-input-textarea");
        if (textarea) textarea.focus();
      }, 250);
    };
    window.addEventListener("assistant:open", handleOpenAssistant);
    return () => window.removeEventListener("assistant:open", handleOpenAssistant);
  }, []);

  // Search (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await searchAPI.search(query);
        setResults(res.data);
        setActiveIndex(-1);
      } catch (err) {
        console.error(err);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setResults(null);
        setActiveIndex(-1);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        searchInputRef.current?.blur();
        setResults(null);
        setShowNotifications(false);
        setAssistantOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── SAFE NOTIFICATION LOADER (Prevents crashes) ───────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsAPI.list();
      const list = Array.isArray(res?.data) ? res.data : [];
      setNotifications(getUnreadNotificationPreview(list));
    } catch {
      // Silently ignore during login/logout transitions
    }
  }, [user]);

  useEffect(() => {
    if (showNotifications) loadNotifications();
  }, [showNotifications, loadNotifications]);

  useEffect(() => {
    const unsub = events.on(EVENTS.NOTIFICATIONS_CHANGED, loadNotifications);
    const handleFocus = () => loadNotifications();
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(loadNotifications, 5000);
    return () => {
      unsub();
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const flatResults = useMemo(() => {
    if (!results) return [];
    const list = [];
    results.files?.forEach((f) =>
      list.push({ type: "file", data: f, id: `file-${f.id}` })
    );
    results.folders?.forEach((f) =>
      list.push({ type: "folder", data: f, id: `folder-${f.id}` })
    );
    results.shares?.forEach((s) =>
      list.push({ type: "share", data: s, id: `share-${s.id}` })
    );
    results.notifications?.forEach((n) =>
      list.push({ type: "notification", data: n, id: `notif-${n.id}` })
    );
    results.content_matches?.forEach((c) =>
      list.push({ type: "content", data: c, id: `content-${c.id}` })
    );
    results.users?.forEach((u) =>
      list.push({ type: "user", data: u, id: `user-${u.id}` })
    );
    results.people_files?.forEach((f) =>
      list.push({ type: "people_file", data: f, id: `pfile-${f.id}` })
    );
    return list;
  }, [results]);

  const handleSearchKeyDown = (e) => {
    if (!results || flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? flatResults.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = flatResults[activeIndex];
      handleResultClick(item.type, item.data);
    }
  };

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector(`[data-result-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const handleResultClick = (type, data) => {
    setQuery("");
    setResults(null);
    setActiveIndex(-1);

    if (type === "user") {
      navigate("/admin", { state: { highlightUserId: data.id } });
      return;
    }

    const routes = {
      file: "/my-files",
      folder: "/my-files",
      share: "/sharing",
      notification: "/notifications",
      content: "/my-files",
      people_file: "/shared-with-me",
    };
    navigate(routes[type] || "/dashboard");
  };

  const handleMarkAllRead = async () => {
    if (markingAllRead || notifications.length === 0) return;
    setMarkingAllRead(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifications([]);
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    setNotifications((previous) => previous.filter((item) => item.id !== notification.id));
    try {
      await notificationsAPI.markRead(notification.id);
      events.emit(EVENTS.NOTIFICATIONS_CHANGED);
      setShowNotifications(false);
      navigate("/notifications");
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      loadNotifications();
    }
  };

  const hasNoResults =
    results &&
    !results.files?.length &&
    !results.folders?.length &&
    !results.shares?.length &&
    !results.notifications?.length &&
    !results.content_matches?.length &&
    !results.users?.length &&
    !results.people_files?.length;

  const renderSearchItem = (item, globalIndex) => {
    const isActive = activeIndex === globalIndex;

    const getLabel = () => {
      switch (item.type) {
        case "file": return item.data.original_name || "Unknown file";
        case "folder": return item.data.name || "Unknown folder";
        case "share": return `Share #${item.data.id}`;
        case "notification": return item.data.title || "Notification";
        case "content": return item.data.original_name || "Unknown file";
        case "user": return `${item.data.name || ""} · ${item.data.email || ""}`;
        case "people_file": return item.data.original_name || item.data.name || "Shared file";
        default: return "Unknown";
      }
    };

    const getIcon = () => {
      switch (item.type) {
        case "file": return getSearchFileIcon(item.data.original_name);
        case "folder": return <RiFolderOpenLine className="search-icon" />;
        case "share": return <RiShareForwardLine className="search-icon" />;
        case "notification": return <RiNotification3Line className="search-icon" />;
        case "content": return <RiFileSearchLine className="search-icon" style={{ color: "#606060" }} />;
        case "user": return <RiUserLine className="search-icon" style={{ color: "#a0a0a0" }} />;
        case "people_file": return getSearchFileIcon(item.data.original_name || item.data.name || "");
        default: return <RiFileTextLine className="search-icon" />;
      }
    };

    return (
      <motion.div
        key={item.id}
        data-result-index={globalIndex}
        className={`search-item ${isActive ? "search-item--active" : ""} ${item.type === "content" ? "search-item--content" : ""}`}
        onClick={() => handleResultClick(item.type, item.data)}
        onMouseEnter={() => setActiveIndex(globalIndex)}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: globalIndex * 0.02, duration: 0.2 }}
      >
        {getIcon()}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <span style={{
            fontWeight: item.type === "content" ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {getLabel()}
          </span>

          {item.type === "content" && item.data.snippet && (
            <span
              style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 2 }}
              dangerouslySetInnerHTML={{ __html: item.data.snippet }}
            />
          )}

          {item.type === "people_file" && item.data.shared_by && (
            <span style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 2 }}>
              Shared by {item.data.shared_by}
            </span>
          )}

          {item.type === "user" && (
            <span style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: 2 }}>
              {item.data.role} · {item.data.is_active ? "Active" : "Suspended"}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  let currentIndex = 0;
  const renderSection = (title, items, type) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="search-section">
        <div className="search-title">{title}</div>
        {items.map((data) => {
          const item = { type, data, id: `${type}-${data.id}` };
          const el = renderSearchItem(item, currentIndex);
          currentIndex++;
          return el;
        })}
      </div>
    );
  };

  const showAssistantBtn = user && assistantStatus?.is_enabled && assistantStatus?.show_bubble;

  return (
    <header className={`navbar-modern ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-search" ref={searchRef}>
        <RiSearch2Line className="search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search files, people, activity..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResults(null);
            setActiveIndex(-1);
          }}
          onKeyDown={handleSearchKeyDown}
          aria-label="Search"
        />
        <button
          type="button"
          className="ai-search-trigger-btn"
          onClick={() => setShowContentModal(true)}
          title="Open Deep Content Search"
        >
          <RiFileSearchLine size={14} />
          <span className="ai-search-text">Deep Search</span>
        </button>

        <AnimatePresence>
          {loading && (
            <motion.div
              className="search-dropdown"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="search-loading">
                <div className="search-spinner" />
                <span>Searching...</span>
              </div>
            </motion.div>
          )}

          {!loading && results && (
            <motion.div
              className="search-dropdown"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              {(() => {
                currentIndex = 0;
                return (
                  <>
                    {renderSection("Inside Document Content", results.content_matches, "content")}
                    {renderSection("Files", results.files, "file")}
                    {renderSection("Folders", results.folders, "folder")}
                    {renderSection("Shares", results.shares, "share")}
                    {renderSection("Notifications", results.notifications, "notification")}
                    {isAdmin && renderSection("Users", results.users, "user")}
                    {!isAdmin && renderSection("Files Shared by People", results.people_files, "people_file")}
                  </>
                );
              })()}

              {hasNoResults && (
                <motion.div
                  className="search-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <RiSearch2Line size={28} className="search-empty-icon" />
                  <p className="search-empty-title">No results found</p>
                  <p className="search-empty-hint">Try different keywords</p>
                </motion.div>
              )}

              {flatResults.length > 0 && (
                <div className="search-hints">
                  <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
                  <span><kbd>↵</kbd> Select</span>
                  <span><kbd>Esc</kbd> Close</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <kbd className="search-shortcut">Ctrl+K</kbd>
      </div>

      <div className="navbar-actions" ref={notificationRef}>
        {isAdmin && (
          <motion.button
            type="button"
            className="nav-admin-badge"
            onClick={() => navigate("/admin")}
            title="Open Administrator Console"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="nav-admin-icon-wrap">
              <Shield size={11} strokeWidth={2.5} />
            </div>
            <span className="nav-admin-text">ADMIN CONSOLE</span>
            <span className="nav-admin-beacon" />
          </motion.button>
        )}

        {showAssistantBtn && (
          <div className="navbar-assistant-wrapper" ref={assistantRef}>
            <motion.button
              className={`nav-assistant-btn ${assistantOpen ? "active" : ""}`}
              onClick={() => setAssistantOpen((prev) => !prev)}
              aria-label="Open AI Assistant"
              title="AI Assistant (Ctrl+/)"
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <Sparkles size={15} />
              <span className="nav-assistant-label">Ask AI</span>
            </motion.button>

            <AnimatePresence>
              {assistantOpen && (
                <AssistantBubbleWindow
                  status={assistantStatus}
                  onClose={() => setAssistantOpen(false)}
                  conversationId={bubbleConversationId}
                  onConversationCreated={handleConversationCreated}
                  onNewChat={handleNewChat}
                  onConversationNotFound={handleConversationNotFound}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {connectionStatus}

        <motion.button
          className="nav-icon-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.15 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === "dark" ? (
              <motion.span
                key="sun"
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                style={{ display: "flex" }}
              >
                <Sun size={18} />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                style={{ display: "flex" }}
              >
                <Moon size={18} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          className={`nav-icon-btn ${showNotifications ? "active" : ""}`}
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
          title="Notifications"
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.15 }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <motion.span
              className="notif-dot"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              {unreadCount}
            </motion.span>
          )}
        </motion.button>

        <AnimatePresence>
          {showNotifications && (
            <motion.div
              className="notification-dropdown"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="notification-header">
                <div className="notification-header-left">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notification-count">{unreadCount} new</span>
                  )}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <motion.button
                    className="notification-mark-all"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </motion.button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <Bell size={28} className="notification-empty-icon" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="notification-dropdown-list">
                  {notifications.map((notification, i) => (
                    <motion.div
                      key={notification.id}
                      className="notification-item"
                      onClick={() => handleNotificationClick(notification)}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.04 * i,
                        duration: 0.28,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notification.title}</div>
                        <div className="notification-message">{notification.message}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <motion.button
                className="notification-view-all"
                onClick={() => {
                  setShowNotifications(false);
                  navigate("/notifications");
                }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                View All
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ContentSearchModal
        isOpen={showContentModal}
        onClose={() => setShowContentModal(false)}
      />
    </header>
  );
}
