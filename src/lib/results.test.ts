// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    chartSummary,
    connectionsLine,
    getProjectResults,
    helperModelsLine,
    publishToDashboard,
    withdrawFromDashboard,
} from './results';

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

    it('reads a chart row as a person does', () => {
        expect(
            chartSummary({
                metric: 'accuracy',
                unit: 'ratio',
                count: 3,
                min_score: 0.4,
                max_score: 0.9,
                avg_score: 0.625,
            }),
        ).toBe('0.63 mean of 3 · 0.40–0.90');
        expect(
            chartSummary({
                metric: 'coverage',
                unit: '',
                count: 0,
                min_score: null,
                max_score: null,
                avg_score: null,
            }),
        ).toBe('— mean of 0');
    });

    it('publishes and withdraws the project on the dashboard bridge', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ registered: true, bridge_configured: true }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ removed: false }) });
        vi.stubGlobal('fetch', fetchMock);

        await expect(publishToDashboard('p1')).resolves.toEqual({
            registered: true,
            bridge_configured: true,
        });
        expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/p1/results/dashboard');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });

        await expect(withdrawFromDashboard('p1')).resolves.toEqual({ removed: false });
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
    });

    it('scopes the request by version and target', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                version: null,
                target: null,
                dashboards_url: null,
                dashboard: {
                    url: null,
                    authenticated: false,
                    bridge_configured: false,
                    scope: {},
                },
                tools: [],
                greyed: [],
                charts: [],
                chart_scope: {
                    version: null,
                    target: null,
                    evaluations: 0,
                    local_models_left_out: 0,
                },
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
