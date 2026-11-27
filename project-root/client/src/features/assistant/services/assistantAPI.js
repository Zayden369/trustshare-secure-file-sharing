
import api from '../../../utils/api';

const BASE = '/api/assistant';
const ADMIN_BASE = '/api/assistant/admin';

const getStatus = () => api.get(`${BASE}/status`);

const getSuggestions = () => api.get(`${BASE}/suggestions`);

/**
 * Send a chat message.
 * @param {string} message - User's message
 * @param {number|null} conversationId - Existing conversation ID, or null for new
 */
const sendMessage = (message, conversationId = null) => {
    const payload = { message };
    if (conversationId) payload.conversation_id = conversationId;
    return api.post(`${BASE}/chat`, payload);
};

// The fetch adapter retains the shared JWT/refresh interceptors while exposing
// the actual response stream in browsers. Never replay a completed text buffer.
const streamMessage = async (payload, { signal, onEvent }) => {
    let response;
    try {
        response = await api.post(`${BASE}/chat/stream`, payload, {
            adapter: 'fetch', responseType: 'stream', signal, timeout: 130000,
            headers: { Accept: 'text/event-stream' },
        });
    } catch (error) {
        if (error.response?.data?.getReader) {
            try { error.response.data = JSON.parse(await new Response(error.response.data).text()); } catch { /* retain safe HTTP status */ }
        }
        throw error;
    }
    const reader = response.data.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
            if (buffer.length > 262144) throw new Error('Assistant response frame was too large.');
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const lines = frame.split('\n');
                const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
                const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
                if (!type || !data) continue;
                const event = { event: type, data: JSON.parse(data) };
                onEvent(event);
                if (type === 'done' || type === 'error') completed = true;
            }
        }
        if (!completed && !signal?.aborted) throw new Error('The connection ended before the response completed. Retry to recover this turn.');
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
};

const listConversations = () => api.get(`${BASE}/conversations`);

const getMessages = (conversationId) =>
    api.get(`${BASE}/conversations/${conversationId}/messages`);

const archiveConversation = (conversationId) =>
    api.delete(`${BASE}/conversations/${conversationId}`);

const renameConversation = (conversationId, title) =>
    api.patch(`${BASE}/conversations/${conversationId}`, { title });


// ADMIN ENDPOINTS

const admin = {
    getConfig: () => api.get(`${ADMIN_BASE}/config`),

    getConfigByCategory: (category) =>
        api.get(`${ADMIN_BASE}/config/${category}`),

    /**
     * Update a single config value.
     * @param {string} key - Config key (e.g., "LLM_API_KEY")
     * @param {any} value - New value
     */
    updateConfig: (key, value) =>
        api.put(`${ADMIN_BASE}/config/${key}`, { value }),

    bulkUpdateConfigs: (updates) =>
        api.post(`${ADMIN_BASE}/config/bulk`, { updates }),

    /**
     * Test LLM connection.
     * @param {object} opts - Optional { api_key, model } to test without saving
     */
    testConnection: (opts = {}) =>
        api.post(`${ADMIN_BASE}/test-connection`, opts),

    getModels: () => api.get(`${ADMIN_BASE}/models`),

    getProviders: () => api.get(`${ADMIN_BASE}/providers`),

    getModelsForProvider: (provider, { live = true, refresh = false } = {}) => {
    const params = new URLSearchParams();
    if (live) params.set('live', 'true');
    if (refresh) params.set('refresh', 'true');
    const query = params.toString();
    return api.get(`${ADMIN_BASE}/models/${provider}${query ? `?${query}` : ''}`);
},

    switchProvider: (data) =>
        api.post(`${ADMIN_BASE}/switch-provider`, data),

    clearCache: () => api.post(`${ADMIN_BASE}/cache/clear`),
};

export const assistantAPI = {
    getStatus,
    getSuggestions,
    sendMessage,
    streamMessage,
    listConversations,
    getMessages,
    archiveConversation,
    renameConversation,
    admin,
};

export default assistantAPI;
