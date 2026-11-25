import { API_VERSION_PREFIX } from '../config';
import type { Measurement, MetricVisualization } from '../models/models';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
}

export interface DashboardEvalPlugin {
    pid: string;
    name: string;
    display_name?: string;
    plugin_pid?: string;
}

export interface DashboardEval {
    pid: string;
    status: string;
    name?: string;
    created_at?: string;
    evaluation_plugins?: DashboardEvalPlugin[];
}

export interface EvalPluginResults {
    measurements?: Measurement[];
    metric_visualizations?: MetricVisualization[];
}

// Session-scoped caches so returning to the dashboard doesn't refetch or spin.
const evalsCache = new Map<string, DashboardEval[]>();
const evalsFetchedAt = new Map<string, number>();
const resultsCache = new Map<string, EvalPluginResults>();
const evalsInFlight = new Map<string, Promise<DashboardEval[]>>();
const resultsInFlight = new Map<string, Promise<EvalPluginResults>>();
// Opening the dashboard again within this window reuses the cache instead of
// hitting the API; focus and the manual refresh still update it.
const EVALS_TTL_MS = 60_000;

/** Done evaluations, cached per project for the current session. */
export function getDoneEvaluations(projectUuid: string): Promise<DashboardEval[]> {
    const cached = evalsCache.get(projectUuid);
    if (cached) return Promise.resolve(cached);
    return refreshDoneEvaluations(projectUuid);
}

/** Synchronous read of the cached evaluations (undefined = not fetched yet). */
export const getCachedDoneEvaluations = (projectUuid: string): DashboardEval[] | undefined =>
    evalsCache.get(projectUuid);

/** True when the cached evaluations are recent enough to skip a refetch. */
export const isEvalsCacheFresh = (projectUuid: string, maxAgeMs = EVALS_TTL_MS): boolean => {
    const at = evalsFetchedAt.get(projectUuid);
    return at !== undefined && Date.now() - at < maxAgeMs;
};

/** Per-(evaluation, plugin) results, cached for the current session. */
export function getPluginMeasurements(
    evalPluginPid: string,
    evaluationUuid: string,
): Promise<EvalPluginResults> {
    const key = `${evalPluginPid}|${evaluationUuid}`;
    const cached = resultsCache.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = resultsInFlight.get(key);
    if (inFlight) return inFlight;
    const pending = get<EvalPluginResults>(`/plugins/${evalPluginPid}/evaluations/${evaluationUuid}/result`).then(
        (data) => {
            if (resultsInFlight.get(key) === pending) {
                resultsCache.set(key, data);
                resultsInFlight.delete(key);
            }
            return data;
        },
        (error: unknown) => {
            if (resultsInFlight.get(key) === pending) resultsInFlight.delete(key);
            throw error;
        },
    );
    resultsInFlight.set(key, pending);
    return pending;
}

/** Synchronous read of cached per-plugin results (undefined = not fetched yet). */
export const getCachedPluginMeasurements = (
    evalPluginPid: string,
    evaluationUuid: string,
): EvalPluginResults | undefined => resultsCache.get(`${evalPluginPid}|${evaluationUuid}`);

/** Drop the session caches + in-flight fetches, so the next visit refreshes data. */
export const clearSessionCache = (): void => {
    evalsCache.clear();
    evalsFetchedAt.clear();
    resultsCache.clear();
    evalsInFlight.clear();
    resultsInFlight.clear();
};

/** One (evaluation, plugin) result, with a human evaluation label attached. */
export interface EvalRow {
    index: number;
    evalUuid: string;
    evalLabel: string;
    pluginName: string;
    displayName?: string;
    evalPluginPid: string;
    measurements: Measurement[];
    metric_visualizations?: MetricVisualization[];
}

/** Canonical evaluation label: "Name (short uuid)" when a name is set,
 *  otherwise just the short uuid. */

/** Re-fetch the done evaluations for a project (bypassing the session cache)
 *  and update the cache, so dropdown lists pick up newly finished runs. */
export function refreshDoneEvaluations(projectUuid: string): Promise<DashboardEval[]> {
    const inFlight = evalsInFlight.get(projectUuid);
    if (inFlight) return inFlight;
    const pending = get<DashboardEval[]>(`/projects/${projectUuid}/evaluations?status=Done`).then(
        (data) => {
            // A manual cache clear may have started a newer request in the meantime.
            if (evalsInFlight.get(projectUuid) === pending) {
                evalsCache.set(projectUuid, data);
                evalsFetchedAt.set(projectUuid, Date.now());
                evalsInFlight.delete(projectUuid);
            }
            return data;
        },
        (error: unknown) => {
            if (evalsInFlight.get(projectUuid) === pending) evalsInFlight.delete(projectUuid);
            throw error;
        },
    );
    evalsInFlight.set(projectUuid, pending);
    return pending;
}

/** Synthetic dimension tagging which evaluation a measurement came from, so
 *  charts can draw one series per evaluation. */
export const EVAL_DIM_KEY = '__eval';

export function tagEvaluation(m: Measurement, label: string): Measurement {
    return { ...m, dimensions: { ...m.dimensions, [EVAL_DIM_KEY]: label } };
}

/** Group every row's measurements by plugin, tagging each with its evaluation label. */
export function combineByPlugin(rows: EvalRow[]): Map<string, Measurement[]> {
    const map = new Map<string, Measurement[]>();
    for (const r of rows) {
        const tagged = r.measurements.map((m) => tagEvaluation(m, r.evalLabel));
        const existing = map.get(r.pluginName);
        map.set(r.pluginName, existing ? [...existing, ...tagged] : tagged);
    }
    return map;
}

/** Keep measurements matching the chosen metrics and dimension-filter rules. */
export function selectMeasurements(
    data: Measurement[],
    metrics: string[],
    filters: Record<string, (string | number | boolean)[]>,
): Measurement[] {
    let out = data;
    if (metrics.length > 0) out = out.filter((m) => metrics.includes(m.name));
    for (const [key, values] of Object.entries(filters)) {
        if (values.length === 0) continue;
        out = out.filter(
            (m) => m.dimensions?.[key] !== undefined && values.map(String).includes(String(m.dimensions[key])),
        );
    }
    return out;
}

export function availableMetrics(data: Measurement[]): string[] {
    return Array.from(new Set(data.map((m) => m.name))).sort();
}

export function availableDimensionKeys(data: Measurement[]): string[] {
    const keys = new Set<string>();
    data.forEach((m) => {
        if (m.dimensions) Object.keys(m.dimensions).forEach((k) => keys.add(k));
    });
    return Array.from(keys).sort();
}

/** A dashboard widget: auto plugin plot, custom chart, or editable text. */
export interface GridWidget {
    key: string;
    kind: 'plugin' | 'chart' | 'text';
    plugin?: string;
    /** Evaluation pids this chart/plot overlays (empty = all done evaluations). */
    evaluations?: string[];
    title?: string;
    /** Footer note, collapsed by default on the dashboard card. */
    comment?: string;
    chartType?: string;
    metrics?: string[];
    filters?: Record<string, string[]>;
    groupBy?: string[];
    labelDim?: string;
    facetDim?: string;
    /** Rename legend labels: key = original label, value = displayed label. */
    labelOverrides?: Record<string, string>;
    /** Legend label display order (original labels). */
    labelOrder?: string[];
    text?: string;
}

/** RGL item size/position per breakpoint. */
export interface GridItemLayout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
}

export const BREAKPOINT_COLS = { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 } as const;
export const DASHBOARD_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
export const DASHBOARD_ROW_HEIGHT = 40;
export const DASHBOARD_MARGIN: [number, number] = [12, 12];
export const DASHBOARD_PADDING: [number, number] = [4, 4];
export const DEFAULT_CHART_SIZE = { w: 14, h: 9 } as const;
export const DEFAULT_COMMENT_SIZE = { w: 5, h: 3 } as const;

/** Narrowest a widget may become on smaller breakpoints before its row wraps to
 *  a new line (avoids squeezing charts into slivers). */
const SCALE_MIN_COLS = 4;

/** Scale a layout to another column count. Original rows are preserved; the
 *  charts of a row split the full page width evenly and wrap to a new line as
 *  soon as each would fall below SCALE_MIN_COLS. Lines always fill the page
 *  width (no leftover gaps), vertical order is kept. */
export function scaleLayout(layout: GridItemLayout[], fromCols: number, toCols: number): GridItemLayout[] {
    if (toCols === fromCols) return layout;
    const ratio = toCols / fromCols;
    const scaled = layout.map((l) => ({
        ...l,
        x: Math.round(l.x * ratio),
        w: Math.max(l.minW ?? 2, Math.min(Math.round(l.w * ratio), toCols)),
    }));
    // group into rows by original start-y (scaling never changes y), keep order
    const sorted = [...scaled].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: GridItemLayout[][] = [];
    for (const item of sorted) {
        const last = rows[rows.length - 1];
        if (last && last[0].y === item.y) last.push(item);
        else rows.push([item]);
    }
    const out: GridItemLayout[] = [];
    let y = 0;
    for (const row of rows) {
        const items = [...row].sort((a, b) => a.x - b.x);
        let start = 0;
        while (start < items.length) {
            // as many charts per line as can each keep at least SCALE_MIN_COLS
            let n = 1;
            while (start + n < items.length && Math.floor(toCols / (n + 1)) >= SCALE_MIN_COLS) {
                n += 1;
            }
            const line = items.slice(start, start + n);
            const height = Math.max(...line.map((i) => i.h));
            line.forEach((item, i) => {
                const w = Math.floor(toCols / n);
                out.push({ ...item, x: i * w, y, w: i === n - 1 ? toCols - i * w : w });
            });
            start += n;
            y += height;
        }
    }
    return out;
}

/** Where to drop a newly added widget: on a fresh row below every existing
 *  widget, so a new chart/comment always stacks under current content instead
 *  of landing beside it at the same header level. */
export function nextWidgetSlot(list: GridItemLayout[]): { x: number; y: number } {
    const bottom = list.reduce((max, l) => Math.max(max, (l.y ?? 0) + (l.h ?? 0)), 0);
    return { x: 0, y: bottom };
}

export interface GridWidgetsState {
    widgets: GridWidget[];
    layouts: Record<string, GridItemLayout[] | undefined>;
}

/** Fields the chart builder form collects (create + edit). */
export interface ChartFields {
    plugin: string;
    evaluations: string[];
    chartType: string;
    metrics: string[];
    filters: Record<string, string[]>;
    groupBy: string[];
    labelDim: string;
    facetDim: string;
    /** Facet values the user chose to expand into separate widgets (default: all). */
    facets?: string[];
    /** Optional per-facet overrides used when facets are split into separate widgets. */
    facetTitles?: Record<string, string>;
    facetComments?: Record<string, string>;
    facetLabelOverrides?: Record<string, Record<string, string>>;
    facetLabelOrder?: Record<string, string[]>;
    title?: string;
    /** Footer note, collapsed by default on the dashboard card. */
    comment?: string;
    /** Rename legend labels: key = original label, value = displayed label. */
    labelOverrides?: Record<string, string>;
    /** Legend label display order (original labels). */
    labelOrder?: string[];
}

/** Map a plugin's default chart (metric visualization) onto chart-builder fields,
 *  used by the "Import from eval" dropdown to pre-fill the form. */
export const vizToChartFields = (viz: MetricVisualization): Partial<ChartFields> => ({
    chartType: viz.chart_type ?? 'table',
    metrics: viz.metrics ?? [],
    filters: (viz.filter_dimensions as Record<string, string[]> | undefined) ?? {},
    groupBy: viz.group_by_dimensions ?? [],
    labelDim: viz.metric_label_dimension ?? '',
    facetDim: viz.facet_by_dimension?.[0] ?? '',
    title: viz.title ?? '',
});

/** Turn a plugin's metric visualization into a standalone chart widget. */
export function widgetConfigFromVisualization(plugin: string, viz: MetricVisualization): GridWidget {
    return {
        key: '',
        kind: 'chart',
        title: viz.title || undefined,
        plugin,
        chartType: viz.chart_type,
        metrics: viz.metrics ?? [],
        filters: (viz.filter_dimensions as Record<string, string[]> | undefined) ?? {},
        groupBy: viz.group_by_dimensions ?? [],
        labelDim: viz.metric_label_dimension ?? '',
        facetDim: viz.facet_by_dimension?.[0] ?? '',
    };
}

/** Expand a faceted bars submission into one widget per selected facet value (and,
 *  when several metrics are chosen, per metric too): each widget is the same chart
 *  pinned to that facet via a filter and to a single metric, no longer faceted.
 *  Returns [] when there is nothing to split, so callers keep their single-widget path. */
export function splitFacetWidgets(fields: ChartFields): GridWidget[] {
    const facetDim = fields.facetDim;
    if (!facetDim || !fields.facets || fields.facets.length === 0) return [];
    // Several metrics → also split per metric ("fold: a · acc", …); otherwise one per facet.
    const metricSplit = fields.metrics.length > 1;
    const metricKeys = metricSplit ? fields.metrics : [''];
    const baseTitle = (value: string, metric: string) =>
        [fields.title, `${facetDim}: ${value}`, metric || undefined].filter(Boolean).join(' · ');
    const out: GridWidget[] = [];
    for (const value of fields.facets) {
        for (const metric of metricKeys) {
            const blockKey = metric ? `${value}::${metric}` : value;
            out.push({
                key: '',
                kind: 'chart',
                plugin: fields.plugin,
                evaluations: fields.evaluations,
                title: fields.facetTitles?.[blockKey] ?? (baseTitle(value, metric) || undefined),
                comment: fields.facetComments?.[blockKey],
                chartType: fields.chartType,
                metrics: metric ? [metric] : fields.metrics,
                filters: { ...fields.filters, [facetDim]: [value] },
                groupBy: fields.groupBy,
                labelDim: fields.labelDim,
                facetDim: '',
                labelOverrides: fields.facetLabelOverrides?.[blockKey],
                labelOrder: fields.facetLabelOrder?.[blockKey],
            });
        }
    }
    return out;
}

const GRID_KEY = (projectUuid: string) => `dashboard_grid_${projectUuid}`;

export const loadGridState = (projectUuid: string): GridWidgetsState | null => {
    try {
        const raw = localStorage.getItem(GRID_KEY(projectUuid));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as GridWidgetsState;
        return Array.isArray(parsed.widgets) && parsed.layouts ? parsed : null;
    } catch {
        return null;
    }
};

export const saveGridState = (projectUuid: string, state: GridWidgetsState): void => {
    try {
        localStorage.setItem(GRID_KEY(projectUuid), JSON.stringify(state));
    } catch {
        // storage unavailable (private mode / quota): layout just won't persist
    }
};

export const clearGridState = (projectUuid: string): void => {
    try {
        localStorage.removeItem(GRID_KEY(projectUuid));
    } catch {
        /* storage unavailable: nothing to clear */
    }
};

export interface DashboardSelection {
    evaluations: string[];
    plugins: string[];
}

const SELECTION_KEY = (projectUuid: string) => `dashboard_selection_${projectUuid}`;

export const loadSelection = (projectUuid: string): DashboardSelection | null => {
    try {
        const raw = localStorage.getItem(SELECTION_KEY(projectUuid));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as DashboardSelection;
        return Array.isArray(parsed.evaluations) && Array.isArray(parsed.plugins) ? parsed : null;
    } catch {
        return null;
    }
};

export const saveSelection = (projectUuid: string, selection: DashboardSelection): void => {
    try {
        localStorage.setItem(SELECTION_KEY(projectUuid), JSON.stringify(selection));
    } catch {
        // storage unavailable: selection just won't persist
    }
};

export const uid = (): string =>
    `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

