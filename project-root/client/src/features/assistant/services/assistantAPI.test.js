import { TextEncoder, TextDecoder } from 'util';
import api from '../../../utils/api';
import { assistantAPI } from './assistantAPI';
jest.mock('../../../utils/api', () => ({ post: jest.fn() }));
global.TextDecoder = TextDecoder;

test('parses fragmented SSE data incrementally and closes the reader', async () => {
    const encoder = new TextEncoder();
    const chunks = ['event: delta\ndata: {"text":"First"}\n', '\nevent: delta\ndata: {"text":" second"}\n\nevent: done\ndata: {"message":"First second"}\n\n'];
    const reader = { read: jest.fn(), cancel: jest.fn().mockResolvedValue(), releaseLock: jest.fn() };
    chunks.forEach(value => reader.read.mockResolvedValueOnce({ done: false, value: encoder.encode(value) }));
    reader.read.mockResolvedValueOnce({ done: true });
    api.post.mockResolvedValue({ data: { getReader: () => reader } });
    const onEvent = jest.fn();
    await assistantAPI.streamMessage({ message: 'Hi' }, { onEvent, signal: new AbortController().signal });
    expect(onEvent.mock.calls.map(([event]) => event.event)).toEqual(['delta', 'delta', 'done']);
    expect(reader.cancel).toHaveBeenCalled();
    expect(api.post.mock.calls[0][2].adapter).toBe('fetch');
});

test('an interrupted stream requires recovery rather than silently succeeding', async () => {
    const reader = { read: jest.fn().mockResolvedValue({ done: true }), cancel: jest.fn().mockResolvedValue(), releaseLock: jest.fn() };
    api.post.mockResolvedValue({ data: { getReader: () => reader } });
    await expect(assistantAPI.streamMessage({ message: 'Hi' }, { onEvent: jest.fn(), signal: new AbortController().signal })).rejects.toThrow('before the response completed');
});
