// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import DashboardWidgetPicker from './DashboardWidgetPicker';

vi.mock('../../lib/dashboardStorage', () => ({
    cachedDashboard: () => undefined,
    fetchDashboard: vi.fn(async () => ({ ...JSON.parse(localStorage.getItem('dashboard_grid_p1') ?? '{"widgets":[],"layouts":{}}'), revision: 1, can_edit: true })),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// The picker draws the dashboard's real charts; the MUI chart components are
// replaced here with a plain <svg> so imports stay light and paying.
vi.mock('../plugin/MeasurementsDataGrid', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsLineChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsScatterChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsRadarChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsKDEChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsPieChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsBarsChart', async () => {
    const React = (await import('react')).default;
    return {
        default: () =>
            React.createElement('svg', { 'data-chart': 'bars' }, React.createElement('text', null, 'bars')),
    };
});

// The picker rasterizes charts through exportChartPanels; mocking it lets us
// exercise the per-widget failure handling deterministically.
const { exportChartPanels } = vi.hoisted(() => ({ exportChartPanels: vi.fn() }));
vi.mock('./reportChartExport', () => ({ exportChartPanels }));

const doneEval = {
    pid: 'e1',
    status: 'Done',
    name: 'Run',
    created_at: '2026-10-01T10:00:00Z',
    evaluation_plugins: [{ pid: 'ep1', name: 'Tool', display_name: 'Tool' }],
};

const TEXT_WIDGET = { key: 'n1', kind: 'text' as const, text: 'a note' };

const roots: Root[] = [];

type Handle = { exportSelected: () => Promise<unknown[]> } | null;

async function renderWith(widgets: unknown[], selected: string[], onToggle = vi.fn()): Promise<Handle> {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
        // the result URL contains "/evaluations" too, so match it first
        if (url.includes('/result')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({
                    measurements: [{ metric: 'Accuracy', score: 0.9, dimensions: { category: 'en' } }],
                    metric_visualizations: [],
                }),
            });
        }
        if (url.includes('/evaluations')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [doneEval] });
        }
        return Promise.reject(new Error(`unexpected fetch ${url}`));
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container) as Root;
    roots.push(root);
    const ref: { current: Handle } = { current: null };
    await act(async () => {
        root.render(
            <DashboardWidgetPicker
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={ref as any}
                projectPid="p1"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                widgets={widgets as any}
                selected={new Set(selected)}
                onToggle={onToggle}
            />,
        );
    });
    return ref.current;
}

describe('DashboardWidgetPicker', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        const storage = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
        });
    });

    afterEach(async () => {
        await act(async () => { roots.splice(0).forEach((root) => root.unmount()); });
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('preserves saved geometry and gaps while scaling only the outer preview', async () => {
        const saved = JSON.stringify({
            widgets: [],
            layouts: { lg: [
                { i: 'n1', x: 0, y: 0, w: 10, h: 3 },
                { i: 'n2', x: 12, y: 4, w: 8, h: 5 },
                { i: 'deleted', x: 0, y: 50, w: 24, h: 10 },
            ] },
        });
        localStorage.setItem('dashboard_grid_p1', saved);
        let width = 600;
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
        let resize = () => {};
        const observe = vi.fn();
        const disconnect = vi.fn();
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) { resize = callback; }
            observe = observe;
            disconnect = disconnect;
        });
        await renderWith([
            TEXT_WIDGET,
            { ...TEXT_WIDGET, key: 'n2' },
            { ...TEXT_WIDGET, key: 'missing' },
        ], ['n1']);
        const grid = document.querySelector<HTMLElement>('.react-grid-layout')!;
        const scaled = grid.parentElement!;
        const bounds = scaled.parentElement!;
        expect(observe).toHaveBeenCalledTimes(1); // attached after loading
        expect(getComputedStyle(scaled).transform).toBe('scale(0.5)');
        expect(getComputedStyle(bounds).height).toBe('310px');
        const cards = Array.from(grid.children) as HTMLElement[];
        expect(cards).toHaveLength(3);
        expect(cards[0].style.width).toBe('490px');
        expect(cards[1].style.transform).toContain('606px');
        expect(cards[1].style.transform).toContain('212px');
        expect(cards[1].style.height).toBe('248px');
        expect(cards[2].style.transform).toContain('472px'); // appended at row 9
        expect(grid.querySelector('.react-resizable-handle')).toBeNull();
        const geometry = cards.map((card) => card.style.cssText);
        width = 360;
        await act(async () => resize());
        expect(getComputedStyle(scaled).transform).toBe('scale(0.3)');
        expect(getComputedStyle(bounds).height).toBe('186px');
        expect(cards.map((card) => card.style.cssText)).toEqual(geometry);
        width = 1500;
        await act(async () => resize());
        expect(getComputedStyle(scaled).transform).toBe('scale(1)');
        expect(localStorage.getItem('dashboard_grid_p1')).toBe(saved);
    });

    it('supports mouse and keyboard selection without changing the saved dashboard', async () => {
        const toggle = vi.fn();
        await renderWith([TEXT_WIDGET], [], toggle);
        const card = document.querySelector<HTMLElement>('[role="checkbox"]')!;
        expect(card.tabIndex).toBe(0);
        await act(async () => {
            card.click();
            card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
            card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        });
        expect(toggle.mock.calls).toEqual([['n1'], ['n1'], ['n1']]);
        expect(localStorage.getItem('dashboard_grid_p1')).toBeNull();
    });

    it('renders the widgets as selectable cards with their text/comments', async () => {
        await renderWith(
            [
                {
                    key: 'w1', kind: 'chart', plugin: 'Tool', chartType: 'bars',
                    title: 'Accuracy by category', comment: 'english results',
                },
                TEXT_WIDGET,
            ],
            ['w1'],
        );
        expect(document.body.textContent ?? '').toContain('Accuracy by category');
        expect(document.body.textContent ?? '').toContain('english results');
        expect(document.body.textContent ?? '').toContain('a note');
        expect(document.querySelector('[role="checkbox"][aria-checked="true"]')).not.toBeNull();
        expect(document.querySelector('[role="checkbox"][aria-checked="false"]')).not.toBeNull();
    });

    it('exports all facets in order with distinct keys, labels and comments', async () => {
        exportChartPanels.mockResolvedValueOnce([
            { image: 'png-a', svg: '<svg/>', label: 'language: a' },
            { image: 'png-b', svg: '<svg/>', label: 'language: b' },
        ]);
        const handle = await renderWith([
            { key: 'facets', kind: 'chart', plugin: 'Tool', chartType: 'bars',
                title: 'Quality', comment: 'note', facetDim: 'language' }, TEXT_WIDGET,
        ], ['facets', 'n1']);
        let exported: unknown[] = [];
        await act(async () => { exported = await handle!.exportSelected(); });
        expect(exported).toEqual([
            { key: 'facets:panel:0', kind: 'chart', title: 'Quality · language: a', comment: 'note', image: 'png-a' },
            { key: 'facets:panel:1', kind: 'chart', title: 'Quality · language: b', comment: 'note', image: 'png-b' },
            { key: 'n1', kind: 'text', text: 'a note' },
        ]);
    });

    it('exports only the selected widgets and keeps text notes verbatim', async () => {
        const handle = await renderWith(
            [
                {
                    key: 'w1', kind: 'chart', plugin: 'Tool', chartType: 'bars',
                    title: 'Accuracy by category',
                },
                TEXT_WIDGET,
            ],
            ['n1'],
        );
        let exported: unknown[] = [];
        await act(async () => {
            exported = await handle!.exportSelected();
        });
        expect(exported).toEqual([{ key: 'n1', kind: 'text', text: 'a note' }]);
    });

    it('skips a chart that throws and keeps the other charts and notes in order', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(exportChartPanels)
            .mockImplementationOnce(async () => { throw new Error('rasterize boom'); })
            .mockImplementationOnce(async () => [
                { image: 'data:image/png;base64,ok', svg: '<svg/>' },
            ]);
        const handle = await renderWith(
            [
                { key: 'c1', kind: 'chart', plugin: 'Tool', chartType: 'bars', title: 'Boom' },
                { key: 'c2', kind: 'chart', plugin: 'Tool', chartType: 'bars', title: 'Ok' },
                TEXT_WIDGET,
            ],
            ['c1', 'c2', 'n1'],
        );
        let exported: unknown[] = [];
        await act(async () => { exported = await handle!.exportSelected(); });
        // successful charts and notes keep their original order; the failed one
        // is skipped without rejecting the whole batch
        expect(exported).toEqual([
            { key: 'c2', kind: 'chart', title: 'Ok', image: 'data:image/png;base64,ok' },
            { key: 'n1', kind: 'text', text: 'a note' },
        ]);
        expect(warn).toHaveBeenCalled();
        expect(String(warn.mock.calls[0]?.[0] ?? '')).toContain('c1');
        warn.mockRestore();
        vi.mocked(exportChartPanels).mockReset();
    });

    it('skips a chart whose exporter returns no rendered image', async () => {
        vi.mocked(exportChartPanels).mockResolvedValue([]);
        const handle = await renderWith(
            [
                { key: 'c1', kind: 'chart', plugin: 'Tool', chartType: 'bars', title: 'No render' },
                TEXT_WIDGET,
            ],
            ['c1', 'n1'],
        );
        let exported: unknown[] = [];
        await act(async () => { exported = await handle!.exportSelected(); });
        expect(exported).toEqual([{ key: 'n1', kind: 'text', text: 'a note' }]);
        vi.mocked(exportChartPanels).mockReset();
    });
});
