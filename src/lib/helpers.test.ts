import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHelpers, removeHelper, saveHelper, testHelper } from './helpers';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const stub = (payload: unknown, ok = true, status = 200) =>
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok, status, json: async () => payload }),
    );

describe('helpers client', () => {
    it('reads the role catalogue and the helpers', async () => {
        const seen: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                seen.push(url);
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ can_manage: true, roles: ['judge'], helpers: [] }),
                });
            }),
        );
        const list = await getHelpers('p1');
        expect(seen[0]).toContain('/projects/p1/helpers');
        expect(list.roles).toEqual(['judge']);
    });

    it('saves a helper with its roles and key', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ name: 'judge-1', has_key: true }),
                });
            }),
        );
        await saveHelper('p1', 'judge-1', {
            label: 'Judge',
            endpoint_url: 'http://judge.local/v1',
            roles: ['judge', 'grader'],
            key: 'k',
        });
        expect(calls[0].url).toContain('/projects/p1/helpers/judge-1');
        expect(calls[0].init?.method).toBe('PUT');
        expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
            roles: ['judge', 'grader'],
            key: 'k',
        });
    });

    it('removes a helper and tests one with its model', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ ok: true, status: 'reachable', latency_ms: 3 }),
                });
            }),
        );
        await removeHelper('p1', 'judge-1');
        expect(calls[0].init?.method).toBe('DELETE');

        const outcome = await testHelper('p1', 'judge-1', 'm1');
        expect(calls[1].url).toContain('/helpers/judge-1/test');
        expect(JSON.parse(String(calls[1].init?.body))).toEqual({ model: 'm1' });
        expect(outcome.status).toBe('reachable');
    });

    it('surfaces a refusal detail', async () => {
        stub({ detail: 'unknown role(s): wizard' }, false, 400);
        await expect(
            saveHelper('p1', 'h1', { endpoint_url: 'http://h/v1', roles: ['wizard'] }),
        ).rejects.toThrow('unknown role(s): wizard');
    });
});
