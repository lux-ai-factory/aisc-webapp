import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConnections, updateConnection } from './connections';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('connections client', () => {
    it('reads the project connections', async () => {
        const seen: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                seen.push(url);
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ adapters: ['builtin', 'openai'], connections: [] }),
                });
            }),
        );
        const list = await getConnections('p1');
        expect(seen[0]).toContain('/projects/p1/connections');
        expect(list.adapters).toContain('openai');
    });

    it('puts the adapter and helper role', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
            }),
        );
        await updateConnection('p1', 'c1', { adapter: 'a2a', helper_role: 'judge' });
        expect(calls[0].url).toContain('/projects/p1/connections/c1');
        expect(calls[0].init?.method).toBe('PUT');
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({
            adapter: 'a2a',
            adapter_version: '',
            helper_role: 'judge',
        });
    });

    it('surfaces a refusal detail', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
                json: async () => ({ detail: 'your role does not allow this' }),
            }),
        );
        await expect(updateConnection('p1', 'c1', { adapter: 'rest' })).rejects.toThrow(
            'your role does not allow this',
        );
    });
});
