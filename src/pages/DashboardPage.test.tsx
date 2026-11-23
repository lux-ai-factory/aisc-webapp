// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import DashboardPage from './DashboardPage';

// react-grid-layout v2 measures the DOM via useContainerWidth; stub both it and
// Responsive so page tests stay light.
vi.mock('react-grid-layout', async () => {
    const React = (await import('react')).default;
    return {
        useContainerWidth: () => ({
            containerRef: { current: null },
            width: 1000,
            mounted: true,
            measureWidth: () => {},
        }),
        // no-op compactor so GridDashboard's `<Responsive compactor={noCompactor}>` resolves
        noCompactor: { type: null, allowOverlap: false, compact: (l: unknown) => l },
        Responsive: (props: { children?: React.ReactNode; 'data-testid'?: string }) =>
            React.createElement('div', { 'data-testid': props['data-testid'] ?? 'rgl-canvas' }, props.children),
    };
});

// The measurement chart components pull in @mui/x-charts / @mui/x-data-grid,
// which don't resolve cleanly under vitest; they're leaf renderers, so stub them.
vi.mock('../components/plugin/MeasurementsDataGrid', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsLineChart', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsScatterChart', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsRadarChart', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsKDEChart', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsBarsChart', () => ({ default: () => null }));
vi.mock('../components/plugin/MeasurementsPieChart', () => ({ default: () => null }));

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
            if (url.includes('evaluations?status=Done')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [
                        {
                            pid: 'e1',
                            status: 'Done',
                            created_at: '2026-01-02T03:04:05Z',
                            evaluation_plugins: [
                                { pid: 'ep1', name: 'quality', display_name: 'Quality' },
                            ],
                        },
                    ],
                });
            }
            if (url.includes('/plugins/ep1/evaluations/e1/result')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        measurements: [
                            { name: 'accuracy', score: 0.9, time: '2026-01-02T03:04:05Z', dimensions: {} },
                        ],
                        metric_visualizations: [],
                    }),
                });
            }
            if (url.includes('/system-versions/latest')) {
                return Promise.resolve({ ok: true, json: async () => ({ number: 2 }) });
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

    it('renders the charts workspace selector', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Add chart');
        expect(text).toContain('No widgets yet');
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
});
