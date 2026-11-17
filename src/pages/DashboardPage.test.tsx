// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import DashboardPage from './DashboardPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
        fileUploadingPids: new Set<string>(),
        addFileUploadingPid: () => {},
        removeFileUploadingPid: () => {},
    }),
}));

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.includes('/questionnaires/projects/p1')) {
                return Promise.resolve({ ok: true, json: async () => [{ pid: 'q1' }] });
            }
            if (url.endsWith('/projects/p1/qualification')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [{ pid: 'd1', status: 'completed' }],
                });
            }
            if (url.endsWith('/projects/p1/controls')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [{ pid: 'cl1', question_count: 10 }],
                });
            }
            if (url.endsWith('/projects/p1/evaluations')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [{ pid: 'e1', status: 'Done' }],
                });
            }
            if (url.includes('/system-versions/latest')) {
                return Promise.resolve({ ok: true, json: async () => ({ number: 2 }) });
            }
            if (url.endsWith('/projects/p1/system-versions')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [
                        { pid: 'v1', number: 1 },
                        { pid: 'v2', number: 2 },
                    ],
                });
            }
            if (url.includes('/projects/p1/results')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        version: { pid: 'v2', number: 2 },
                        target: null,
                        dashboards_url: 'https://superset.example/dashboard?project=p1',
                        tools: [
                            {
                                plugin_name: 'fairness',
                                label: 'Fairness',
                                executed: 2,
                                failed: 1,
                                running: 0,
                                last_run: '2026-11-01T10:00:00Z',
                                local: false,
                                local_runs: 0,
                                helpers: [{ role: 'judge', model: 'gpt-4o-mini' }],
                                connections: [{ name: 'sys', protocol_name: 'openai' }],
                                dashboard_url: 'https://superset.example/dashboard?tool=fairness',
                            },
                        ],
                        greyed: [{ plugin_name: 'robustness', label: 'Robustness' }],
                    }),
                });
            }
            if (url.includes('/control-objectives/matrix')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ priorities: [{ key: true }] }),
                });
            }
            throw new Error(`unexpected fetch: ${url}`);
        }),
    );
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

async function renderPage() {
    await act(async () => {
        root.render(
            <MemoryRouter>
                <DashboardPage />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

describe('DashboardPage', () => {
    it('renders stat cards from existing endpoints', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Dashboard');
        expect(text).toContain('v2');
        expect(text).toContain('1/1 completed');
        expect(text).toContain('1 installed');
        expect(text).toContain('1/1 done');
    });

    it('links cards to their pages', async () => {
        await renderPage();
        const hrefs = Array.from(document.body.querySelectorAll('a')).map((a) =>
            a.getAttribute('href'),
        );
        expect(hrefs).toContain('/projects/demo/qualification');
        expect(hrefs).toContain('/projects/demo/checklists');
        expect(hrefs).toContain('/projects/demo/sandbox');
    });

    it('renders the scoped results tiles and the dashboard bridge', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Results');
        expect(text).toContain('Fairness');
        expect(text).toContain('2 completed · 1 failed · 0 running');
        expect(text).toContain('Helper models: Judge gpt-4o-mini');
        expect(text).toContain('Reached through openai (sys)');
        expect(text).toContain('Robustness');
        expect(text).toContain('Installed, not run on it yet');
        const hrefs = Array.from(document.body.querySelectorAll('a')).map((a) =>
            a.getAttribute('href'),
        );
        expect(hrefs).toContain('https://superset.example/dashboard?tool=fairness');
        expect(hrefs).toContain('https://superset.example/dashboard?project=p1');
    });
});
