// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { ResponsiveProps } from 'react-grid-layout';
import { cloneLayout, getAllCollisions, moveElement } from 'react-grid-layout/core';

const grid = vi.hoisted(() => ({ current: null as ResponsiveProps | null }));

import GridDashboard from './GridDashboard';
import { saveDashboard, flushDashboardSave } from '../../lib/dashboardStorage';
import { clearSessionCache, getDoneEvaluations } from '../../lib/dashboardCharts';

vi.mock('../../lib/dashboardStorage', async () => {
    const actual = await vi.importActual<typeof import('../../lib/dashboardStorage')>('../../lib/dashboardStorage');
    return {
        ...actual,
        flushDashboardSave: vi.fn(actual.flushDashboardSave),
        fetchDashboard: vi.fn(async () => ({ ...JSON.parse(localStorage.getItem('dashboard_grid_p1') ?? '{"widgets":[],"layouts":{}}'), revision: 1, can_edit: true })),
        saveDashboard: vi.fn(async (_pid, state, revision) => ({ ...state, revision: revision + 1, can_edit: true })),
    };
});

vi.mock('react-grid-layout', async () => {
    const React = (await import('react')).default;
    const { noCompactor } = await import('react-grid-layout/core');
    return {
        useContainerWidth: () => ({
            containerRef: { current: null },
            width: 1000,
            mounted: true,
            measureWidth: () => {},
        }),
        noCompactor,
        Responsive: (props: ResponsiveProps) => {
            grid.current = props;
            return React.createElement('div', { 'data-layouts': JSON.stringify(props.layouts ?? null) }, props.children);
        },
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
const scrollIntoView = vi.fn();
const originalScroll = HTMLElement.prototype.scrollIntoView;
async function nextFrame() {
    await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
}

beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
    vi.mocked(saveDashboard).mockClear();
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
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            if (url.endsWith('/dashboard') && init?.method === 'PUT') {
                const { revision, ...state } = JSON.parse(String(init.body));
                return saveDashboard(url.split('/projects/')[1].split('/')[0], state, revision)
                    .then((saved) => ({ ok: true, json: async () => saved }));
            }
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
    HTMLElement.prototype.scrollIntoView = originalScroll;
});

async function renderDashboard(projectUUID = 'p1') {
    await act(async () => {
        root.render(
            <MemoryRouter>
                <GridDashboard projectUUID={projectUUID} />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

describe('GridDashboard', () => {
    it('reveals a new comment once, then leaves edits and saves in place', async () => {
        await renderDashboard();
        await nextFrame();
        expect(scrollIntoView).not.toHaveBeenCalled();
        await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Add comment"]')!.click());
        await nextFrame();
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', block: 'nearest' });
        expect(scrollIntoView.mock.contexts[0]).toBe(
            document.querySelector('[aria-label="Edit comment"]')!.closest('[data-layouts]')!.firstElementChild,
        );
        await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Edit comment"]')!.click());
        await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Save comment"]')!.click());
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
        await nextFrame();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('cancels a pending scroll when switching projects', async () => {
        await renderDashboard();
        let callback: FrameRequestCallback | undefined;
        const cancelled = vi.fn();
        vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { callback = fn; return 123; }));
        vi.stubGlobal('cancelAnimationFrame', cancelled);
        await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Add comment"]')!.click());
        expect(callback).toBeDefined();
        await renderDashboard('p2');
        expect(cancelled).toHaveBeenCalledWith(123);
        await act(async () => callback!(0)); // even a stale queued callback must not scroll
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('flushes the departing project before the debounce expires', async () => {
        await renderDashboard();
        const add = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Add comment'))!;
        await act(async () => add.click());
        vi.mocked(flushDashboardSave).mockClear();
        await act(async () => root.render(<div />));
        expect(flushDashboardSave).toHaveBeenCalledWith('p1');
    });

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
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
        const saved = vi.mocked(saveDashboard).mock.calls[0][1];
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
        await nextFrame();
        expect(scrollIntoView).not.toHaveBeenCalled();
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
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
        expect(JSON.stringify(vi.mocked(saveDashboard).mock.calls[0][1])).toContain('hello note');
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

        await nextFrame();
        scrollIntoView.mockClear();
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

        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
        await nextFrame();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(document.querySelector('[data-layouts]')!.lastElementChild);
        const saved = vi.mocked(saveDashboard).mock.calls[0][1];
        expect(saved.widgets.map((w: { kind: string }) => w.kind)).toEqual(['text', 'chart']);
        expect(saved.widgets.length).toBe(2);
        // existing comment layout untouched, chart appended in every breakpoint
        for (const bp of ['lg', 'md', 'sm', 'xs', 'xxs']) {
            expect(saved.layouts[bp]?.length).toBe(2);
        }
    });

    it('creates one chart widget per selected facet through the builder', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            if (url.endsWith('/dashboard') && init?.method === 'PUT') {
                const { revision, ...state } = JSON.parse(String(init.body));
                return saveDashboard(url.split('/projects/')[1].split('/')[0], state, revision)
                    .then((saved) => ({ ok: true, json: async () => saved }));
            }
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
        await nextFrame();
        expect(scrollIntoView).not.toHaveBeenCalled(); // dialog is still exiting

        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
        await nextFrame();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        const grid = document.querySelector('[data-layouts]')!;
        expect(scrollIntoView.mock.contexts[0]).toBe(grid.firstElementChild);
        const saved = vi.mocked(saveDashboard).mock.calls[0][1];
        expect(saved.widgets).toHaveLength(2);
        const byFilter = new Map(saved.widgets.map((w) => [
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


async function openChartBuilder() {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Add chart"]')!;
    await act(async () => button.click());
    return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe('evaluation freshness', () => {
    it('revalidates a cached empty list immediately on entering the dashboard', async () => {
        const available = doneEvals;
        doneEvals = [];
        await getDoneEvaluations('p1');
        doneEvals = available;
        await renderDashboard();
        const dialog = await openChartBuilder();
        expect(dialog?.textContent).toContain('1 evaluation(s)');
        expect(dialog?.textContent).toContain('Quality');
    });

    it('loads newly completed runs before opening Add chart without resetting an open draft', async () => {
        doneEvals = [];
        await renderDashboard();
        doneEvals = [{ pid: 'e2', status: 'Done', name: 'New run', evaluation_plugins: [{ pid: 'ep2', name: 'quality', display_name: 'Quality' }] }];
        const dialog = await openChartBuilder();
        expect(dialog?.textContent).toContain('1 evaluation(s)');
        const allInputs = Array.from(dialog!.querySelectorAll<HTMLInputElement>('input'));
        const titleInput = allInputs.find((input) => input.labels?.[0]?.textContent?.toLowerCase().includes('title'))!;
        expect(titleInput).toBeTruthy();
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
            setter.call(titleInput, 'My chart draft');
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        doneEvals = [...doneEvals, { pid: 'e3', status: 'Done', evaluation_plugins: [] }];
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(titleInput.value).toBe('My chart draft');
        expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    });

    it('updates plugin metadata for an existing evaluation ID', async () => {
        const available = doneEvals;
        doneEvals = [{ pid: 'e1', status: 'Done', evaluation_plugins: [] }];
        await renderDashboard();
        doneEvals = available;
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect((await openChartBuilder())?.textContent).toContain('Quality');
    });

    it('keeps Add chart loading until evaluations arrive and retries failed requests', async () => {
        await renderDashboard();
        const original = fetch;
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));
        expect(await openChartBuilder()).toBeNull();
        expect(document.body.textContent).toContain('offline');
        let release!: () => void;
        vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
            release = () => resolve({ ok: true, json: async () => doneEvals });
        })));
        await openChartBuilder();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(document.querySelector<HTMLButtonElement>('button[aria-label="Add chart"]')?.disabled).toBe(true);
        await act(async () => release());
        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(document.body.textContent).not.toContain('offline');
        vi.stubGlobal('fetch', original);
    });

    it('uses the newly selected project instead of retaining the previous evaluation list', async () => {
        await renderDashboard();
        doneEvals = [{ pid: 'other', status: 'Done', evaluation_plugins: [{ pid: 'other-plugin', name: 'other', display_name: 'Other project tool' }] }];
        await renderDashboard('p2');
        const dialog = await openChartBuilder();
        expect(dialog?.textContent).toContain('Other project tool');
        expect(dialog?.textContent).not.toContain('Quality');
    });
});

describe('dashboard dragging', () => {
    for (const occupied of [false, true]) {
        it(`crosses cards freely, then ${occupied ? 'restores an occupied drop' : 'persists a free drop'}`, async () => {
            const initial = [
                { i: 'fixed', x: 0, y: 0, w: 6, h: 3 },
                { i: 'dragged', x: 0, y: 5, w: 6, h: 3 },
            ];
            localStorage.setItem('dashboard_grid_p1', JSON.stringify({
                widgets: initial.map((item) => ({ key: item.i, kind: 'text', text: item.i })),
                layouts: { lg: initial },
            }));
            await renderDashboard();
            await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
            vi.mocked(saveDashboard).mockClear();
            expect(grid.current!.compactor).toMatchObject({ type: null, allowOverlap: false, preventCollision: true });
            const layout = cloneLayout(grid.current!.layouts!.lg!);
            const original = { ...layout[1] };
            const event = new MouseEvent('mouseup');
            const node = document.createElement('div');
            await act(async () => { grid.current!.onDragStart!(layout, original, layout[1], null, event, node); });
            const compactor = grid.current!.compactor!;
            expect(compactor).toMatchObject({ type: null, allowOverlap: true, preventCollision: false });
            // Exercise RGL's real movement code: the card crosses an occupied cell.
            let moved = moveElement(layout, layout[1], 0, 0, true,
                compactor.preventCollision, compactor.type, 24, compactor.allowOverlap);
            expect(getAllCollisions(moved, moved[1])).toHaveLength(1);
            expect(moved[0]).toMatchObject(initial[0]);
            expect(saveDashboard).not.toHaveBeenCalled(); // transient overlap is never saved
            if (!occupied) {
                moved = moveElement(moved, moved[1], 12, 0, true,
                    compactor.preventCollision, compactor.type, 24, compactor.allowOverlap);
            }
            const final = compactor.compact(moved, 24);
            await act(async () => {
                // RGL calls onDragStop before committing and reporting this same array.
                grid.current!.onDragStop!(final, original, final[1], null, event, node);
                grid.current!.onLayoutChange!(final, { ...grid.current!.layouts, lg: final });
            });
            expect(getAllCollisions(final, final[1])).toHaveLength(0);
            expect(final[0]).toMatchObject(initial[0]);
            expect(final[1]).toMatchObject({ ...initial[1], x: occupied ? 0 : 12, y: occupied ? 5 : 0 });
            expect(grid.current!.compactor).toMatchObject({ allowOverlap: false, preventCollision: true });
            await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
            for (const [, saved] of vi.mocked(saveDashboard).mock.calls) {
                expect(saved.layouts.lg![0]).toMatchObject(initial[0]);
                expect(getAllCollisions(saved.layouts.lg!, saved.layouts.lg![1])).toHaveLength(0);
            }
            if (!occupied) {
                expect(saveDashboard).toHaveBeenCalled();
                const calls = vi.mocked(saveDashboard).mock.calls;
                expect(calls[calls.length - 1][1].layouts.lg![1])
                    .toMatchObject({ x: 12, y: 0 });
            }
        });
    }
});

describe('drag edge auto-scroll', () => {
    for (const touch of [false, true]) {
        it(`scrolls at either page edge while ${touch ? 'touch' : 'mouse'} dragging, and stops on release`, async () => {
            localStorage.setItem('dashboard_grid_p1', JSON.stringify({
                widgets: [{ key: 'note', kind: 'text', text: 'Note' }],
                layouts: { lg: [{ i: 'note', x: 0, y: 0, w: 6, h: 3 }] },
            }));
            await renderDashboard();
            const root = document.documentElement;
            const height = vi.spyOn(root, 'scrollHeight', 'get').mockReturnValue(1000);
            root.scrollTop = 100;
            vi.stubGlobal('innerHeight', 600);
            const frames = new Map<number, FrameRequestCallback>();
            let id = 0;
            vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
                frames.set(++id, callback);
                return id;
            }));
            vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => frames.delete(frame)));
            const scrollBy = vi.fn((options: ScrollToOptions) => { root.scrollTop += options.top ?? 0; });
            vi.stubGlobal('scrollBy', scrollBy);
            const moves: Event[] = [];
            const record = (event: Event) => moves.push(event);
            const moveType = touch ? 'touchmove' : 'mousemove';
            document.addEventListener(moveType, record);
            const pointer = (clientY: number) => {
                if (!touch) return new MouseEvent('mousemove', { clientX: 100, clientY });
                const event = new Event('touchmove');
                Object.defineProperty(event, 'touches', {
                    value: [{ clientX: 100, clientY, identifier: 5 }],
                });
                return event;
            };
            const tick = async () => {
                const [frame, callback] = [...frames.entries()][0];
                frames.delete(frame);
                await act(async () => callback(0));
            };
            try {
                const layout = grid.current!.layouts!.lg!;
                const start = pointer(580);
                await act(async () => {
                    grid.current!.onDragStart!(layout, layout[0], layout[0], null, start as MouseEvent, root);
                });
                await tick();
                expect(scrollBy).toHaveBeenLastCalledWith({ top: 12, behavior: 'instant' });
                expect(root.scrollTop).toBe(112);
                expect(moves).toHaveLength(1); // RGL receives updated coordinates even without pointer movement
                if (touch) expect((moves[0] as TouchEvent).touches[0].identifier).toBe(5);
                else expect((moves[0] as MouseEvent).clientY).toBe(580);
                await tick();
                expect(root.scrollTop).toBe(124); // continues while the pointer stays at the edge
                document.dispatchEvent(pointer(20));
                await tick();
                expect(root.scrollTop).toBe(112);
                document.dispatchEvent(pointer(300));
                scrollBy.mockClear();
                await tick();
                expect(scrollBy).not.toHaveBeenCalled();
                root.scrollTop = 400;
                document.dispatchEvent(pointer(580));
                await tick();
                expect(scrollBy).not.toHaveBeenCalled(); // page bottom is respected
                window.dispatchEvent(new Event('blur'));
                expect(frames.size).toBe(0);
                await act(async () => {
                    grid.current!.onDragStop!(layout, layout[0], layout[0], null, start as MouseEvent, root);
                });
                expect(frames.size).toBe(0);
            } finally {
                document.removeEventListener(moveType, record);
                root.scrollTop = 0;
                height.mockRestore();
            }
        });
    }
});
