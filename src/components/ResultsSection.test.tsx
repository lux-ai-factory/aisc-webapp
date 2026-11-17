// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ResultsSection from './ResultsSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const results = (dashboard: Record<string, unknown>) => ({
    version: { pid: 'v2', number: 2 },
    target: null,
    dashboards_url: dashboard.url ?? null,
    dashboard,
    tools: [
        {
            plugin_name: 'fairness',
            label: 'Fairness',
            executed: 1,
            failed: 0,
            running: 0,
            last_run: null,
            local: false,
            local_runs: 0,
            observations: 2,
            helpers: [],
            connections: [],
            dashboard_url: null,
        },
    ],
    greyed: [],
    charts: [
        {
            metric: 'accuracy',
            unit: 'ratio',
            count: 2,
            min_score: 0.4,
            max_score: 0.6,
            avg_score: 0.5,
        },
    ],
    chart_scope: { version: 2, target: null, evaluations: 1, local_models_left_out: 1 },
});

const stubFetch = (body: unknown, onPublish?: () => void) =>
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/results/dashboard')) {
            onPublish?.();
            return Promise.resolve({
                ok: true,
                json: async () => ({ registered: true, bridge_configured: true }),
            });
        }
        if (url.endsWith('/projects/p1/system-versions')) {
            return Promise.resolve({ ok: true, json: async () => [{ pid: 'v2', number: 2 }] });
        }
        if (init?.method) {
            throw new Error(`unexpected ${init.method} ${url}`);
        }
        return Promise.resolve({ ok: true, json: async () => body });
    });

async function render() {
    await act(async () => {
        root.render(<ResultsSection pid="p1" />);
    });
    await act(async () => {});
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('ResultsSection', () => {
    it('shows no dashboard link when the bridge is closed, and says why', async () => {
        vi.stubGlobal(
            'fetch',
            stubFetch(
                results({
                    url: null,
                    authenticated: false,
                    bridge_configured: false,
                    scope: { project: 'p1' },
                }),
            ),
        );
        await render();

        expect(document.body.querySelector('[data-testid="dashboard-link"]')).toBeNull();
        expect(document.body.textContent).toContain(
            'No dashboard link: the analytics bridge is not configured',
        );
        expect(document.body.querySelector('[data-testid="publish-dashboard"]')).toBeNull();
        // the charts are there anyway: the summary is the app's, not the dashboard's
        expect(document.body.querySelector('[data-testid="chart-row"]')?.textContent).toContain(
            'accuracy (ratio) · 0.50 mean of 2 · 0.40–0.60',
        );
        expect(document.body.textContent).toContain('1 local-model run(s) left out');
    });

    it('publishes the project to the dashboard and reports what it did', async () => {
        const onPublish = vi.fn();
        vi.stubGlobal(
            'fetch',
            stubFetch(
                results({
                    url: 'https://superset.example/dashboard?project=p1&sig=x',
                    authenticated: true,
                    bridge_configured: true,
                    scope: { project: 'p1', version: '2', target: null, tool: null },
                }),
                onPublish,
            ),
        );
        await render();

        expect(
            document.body
                .querySelector('[data-testid="dashboard-link"]')
                ?.getAttribute('href'),
        ).toBe('https://superset.example/dashboard?project=p1&sig=x');

        const button = document.body.querySelector(
            '[data-testid="publish-dashboard"]',
        ) as HTMLButtonElement | null;
        expect(button).not.toBeNull();
        await act(async () => button?.click());
        expect(onPublish).toHaveBeenCalledOnce();
        expect(document.body.textContent).toContain('The dashboard took this project.');
    });
});
