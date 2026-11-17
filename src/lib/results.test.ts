// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import { connectionsLine, getProjectResults, helperModelsLine } from './results';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('results helpers', () => {
    it('formats the helper models line like the pilot', () => {
        expect(helperModelsLine([])).toBe('');
        expect(
            helperModelsLine([
                { role: 'judge', model: 'gpt-4o-mini' },
                { role: 'attacker', model: 'llama-3' },
            ]),
        ).toBe('Judge gpt-4o-mini, Attacker llama-3');
    });

    it('names each connection once, protocol first', () => {
        expect(connectionsLine([])).toBe('');
        expect(
            connectionsLine([
                { name: 'sys', protocol_name: 'openai' },
                { name: 'sys', protocol_name: 'openai' },
                { name: 'agent', protocol_name: 'a2a' },
            ]),
        ).toBe('openai (sys), a2a (agent)');
    });

    it('scopes the request by version and target', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: null,
                target: null,
                dashboards_url: null,
                tools: [],
                greyed: [],
            }),
        });
        vi.stubGlobal('fetch', fetchMock);
        await getProjectResults('p1', { version: 'v2', target: 'c1' });
        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain('/projects/p1/results?');
        expect(url).toContain('version=v2');
        expect(url).toContain('target=c1');
    });
});
