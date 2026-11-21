import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Sparkles, Loader2, Settings as SettingsIcon, Menu } from 'lucide-react';
import { useAssistantStatus } from './hooks/useAssistantStatus';
import { useConversations } from './hooks/useConversations';
import ConversationSidebar from './components/ConversationSidebar';
import ChatWindow from './components/ChatWindow';
import AssistantAdminSetup from './AssistantAdminSetup';
import { useAuth } from '../../context/AuthContext';
import { onAssistantEvent } from './utils/assistantEvents';
import './assistant.css';

const AssistantPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';

  const showAdminSetup = location.pathname === '/assistant/configuration';

  const { status, loading: statusLoading, refetch: refetchStatus } = useAssistantStatus();
  const { conversations, refetch: refetchConversations, archive, rename } = useConversations();

  const conversationParam = searchParams.get('conversation');
  const [activeConvId, setActiveConvId] = useState(
    conversationParam ? parseInt(conversationParam, 10) : null
  );
  const [chatRefreshKey, setChatRefreshKey] = useState(0);

  // ── Mobile sidebar drawer state ─────────────────────────────────
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const paramId = searchParams.get('conversation');
    if (paramId) {
      const parsedId = parseInt(paramId, 10);
      if (!isNaN(parsedId) && parsedId !== activeConvId) {
        setActiveConvId(parsedId);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const paramId = searchParams.get('conversation');
    if (activeConvId === null && paramId) {
      setSearchParams({}, { replace: true });
    } else if (activeConvId && paramId && parseInt(paramId, 10) !== activeConvId) {
      setSearchParams({ conversation: String(activeConvId) }, { replace: true });
    }
  }, [activeConvId]);

  useEffect(() => {
    if (conversationParam) {
      refetchConversations();

      const t = setTimeout(() => {
        refetchConversations();
      }, 300);

      return () => clearTimeout(t);
    }
  }, [conversationParam]);

  useEffect(() => {
    const unsubscribe = onAssistantEvent((detail) => {
      refetchConversations();

      if (
        detail?.type === 'message_sent' &&
        detail?.conversationId &&
        detail.conversationId === activeConvId
      ) {
        setChatRefreshKey((k) => k + 1);
      }
    });

    return unsubscribe;
  }, [activeConvId, refetchConversations]);

  // ── Close mobile drawer on Escape ─────────────────────────────
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileSidebarOpen]);

  // ── Close mobile drawer when route changes ────────────────────
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    setSearchParams({}, { replace: true });
    setMobileSidebarOpen(false); // Auto-close on new chat
  }, [setSearchParams]);

  const handleSelectConversation = useCallback((id) => {
    setActiveConvId(id);
    setSearchParams({ conversation: String(id) }, { replace: true });
    setMobileSidebarOpen(false); // Auto-close on select
  }, [setSearchParams]);

  const handleDeleteConversation = useCallback(async (id) => {
    const ok = await archive(id);
    if (ok && activeConvId === id) {
      setActiveConvId(null);
      setSearchParams({}, { replace: true });
    }
  }, [archive, activeConvId, setSearchParams]);

  const handleConversationCreated = useCallback((newId) => {
    setActiveConvId(newId);
    setSearchParams({ conversation: String(newId) }, { replace: true });
    refetchConversations();
  }, [refetchConversations, setSearchParams]);

  const handleGoToAdmin = useCallback(() => {
    if (isAdmin) {
      navigate('/assistant/configuration');
    }
  }, [isAdmin, navigate]);

  const handleAdminDone = useCallback(async () => {
    await refetchStatus();
    await refetchConversations();
    navigate('/assistant');
  }, [refetchStatus, refetchConversations, navigate]);

  if (statusLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--asst-text-muted)' }} />
      </div>
    );
  }

  // Admin Setup View
  if (showAdminSetup) {
    return (
      <div className="asst-admin-wrapper">
        <AssistantAdminSetup onDone={handleAdminDone} />
      </div>
    );
  }

  // Assistant disabled
  if (status && !status.is_enabled) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 40,
        textAlign: 'center',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #a0a0a0, #808080)',
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Sparkles size={32} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--asst-text-primary)', marginBottom: 8 }}>
          Assistant Disabled
        </h2>
        <p style={{ fontSize: 14, color: 'var(--asst-text-secondary)', maxWidth: 400 }}>
          The AI Assistant has been disabled. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  // Main Chat Page
  return (
    <div className="asst-page">
      {/* Mobile backdrop overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            className="asst-mobile-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — desktop: always visible, mobile: drawer */}
      <div className={`asst-sidebar-wrapper ${mobileSidebarOpen ? 'is-mobile-open' : ''}`}>
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onRename={rename}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main chat area */}
      <div className="asst-main">
        {/* Header */}
        <div className="asst-page-header">
          <div className="asst-page-title">
            {/* Mobile hamburger — only visible on mobile */}
            <button
              type="button"
              className="asst-mobile-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open conversation list"
            >
              <Menu size={18} />
            </button>

            <div className="asst-page-title-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <div>{status?.bot_name || 'TrustShare Assistant'}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--asst-text-muted)', marginTop: 2 }}>
                {status?.bot_tagline || 'AI-powered file assistant'}
              </div>
            </div>
          </div>

          <div className="asst-header-actions">
            {status?.is_configured && (
              <span className="asst-live-badge">
                <span className="asst-live-dot" />
                Online
              </span>
            )}
            {isAdmin && (
              <button
                onClick={handleGoToAdmin}
                className="asst-header-btn"
              >
                <SettingsIcon size={12} />
                Configure
              </button>
            )}
          </div>
        </div>

        {/* Chat window */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeConvId || 'new'}-${chatRefreshKey}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChatWindow
              status={status}
              conversationId={activeConvId}
              onConversationCreated={handleConversationCreated}
              onGoToAdmin={handleGoToAdmin}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AssistantPage;
