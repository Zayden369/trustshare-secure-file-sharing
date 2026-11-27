import { useState, useEffect, useCallback, useRef } from 'react';
import { assistantAPI } from '../services/assistantAPI';
import { emitAssistantEvent } from '../utils/assistantEvents';

const requestId = () => window.crypto?.randomUUID?.().replaceAll('-', '') || `request_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function useChat(initialConversationId = null) {
    const [conversationId, setConversationId] = useState(initialConversationId);
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState(null);
    const [stage, setStage] = useState('');
    const conversation = useRef(initialConversationId);
    const mounted = useRef(true);
    const controller = useRef(null);
    const epoch = useRef(0);
    const busy = useRef(false);
    const lastRequest = useRef(null);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; epoch.current += 1; controller.current?.abort(); };
    }, []);

    useEffect(() => {
        // A server-issued ID becoming a URL prop is the same active conversation.
        if (initialConversationId === conversation.current && lastRequest.current) return undefined;
        controller.current?.abort();
        const version = ++epoch.current;
        busy.current = false;
        setSending(false); setError(null); setStage('');
        conversation.current = initialConversationId;
        setConversationId(initialConversationId);
        lastRequest.current = null;
        setMessages([]);
        if (!initialConversationId) { setLoadingHistory(false); return undefined; }
        let cancelled = false;
        setLoadingHistory(true);
        assistantAPI.getMessages(initialConversationId).then(({ data }) => {
            if (!cancelled && mounted.current && epoch.current === version) setMessages(data || []);
        }).catch(err => {
            if (!cancelled && mounted.current && epoch.current === version) setError(err?.response?.data?.detail || 'Unable to load this conversation.');
        }).finally(() => {
            if (!cancelled && mounted.current && epoch.current === version) setLoadingHistory(false);
        });
        return () => { cancelled = true; };
    }, [initialConversationId]);

    const sendMessage = useCallback(async (text, metadata = {}) => {
        const trimmed = text.trim();
        if (!trimmed || busy.current) return;
        busy.current = true;
        const version = ++epoch.current;
        const payload = metadata.retryPayload || {
            message: trimmed, conversation_id: conversation.current || undefined,
            intent_id: metadata.intent_id || undefined, suggestion_id: metadata.suggestion_id || undefined,
            request_id: requestId(),
        };
        lastRequest.current = { payload, completed: false };
        controller.current = new AbortController();
        const signal = controller.current.signal;
        const prefix = payload.request_id;
        const userId = `u-${prefix}`;
        const assistantId = `a-${prefix}`;
        const valid = () => mounted.current && epoch.current === version;
        let content = '';
        let toolIndex = 0;
        let terminalError = null;
        setError(null); setSending(true); setStage('Connecting…');
        setMessages(previous => {
            const clean = previous.filter(item => !item.id?.toString().startsWith(`f-${prefix}-`) && item.id !== assistantId);
            return clean.some(item => item.id === userId) ? clean : [...clean, { id: userId, role: 'user', content: trimmed, created_at: new Date().toISOString() }];
        });
        const updateAssistant = (textValue, extra = {}) => setMessages(previous => {
            const row = { id: assistantId, role: 'assistant', content: textValue, created_at: new Date().toISOString(), ...extra };
            return previous.some(item => item.id === assistantId)
                ? previous.map(item => item.id === assistantId ? row : item) : [...previous, row];
        });
        try {
            await assistantAPI.streamMessage(payload, { signal, onEvent: ({ event, data }) => {
                if (!valid() || signal.aborted) return;
                if (event === 'meta') {
                    conversation.current = data.conversation_id;
                    setConversationId(data.conversation_id);
                } else if (event === 'delta') {
                    content += data.text;
                    updateAssistant(content, { streaming: true });
                    setStage('Receiving response…');
                } else if (event === 'status') {
                    setStage(data.stage === 'generating' ? 'Generating response…' : 'Waiting for AI…');
                } else if (event === 'tool_start') {
                    setStage('Retrieving your authorized data…');
                } else if (event === 'tool_result') {
                    const row = { id: `f-${prefix}-${toolIndex++}`, role: 'function', function_name: data.name, function_result: data.result };
                    setMessages(previous => [...previous, row]);
                } else if (event === 'error') {
                    terminalError = data;
                } else if (event === 'done') {
                    lastRequest.current.completed = true;
                    emitAssistantEvent({ type: 'conversation_updated', conversationId: conversation.current });
                    // Terminal results also rebuild cards for idempotent replay.
                    const cards = (data.function_calls || []).map((call, index) => ({ id: `f-${prefix}-${index}`, role: 'function', function_name: call.name, function_result: call.result }));
                    setMessages(previous => [...previous.filter(item => item.id !== assistantId && !item.id?.toString().startsWith(`f-${prefix}-`)), ...cards,
                        { id: assistantId, role: 'assistant', content: data.message, tokens_used: data.tokens_used, model_used: data.model_used, created_at: new Date().toISOString() }]);
                }
            } });
            if (terminalError) throw new Error(terminalError.message || 'The assistant could not complete this turn.');
        } catch (err) {
            if (!valid()) return;
            if (signal.aborted) {
                if (content) updateAssistant(content + '\n\nGeneration stopped.', { isError: true });
            } else {
                const detail = err?.response?.data?.detail;
                const message = detail?.message || (typeof detail === 'string' ? detail : null) || err.message || 'Request interrupted. Retry to recover this turn.';
                setError(message);
                updateAssistant(content ? `${content}\n\n${message}` : message, { isError: true });
            }
        } finally {
            if (valid()) { busy.current = false; setSending(false); setStage(''); }
        }
    }, []);

    const regenerateLastMessage = useCallback(() => {
        const last = lastRequest.current;
        if (!last || busy.current) return undefined;
        return sendMessage(last.payload.message, last.completed
            ? { intent_id: last.payload.intent_id, suggestion_id: last.payload.suggestion_id }
            : { retryPayload: last.payload });
    }, [sendMessage]);

    const stopGenerating = useCallback(() => {
        controller.current?.abort();
        setStage('Stopping generation…');
    }, []);

    const resetChat = useCallback(() => {
        controller.current?.abort(); epoch.current += 1; busy.current = false;
        conversation.current = null; lastRequest.current = null;
        setConversationId(null); setMessages([]); setError(null); setSending(false); setStage('');
    }, []);

    return { messages, sending, loadingHistory, error, stage, sendMessage, regenerateLastMessage,
        stopGenerating, resetChat, conversationId, canRegenerate: !!lastRequest.current && !sending };
}
