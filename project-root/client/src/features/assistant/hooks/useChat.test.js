import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { assistantAPI } from '../services/assistantAPI';
jest.mock('../services/assistantAPI', () => ({ assistantAPI: { streamMessage: jest.fn(), getMessages: jest.fn() } }));
beforeEach(() => { jest.clearAllMocks(); assistantAPI.getMessages.mockResolvedValue({ data: [] }); });

test('shows actual incremental tokens before completion and keeps the new conversation mounted', async () => {
    let complete;
    let transportSignal;
    assistantAPI.streamMessage.mockImplementation(async (payload, { onEvent, signal }) => {
        transportSignal = signal;
        onEvent({ event: 'meta', data: { conversation_id: 42 } });
        onEvent({ event: 'delta', data: { text: 'First token' } });
        await new Promise(resolve => { complete = resolve; });
        onEvent({ event: 'done', data: { message: 'First token, final response.', function_calls: [] } });
    });
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: null } });
    let request;
    act(() => { request = result.current.sendMessage('Explain a checksum.'); });
    await waitFor(() => expect(result.current.messages.some(row => row.content === 'First token')).toBe(true));
    expect(result.current.sending).toBe(true);
    rerender({ id: 42 });
    expect(transportSignal.aborted).toBe(false);
    await act(async () => { complete(); await request; });
    expect(result.current.sending).toBe(false);
    expect(result.current.messages.filter(row => row.role === 'assistant')).toHaveLength(1);
});

test('stop aborts the upstream transport and duplicate clicks create one request', async () => {
    let signal;
    assistantAPI.streamMessage.mockImplementation((payload, options) => new Promise((resolve, reject) => {
        signal = options.signal;
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const { result } = renderHook(() => useChat());
    let request;
    act(() => { request = result.current.sendMessage('Hello'); result.current.sendMessage('Hello again'); });
    expect(assistantAPI.streamMessage).toHaveBeenCalledTimes(1);
    await act(async () => { result.current.stopGenerating(); await request; });
    expect(signal.aborted).toBe(true);
    expect(result.current.sending).toBe(false);
});

test('interrupted retry preserves the request ID and avoids a duplicated user bubble', async () => {
    assistantAPI.streamMessage.mockRejectedValueOnce(new Error('Connection interrupted'));
    assistantAPI.streamMessage.mockImplementationOnce(async (payload, { onEvent }) => {
        onEvent({ event: 'meta', data: { conversation_id: 12 } });
        onEvent({ event: 'done', data: { message: 'Recovered answer', function_calls: [] } });
    });
    const { result } = renderHook(() => useChat());
    await act(async () => { await result.current.sendMessage('Show my recent files'); });
    await act(async () => { await result.current.regenerateLastMessage(); });
    expect(assistantAPI.streamMessage.mock.calls[0][0]).toEqual(assistantAPI.streamMessage.mock.calls[1][0]);
    expect(result.current.messages.filter(row => row.role === 'user')).toHaveLength(1);
    expect(result.current.messages.filter(row => row.role === 'assistant')).toHaveLength(1);
});

test('switching conversations aborts the active request and ignores its late tokens', async () => {
    let callback;
    let signal;
    assistantAPI.streamMessage.mockImplementation((payload, options) => new Promise((resolve, reject) => {
        callback = options.onEvent; signal = options.signal;
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: null } });
    let request;
    act(() => { request = result.current.sendMessage('Explain a checksum'); });
    rerender({ id: 99 });
    await act(async () => { await request; callback({ event: 'delta', data: { text: 'Old private content' } }); });
    expect(signal.aborted).toBe(true);
    expect(result.current.messages.some(row => row.content === 'Old private content')).toBe(false);
});
