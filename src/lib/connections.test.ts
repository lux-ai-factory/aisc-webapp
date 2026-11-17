import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    bindRun,
    discoverAgentCard,
    getConnections,
    getRunBindings,
    linkConnectionTarget,
    listComponents,
    removeConnection,
    saveConnection,
    tryConnection,
} from './connections';

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

describe('connections client', () => {
    it('reads the project connections and the protocols served', async () => {
        const seen: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                seen.push(url);
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        adapters: [{ kind: 'openai', label: 'OpenAI-compatible' }],
                        connections: [],
                    }),
                });
            }),
        );
        const list = await getConnections('p1');
        expect(seen[0]).toContain('/projects/p1/connections');
        expect(list.adapters[0].kind).toBe('openai');
    });

    it('saves a connection with its own fields and never the key back', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ name: 'c1', has_secret: true }),
                });
            }),
        );
        const saved = await saveConnection('p1', 'c1', {
            label: 'the system',
            kind: 'rest',
            base_url: 'http://system.local',
            path: '/chat',
            body_template: { q: '{{input}}' },
            secret: 'k',
            secret_headers: { 'X-Token': 't' },
        });
        expect(calls[0].url).toContain('/projects/p1/connections/c1');
        expect(calls[0].init?.method).toBe('PUT');
        expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
            kind: 'rest',
            path: '/chat',
            body_template: { q: '{{input}}' },
        });
        expect(saved.has_secret).toBe(true);
        expect(JSON.stringify(saved)).not.toContain('k');
    });

    it('removes, links a target and tries a connection', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                if (url.endsWith('/test')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ ok: true, answer: 'hi', latency_ms: 5 }),
                    });
                }
                return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
            }),
        );
        await removeConnection('p1', 'c1');
        expect(calls[0].init?.method).toBe('DELETE');

        await linkConnectionTarget('p1', 'c1', 'comp-1');
        expect(calls[1].url).toContain('/connections/c1/target');
        expect(JSON.parse(String(calls[1].init?.body))).toEqual({ key: 'comp-1' });

        const tried = await tryConnection('p1', 'c1', 'why?');
        expect(calls[2].url).toContain('/connections/c1/test');
        expect(JSON.parse(String(calls[2].init?.body))).toEqual({ input: 'why?' });
        expect(tried.answer).toBe('hi');
    });

    it('reads an agent card', async () => {
        stub({ name: 'agent', url: 'http://a/.well-known/agent-card.json', capabilities: {} });
        const card = await discoverAgentCard('p1', 'c1');
        expect(card.name).toBe('agent');
    });

    it('reads the components a target may be linked to', async () => {
        stub({ components: [{ pid: 'comp-1', name: 'the llm', component_type: 'llm' }] });
        const components = await listComponents('p1');
        expect(components).toEqual([{ key: 'comp-1', name: 'the llm', component_type: 'llm' }]);
    });

    it('reads and writes what a run used', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () =>
                        init?.method === 'PUT'
                            ? { role: 'judge', helper: 'judge-1' }
                            : { bindings: [{ role: '', kind: 'openai' }] },
                });
            }),
        );
        const bindings = await getRunBindings('p1', 'run-1');
        expect(calls[0].url).toContain('/projects/p1/runs/run-1/bindings');
        expect(bindings[0].kind).toBe('openai');

        const bound = await bindRun('p1', 'run-1', { role: 'judge', helper: 'judge-1' });
        expect(bound.helper).toBe('judge-1');
    });

    it('surfaces a refusal detail', async () => {
        stub({ detail: 'unknown protocol' }, false, 400);
        await expect(
            saveConnection('p1', 'c1', { kind: 'carrier-pigeon', base_url: '' }),
        ).rejects.toThrow('unknown protocol');
    });
});
