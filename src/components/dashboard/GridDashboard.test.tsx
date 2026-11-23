// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import GridDashboard from './GridDashboard';
import { clearSessionCache } from '../../lib/dashboardCharts';

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
        Responsive: (props: { children?: React.ReactNode; layouts?: unknown }) =>
            React.createElement('div', { 'data-layouts': JSON.stringify(props.layouts ?? null) }, props.children),
    };
});

vi.mock('../plugin/MeasurementsDataGrid', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsLineChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsScatterChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsRadarChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsKDEChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsBarsChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsPieChart', () => ({ default: () => null }));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let store = new Map<string, string>();
let container: HTMLElement;
let root: Root;
let doneEvals: unknown[] = [];

beforeEach(() => {
    doneEvals = [
        {
            pid: 'e1',
            status: 'Done',
            created_at: '2026-01-02T03:04:05Z',
            evaluation_plugins: [{ pid: 'ep1', name: 'quality', display_name: 'Quality' }],
        },
    ];
    clearSessionCache(); // session cache otherwise survives between tests
    store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
        get length() { return store.size; },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.includes('evaluations?status=Done')) {
                return Promise.resolve({ ok: true, json: async () => doneEvals });
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

async function renderDashboard() {
    await act(async () => {
        root.render(
            <MemoryRouter>
                <GridDashboard projectUUID="p1" />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

describe('GridDashboard', () => {
    it('shows the compact toolbar and an empty-grid hint', async () => {
        await renderDashboard();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Add chart');
        expect(text).toContain('No widgets yet');
    });

    it('adds a comment widget to every breakpoint layout and persists it', async () => {
        await renderDashboard();
        const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add comment'),
        )!;
        await act(async () => { button.click(); });
        await act(async () => {});
        const saved = JSON.parse(localStorage.getItem('dashboard_grid_p1') ?? '{}');
        expect(saved.widgets.map((w: { kind: string }) => w.kind)).toEqual(['text']);
        // independent per-breakpoint layouts, all carry the new widget (no 1×1 gaps)
        for (const bp of ['lg', 'md', 'sm', 'xs', 'xxs']) {
            expect(saved.layouts[bp]).toHaveLength(1);
        }
    });

    it('restores widgets and layouts from a saved grid state', async () => {
        localStorage.setItem(
            'dashboard_grid_p1',
            JSON.stringify({
                widgets: [{ key: 'w-x', kind: 'chart', plugin: 'quality', chartType: 'line' }],
                layouts: { lg: [{ i: 'w-x', x: 0, y: 0, w: 6, h: 6 }] },
            }),
        );
        await renderDashboard();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Quality · line');
        expect(text).toContain('No measurements for this plugin');
    });

    it('shows comments read-only and only edits them on the widget', async () => {
        await renderDashboard();
        const addComment = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add comment'),
        )!;
        await act(async () => { addComment.click(); });
        await act(async () => {});

        // saved state: read-only text, no editor yet
        expect(document.body.textContent).toContain('Empty note');
        expect(document.body.querySelector('textarea')).toBeNull();

        // enter edit mode from the header (same pencil as charts) and type
        const edit = document.body.querySelector('[aria-label="Edit comment"]') as HTMLButtonElement;
        expect(edit).toBeTruthy();
        await act(async () => { edit.click(); });
        await act(async () => {});
        const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
        await act(async () => {
            setter.call(textarea, 'hello note');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // save commits the note and returns to the read-only (saved) state
        (document.body.querySelector('[aria-label="Save comment"]') as HTMLButtonElement).click();
        await act(async () => {});
        expect(localStorage.getItem('dashboard_grid_p1') ?? '').toContain('hello note');
        expect(document.body.querySelector('textarea')).toBeNull();
        expect(document.body.textContent).toContain('hello note');
    });

    it('adds a comment even before any evaluation completed', async () => {
        doneEvals = [];
        await renderDashboard();
        // empty-state hint no longer blocks comments
        expect(document.body.textContent ?? '').toContain('add comments');
        const addComment = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add comment'),
        )!;
        await act(async () => { addComment.click(); });
        await act(async () => {});
        // grid renders the comment widget instead of the no-evaluations message
        expect(document.body.querySelectorAll('[aria-label="Edit comment"]')).toHaveLength(1);
        expect(document.body.textContent ?? '').not.toContain('Run an evaluation first');
    });

    it('keeps existing widgets when adding a chart through the builder', async () => {
        await renderDashboard();
        const addComment = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add comment'),
        )!;
        await act(async () => { addComment.click(); });
        await act(async () => {});

        const openBuilder = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add chart'),
        )!;
        await act(async () => { openBuilder.click(); });
        await act(async () => {});
        const submit = Array.from(document.body.querySelectorAll('button'))
            .reverse()
            .find((b) => (b.textContent ?? '').includes('Add chart'))!;
        await act(async () => { submit.click(); });
        await act(async () => {});

        const saved = JSON.parse(localStorage.getItem('dashboard_grid_p1') ?? '{}');
        expect(saved.widgets.map((w: { kind: string }) => w.kind)).toEqual(['text', 'chart']);
        expect(saved.widgets.length).toBe(2);
        // existing comment layout untouched, chart appended in every breakpoint
        for (const bp of ['lg', 'md', 'sm', 'xs', 'xxs']) {
            expect(saved.layouts[bp].length).toBe(2);
        }
    });

    it('creates one chart widget per selected facet through the builder', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('evaluations?status=Done')) {
                    return Promise.resolve({ ok: true, json: async () => doneEvals });
                }
                if (url.includes('/result')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            measurements: [
                                { name: 'acc', score: 0.5, time: 't', created_at: 't', dimensions: { fold: 'a' } },
                                { name: 'acc', score: 0.6, time: 't2', created_at: 't2', dimensions: { fold: 'a' } },
                                { name: 'acc', score: 0.9, time: 't3', created_at: 't3', dimensions: { fold: 'b' } },
                            ],
                            metric_visualizations: [],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        await renderDashboard();

        const openBuilder = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Add chart'),
        )!;
        await act(async () => { openBuilder.click(); });
        await act(async () => {});

        // chart type -> Bars, then facet by "fold"
        for (const [labelText, optionText] of [
            ['Chart type', 'Bars'],
            ['Facet (iterate) by dim', 'fold'],
        ] as const) {
            const combo = Array.from(document.body.querySelectorAll<HTMLElement>('[role="combobox"]')).find((c) =>
                (c.closest('.MuiFormControl-root')?.querySelector('label')?.textContent ?? '').includes(labelText),
            );
            expect(combo, `expected the "${labelText}" select`).toBeTruthy();
            await act(async () => {
                combo!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                combo!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
            const option = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
                (m) => (m.textContent ?? '').trim() === optionText,
            );
            expect(option, `expected a "${optionText}" option`).toBeTruthy();
            await act(async () => { (option as HTMLElement).click(); });
            await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
        }

        // facet selection defaults to every value ("a","b") as chips in the select
        const facetSelect = Array.from(document.body.querySelectorAll<HTMLElement>('[role="combobox"]')).find((c) =>
            (c.closest('.MuiFormControl-root')?.querySelector('label')?.textContent ?? '').includes('Facet charts to add'),
        )!;
        expect(facetSelect.textContent).toContain('a');
        expect(facetSelect.textContent).toContain('b');

        // submit via the dialog action button
        const submit = Array.from(document.body.querySelectorAll('button'))
            .reverse()
            .find((b) => (b.textContent ?? '').includes('Add chart'))!;
        await act(async () => { submit.click(); });
        await act(async () => {});

        const saved = JSON.parse(localStorage.getItem('dashboard_grid_p1') ?? '{}');
        expect(saved.widgets).toHaveLength(2);
        const byFilter = new Map(saved.widgets.map((w: { filters: Record<string, string[]> }) => [
            (w.filters?.fold ?? [])[0],
            w,
        ]));
        // one chart per facet value, each pinned via filter and no longer faceted
        expect(byFilter.get('a')).toMatchObject({ chartType: 'bars', facetDim: '' });
        expect(byFilter.get('b')).toMatchObject({ chartType: 'bars', facetDim: '' });
        // both appended on fresh rows below everything (per breakpoint)
        for (const bp of ['lg', 'md', 'sm', 'xs', 'xxs']) {
            expect(saved.layouts[bp]).toHaveLength(2);
        }
    });
});
