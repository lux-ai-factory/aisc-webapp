// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    EVAL_DIM_KEY,
    tagEvaluation,
    combineByPlugin,
    selectMeasurements,
    availableMetrics,
    availableDimensionKeys,
    loadGridState,
    saveGridState,
    clearGridState,
    loadSelection,
    saveSelection,
    uid,
    getDoneEvaluations,
    getPluginMeasurements,
    getCachedDoneEvaluations,
    getCachedPluginMeasurements,
    isEvalsCacheFresh,
    clearSessionCache,
    scaleLayout,
    nextWidgetSlot,
    splitFacetWidgets,
    type EvalRow,
    type GridItemLayout,
    type GridWidget,
} from './dashboardCharts';
import type { Measurement } from '../models/models';

const m = (name: string, score: number, time: string, dimensions?: Measurement['dimensions']): Measurement => ({
    name,
    score,
    time,
    created_at: time,
    dimensions,
});

const row = (pluginName: string, measurements: Measurement[], evalLabel = 'E1'): EvalRow => ({
    index: 1,
    evalUuid: `ev-${pluginName}`,
    evalLabel,
    pluginName,
    evalPluginPid: `ep-${pluginName}`,
    measurements,
});

// Node 22 exposes an experimental `localStorage` global that is undefined
// unless --localstorage-file is passed; give jsdom tests a real in-memory one.
let store = new Map<string, string>();
beforeEach(() => {
    store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
        get length() { return store.size; },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
});

describe('tagEvaluation / combineByPlugin', () => {
    it('tags every measurement with the evaluation dimension', () => {
        const tagged = tagEvaluation(m('acc', 0.5, 't'), 'E1');
        expect(tagged.dimensions?.[EVAL_DIM_KEY]).toBe('E1');
    });

    it('merges measurements per plugin across evaluations, preserving the tag', () => {
        const map = combineByPlugin([
            row('A', [m('acc', 0.5, 't'), m('acc', 0.6, 't2')], 'E1'),
            row('A', [m('acc', 0.9, 't3')], 'E2'),
            row('B', [m('bleu', 0.1, 't4')], 'E1'),
        ]);
        expect(map.get('A')).toHaveLength(3);
        expect(map.get('A')!.map((x) => x.dimensions?.[EVAL_DIM_KEY])).toEqual(['E1', 'E1', 'E2']);
        expect(map.get('B')![0].dimensions?.[EVAL_DIM_KEY]).toBe('E1');
        expect(map.has('C')).toBe(false);
    });
});

describe('selectMeasurements', () => {
    const data = [
        m('acc', 0.5, 't', { model: 'm1' }),
        m('acc', 0.9, 't', { model: 'm2' }),
        m('bleu', 0.1, 't', { model: 'm1' }),
    ];

    it('returns everything when no metrics/filters given', () => {
        expect(selectMeasurements(data, [], {})).toHaveLength(3);
    });

    it('filters by metric names', () => {
        expect(selectMeasurements(data, ['acc'], {}).map((x) => x.name)).toEqual(['acc', 'acc']);
    });

    it('applies dimension filters', () => {
        const out = selectMeasurements(data, [], { model: ['m1'] });
        expect(out).toHaveLength(2);
    });
});

describe('availableMetrics / availableDimensionKeys', () => {
    it('lists distinct metrics and dimension keys', () => {
        const data = [m('b', 1, 't', { x: 1, y: 2 }), m('a', 1, 't', { y: 3 })];
        expect(availableMetrics(data)).toEqual(['a', 'b']);
        expect(availableDimensionKeys(data)).toEqual(['x', 'y']);
    });
});

describe('grid persistence', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips widgets + layouts in localStorage', () => {
        const widgets: GridWidget[] = [{ key: 'w-1', kind: 'text', text: 'hello' }];
        const layouts = { lg: [{ i: 'w-1', x: 0, y: 0, w: 6, h: 6 }] };
        saveGridState('p1', { widgets, layouts });
        const loaded = loadGridState('p1');
        expect(loaded).toEqual({ widgets, layouts });
        expect(loadGridState('other')).toBeNull();
    });

    it('clears the grid state', () => {
        saveGridState('p1', { widgets: [], layouts: {} });
        clearGridState('p1');
        expect(loadGridState('p1')).toBeNull();
    });

    it('returns null on corrupt storage', () => {
        localStorage.setItem('dashboard_grid_p1', '{not json');
        expect(loadGridState('p1')).toBeNull();
    });

    it('round-trips the evaluation/plugin selection per project', () => {
        saveSelection('p1', { evaluations: ['e1', 'e2'], plugins: ['quality'] });
        expect(loadSelection('p1')).toEqual({ evaluations: ['e1', 'e2'], plugins: ['quality'] });
        expect(loadSelection('other')).toBeNull();
    });

    it('ignores a corrupt selection in storage', () => {
        localStorage.setItem('dashboard_selection_p1', '{not json');
        expect(loadSelection('p1')).toBeNull();
    });
});

describe('uid', () => {
    it('generates unique ids', () => {
        expect(uid()).not.toBe(uid());
    });
});

describe('scaleLayout', () => {
    const l = (i: string, x: number, y: number, w: number, h: number, minW?: number): GridItemLayout => ({
        i, x, y, w, h, minW,
    });

    it('keeps side-by-side widgets side-by-side on a narrower width, sharing the full line', () => {
        const lg = [l('a', 0, 0, 12, 9), l('b', 12, 0, 12, 9)];
        const sm = scaleLayout(lg, 24, 12); // 24 cols -> 12 cols
        expect(sm).toEqual([
            l('a', 0, 0, 6, 9),
            l('b', 6, 0, 6, 9),
        ]);
    });

    it('lets a lone widget fill the whole page width on narrower breakpoints', () => {
        const md = scaleLayout([l('w', 0, 0, 12, 9)], 24, 12);
        expect(md[0]).toMatchObject({ x: 0, w: 12 });
        const tiny = scaleLayout([l('w', 20, 0, 4, 9)], 24, 4);
        expect(tiny[0].x + tiny[0].w).toBeLessThanOrEqual(4);
    });

    it('wraps a packed row to new lines and refills each line instead of squeezing', () => {
        // four charts in one lg row
        const lg = [0, 6, 12, 18].map((x, i) => l(`w${i}`, x, 0, 6, 9));
        const xs = scaleLayout(lg, 24, 8);
        expect(xs.filter((li) => li.y === 0)).toHaveLength(2); // 2 per line
        expect(xs.every((li) => li.w === 4)).toBe(true);
        expect(xs[2].y).toBe(9); // wraps below the first line, still full 4+4
    });

    it('stacks two side-by-side charts one per line on a tiny width, each full-width', () => {
        const lg = [l('a', 0, 0, 12, 9), l('b', 12, 0, 12, 9)];
        const xxs = scaleLayout(lg, 24, 4);
        expect(xxs[0]).toMatchObject({ y: 0, w: 4 });
        expect(xxs[1]).toMatchObject({ y: 9, w: 4 });
    });
});

describe('splitFacetWidgets', () => {
    const fields = (over: Partial<Parameters<typeof splitFacetWidgets>[0]> = {}): Parameters<typeof splitFacetWidgets>[0] => ({
        plugin: 'quality',
        evaluations: ['e1'],
        chartType: 'bars',
        metrics: ['acc'],
        filters: { model: ['m1'] },
        groupBy: [],
        labelDim: 'metric',
        facetDim: 'fold',
        facets: ['a', 'b'],
        ...over,
    });

    it('splits one widget per selected facet, pinned via a filter', () => {
        const out = splitFacetWidgets(fields());
        expect(out.map((w) => w.filters?.fold)).toEqual([['a'], ['b']]);
        expect(out[0]).toMatchObject({ kind: 'chart', chartType: 'bars', facetDim: '', title: 'fold: a' });
        expect(out[1].title).toBe('fold: b');
    });

    it('keeps an explicit title and prefixes the facet label', () => {
        const out = splitFacetWidgets(fields({ title: 'My chart' }));
        expect(out[0].title).toBe('My chart · fold: a');
    });

    it('applies per-facet title/comment/legend overrides', () => {
        const out = splitFacetWidgets(
            fields({
                facetTitles: { a: 'Facet A chart' },
                facetComments: { a: 'note a' },
                facetLabelOverrides: { a: { m1: 'Model 1' } },
                facetLabelOrder: { b: ['x', 'y'] },
            }),
        );
        expect(out[0].title).toBe('Facet A chart');
        expect(out[0].comment).toBe('note a');
        expect(out[0].labelOverrides).toEqual({ m1: 'Model 1' });
        expect(out[1].labelOrder).toEqual(['x', 'y']);
        // facets without an override fall back to the default title
        expect(out[1].title).toBe('fold: b');
    });

    it('splits additionally by metric when several metrics are chosen', () => {
        const out = splitFacetWidgets(fields({ metrics: ['acc', 'bleu'] }));
        expect(out).toHaveLength(4); // 2 facets × 2 metrics
        expect(out.map((w) => w.title).sort()).toEqual([
            'fold: a · acc',
            'fold: a · bleu',
            'fold: b · acc',
            'fold: b · bleu',
        ]);
        const accA = out.find((w) => w.title === 'fold: a · acc');
        expect(accA?.metrics).toEqual(['acc']);
        expect(accA?.filters?.fold).toEqual(['a']);
        // every widget is pinned to a single metric
        expect(out.every((w) => (w.metrics ?? []).length === 1)).toBe(true);
    });

    it('applies per-(facet, metric) title/comment/legend overrides', () => {
        const out = splitFacetWidgets(
            fields({
                metrics: ['acc', 'bleu'],
                facetTitles: { 'a::acc': 'Acc A' },
                facetComments: { 'a::acc': 'note' },
                facetLabelOrder: { 'b::bleu': ['x'] },
            }),
        );
        expect(out.find((w) => w.title === 'Acc A')?.comment).toBe('note');
        expect(out.find((w) => w.title === 'fold: b · bleu')?.labelOrder).toEqual(['x']);
    });

    it('facets apply to every chart type', () => {
        expect(splitFacetWidgets(fields({ chartType: 'line' }))).toHaveLength(2);
        expect(splitFacetWidgets(fields({ chartType: 'table' }))[0]).toMatchObject({ chartType: 'table' });
        expect(splitFacetWidgets(fields({ chartType: 'pie' })).map((w) => w.filters?.fold)).toEqual([['a'], ['b']]);
    });

    it('returns no widgets to keep the single-chart path when not splittable', () => {
        expect(splitFacetWidgets(fields({ facetDim: '' }))).toEqual([]);
        expect(splitFacetWidgets(fields({ facets: [] }))).toEqual([]);
    });
});

describe('nextWidgetSlot', () => {
    const l = (i: string, x: number, y: number, w: number, h: number): GridItemLayout => ({
        i, x, y, w, h,
    });

    it('lands on an empty grid at the origin', () => {
        expect(nextWidgetSlot([])).toEqual({ x: 0, y: 0 });
    });

    it('stacks below a lone widget instead of landing beside it on the same row', () => {
        const out = nextWidgetSlot([l('a', 0, 0, 5, 3)]);
        expect(out).toEqual({ x: 0, y: 3 }); // row below, not x=5 on the same header level
    });

    it('stacks below even when there is free space beside the widget', () => {
        // widget sits on the right half of the row; the new one still goes below
        const out = nextWidgetSlot([l('a', 12, 0, 12, 9)]);
        expect(out).toEqual({ x: 0, y: 9 });
    });

    it('stacks below the whole grid when the bottom row is full', () => {
        const out = nextWidgetSlot([l('a', 0, 0, 14, 9), l('b', 14, 0, 14, 9)]);
        expect(out).toEqual({ x: 0, y: 9 }); // below everything
    });

    it('uses the bottom-most edge even when rows have different starts', () => {
        // 'a' starts lower but 'b' ends lowest
        const out = nextWidgetSlot([l('a', 0, 5, 12, 3), l('b', 0, 0, 12, 9)]);
        expect(out).toEqual({ x: 0, y: 9 });
    });
});

describe('session caching', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        clearSessionCache();
    });

    it('caches evaluations and per-plugin results, and clears on demand', async () => {
        const fetchMock = vi.fn().mockImplementation((url: string) => {
            if (url.includes('evaluations?status=Done')) {
                return Promise.resolve({ ok: true, json: async () => [{ pid: 'e1', status: 'Done' }] });
            }
            if (url.includes('/result')) {
                return Promise.resolve({ ok: true, json: async () => ({ measurements: [], metric_visualizations: [] }) });
            }
            throw new Error(`unexpected fetch: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const evals1 = await getDoneEvaluations('p1');
        await getDoneEvaluations('p1');
        expect(getCachedDoneEvaluations('p1')).toEqual(evals1);
        expect(isEvalsCacheFresh('p1')).toBe(true);
        expect(isEvalsCacheFresh('p1', 0)).toBe(false);

        const res1 = await getPluginMeasurements('ep1', 'e1');
        const res2 = await getPluginMeasurements('ep1', 'e1');
        expect(res2).toBe(res1);
        expect(getCachedPluginMeasurements('ep1', 'e1')).toBe(res1);

        // one network call per key thanks to the cache
        const urls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]));
        expect(urls.filter((u) => u.includes('evaluations?status=Done'))).toHaveLength(1);
        expect(urls.filter((u) => u.includes('/plugins/ep1/evaluations/e1/result'))).toHaveLength(1);

        clearSessionCache();
        expect(getCachedDoneEvaluations('p1')).toBeUndefined();
        expect(isEvalsCacheFresh('p1')).toBe(false);
        expect(getCachedPluginMeasurements('ep1', 'e1')).toBeUndefined();
    });
});
