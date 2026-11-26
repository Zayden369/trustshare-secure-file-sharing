import React, { useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Square } from 'lucide-react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import EmptyState from './EmptyState';
import NotConfiguredState from './NotConfiguredState';
import { useChat } from '../hooks/useChat';
import { emitAssistantEvent } from '../utils/assistantEvents';
import { Loader2 } from 'lucide-react';

const ChatWindow = ({
    status,
    conversationId,
    onConversationCreated,
    onConversationNotFound,
    onGoToAdmin,
    compact = false,
}) => {
    const {
        messages,
        sending,
        loadingHistory,
        error,
        sendMessage: originalSendMessage,
        regenerateLastMessage,
        stopGenerating,
        canRegenerate,
        conversationId: currentConvId,
        stage,
    } = useChat(conversationId);

    useEffect(() => {
        if (
            currentConvId &&
            currentConvId !== conversationId &&
            onConversationCreated
        ) {
            onConversationCreated(currentConvId);

            emitAssistantEvent({
                type: 'conversation_created',
                conversationId: currentConvId,
            });
        }
    }, [currentConvId]);

    useEffect(() => {
        if (!error) return;
        const errMsg = typeof error === 'string' ? error.toLowerCase() : '';
        if (
            errMsg.includes("doesn't exist") ||
            errMsg.includes('not found') ||
            errMsg.includes("don't have access")
        ) {
            if (onConversationNotFound) {
                onConversationNotFound();
            }
        }
    }, [error, onConversationNotFound]);

    const sendMessage = useCallback(
        (text, metadata) => originalSendMessage(text, metadata),
        [originalSendMessage]
    );

    const handlePickSuggestion = useCallback(
        (text, metadata) => sendMessage(text, metadata),
        [sendMessage]
    );

    if (status && !status.is_configured && !status.data_queries_available) {
        return <NotConfiguredState status={status} onGoToAdmin={onGoToAdmin} />;
    }

    if (loadingHistory) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--asst-text-muted)' }} />
            </div>
        );
    }

    const showEmpty = messages.length === 0;

    return (
        <>
            {showEmpty ? (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <EmptyState
                        botName={status?.bot_name || 'TrustShare Assistant'}
                        onPickSuggestion={handlePickSuggestion}
                        compact={compact}
                    />
                </div>
            ) : (
                <MessageList
                    messages={messages}
                    sending={sending}
                    onRegenerate={regenerateLastMessage}
                    canRegenerate={canRegenerate}
                    enableMarkdown={status?.enable_markdown !== false}
                    showTokenUsage={status?.show_token_usage === true}
                />
            )}

            {/* Stop generating button */}
            {sending && (
                <div className="asst-stop-wrapper">
                    <span role="status" style={{ fontSize: 12, color: 'var(--asst-text-muted)', marginRight: 8 }}>{stage}</span>
                    <motion.button
                        className="asst-stop-btn"
                        onClick={stopGenerating}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <Square size={12} fill="currentColor" />
                        Stop generating
                    </motion.button>
                </div>
            )}

            <MessageInput
                onSend={sendMessage}
                disabled={sending}
                maxLength={status?.max_message_length || 2000}
            />
        </>
    );
};

export default ChatWindow;
