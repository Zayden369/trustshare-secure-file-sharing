import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, MessageSquarePlus } from 'lucide-react';
import BrandMark from '../../components/BrandMark';
import { Link } from 'react-router-dom';
import ChatWindow from './components/ChatWindow';
import { emitAssistantEvent } from './utils/assistantEvents';

const AssistantBubbleWindow = ({
    status,
    onClose,
    conversationId,
    onConversationCreated,
    onNewChat,
    onConversationNotFound,
}) => {

    const handleConversationCreated = useCallback((newId) => {
        if (onConversationCreated) {
            onConversationCreated(newId);
        }
        emitAssistantEvent({
            type: 'conversation_created',
            conversationId: newId,
        });
    }, [onConversationCreated]);

    const maximizeUrl = conversationId
        ? `/assistant?conversation=${conversationId}`
        : '/assistant';

    return (
        <motion.div
            className="asst-bubble-window"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
            {/* Header */}
            <div className="asst-bubble-header">
                <div className="asst-bubble-title">
                    <BrandMark/>
                    <span>{status?.bot_name || 'AI Assistant'}</span>
                </div>
                <div className="asst-bubble-actions">
                    {conversationId && (
                        <button
                            className="asst-bubble-action"
                            onClick={onNewChat}
                            aria-label="Start new chat"
                            title="Start new chat"
                        >
                            <MessageSquarePlus size={14} />
                        </button>
                    )}
                    <Link
                        to={maximizeUrl}
                        className="asst-bubble-action"
                        onClick={onClose}
                        aria-label="Open full page"
                        title="Open full page"
                        style={{ textDecoration: 'none' }}
                    >
                        <Maximize2 size={14} />
                    </Link>
                    <button
                        className="asst-bubble-action"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="asst-bubble-body">
                <ChatWindow
                    status={status}
                    conversationId={conversationId}
                    onConversationCreated={handleConversationCreated}
                    onConversationNotFound={onConversationNotFound}
                    onGoToAdmin={() => {
                        onClose();
                        window.location.href = '/assistant';
                    }}
                    compact={true}
                />
            </div>
        </motion.div>
    );
};

export default AssistantBubbleWindow;
