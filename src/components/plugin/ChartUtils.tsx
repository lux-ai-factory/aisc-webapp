import { Measurement } from "../../models/models";

// ---- Types ----
export interface AlignedLineSeries {
    id: string;
    label: string;
    color?: string;
    data: (number | null)[];
    showMark?: boolean;
    curve?: "linear" | "catmullRom" | "monotoneX" | "step" | "stepBefore" | "stepAfter";
}

// ---- Key builders ----
/**
 * Build distinct x-domain values (times). Keeps original order of first appearance.
 */
export function buildDistinctTimes<T extends { time: string }>(data: T[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
        if (!seen.has(d.time)) {
            seen.add(d.time);
            out.push(d.time);
        }
    }
    return out;
}

/**
 * Composite key "name:::description" (description can be null/empty).
 */
export function toCompositeKey(name: string, description?: string | null): string {
    return description?.trim() ? `${name}:::${description}` : name;
}

/**
 * Decode composite key back to [name, description] (empty string → undefined).
 */
export function fromCompositeKey(key: string): { name: string; description?: string } {
    const [name, descriptionRaw] = key.split(":::");
    return { name, description: descriptionRaw ? descriptionRaw : undefined };
}

/**
 * Build distinct composite keys for (name, description).
 */
export function buildDistinctCompositeKeys<T extends Measurement>(data: T[]): string[] {
    // TODO: use feature for distinct keys rather than description
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of data) {
        const key = toCompositeKey(m.name, m.description ?? "");
        if (!seen.has(key)) {
            seen.add(key);
            out.push(key);
        }
    }
    return out;
}

/**
 * Build a metric label for a measurement, given the metricLabelDimension.
 */
export const getMetricLabel = (m: Measurement, metricLabelDimension?: string): string => {
    if (!metricLabelDimension || m.dimensions?.[metricLabelDimension] === undefined) return m.name;
    return String(m.dimensions[metricLabelDimension]);
};


/**
 * Build a group label for a measurement, given the groupByDimensions.
 */
export const getGroupLabel = (m: Measurement, groupByDimensions?: string[]): string => {
    if (!groupByDimensions || groupByDimensions.length === 0) return '';
    return groupByDimensions
        .map(key => m.dimensions && m.dimensions[key] !== undefined ? String(m.dimensions[key]) : 'N/A')
        .join(' - ');
};

/**
 * Series identity for grouping: metric name, display label, and group label.
 */
export const getSeriesKey = (m: Measurement, groupByDimensions?: string[], metricLabelDimension?: string): string =>
    `${m.name}:::${getMetricLabel(m, metricLabelDimension)}:::${getGroupLabel(m, groupByDimensions)}`;

/**
 * Build distinct series keys in order of first appearance.
 */
export function buildDistinctSeriesKeys<T extends Measurement>(
    data: T[],
    groupByDimensions?: string[],
    metricLabelDimension?: string,
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of data) {
        const key = getSeriesKey(m, groupByDimensions, metricLabelDimension);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(key);
        }
    }
    return out;
}

/**
 * Decode a series key into [name, metricLabel, groupLabel].
 */
export function fromSeriesKey(key: string): { name: string; metricLabel: string; groupLabel: string } {
    const [name, metricLabel, groupLabel] = key.split(":::");
    return { name, metricLabel: metricLabel ?? "", groupLabel: groupLabel ?? "" };
}

/**
 * Display label for a series key: the metric label, plus " (groupLabel)" when grouped.
 */
export const labelFromSeriesKey = (key: string): string => {
    const { metricLabel, groupLabel } = fromSeriesKey(key);
    return groupLabel ? `${metricLabel} (${groupLabel})` : metricLabel;
};

// ---- Lookup builders ----
/**
 * Build sparse lookup: key -> Map(time -> score)
 */
export function buildLookupByKeyAndTime<T extends Measurement>(
    data: T[],
): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    for (const m of data) {
        const key = toCompositeKey(m.name, m.description ?? "");
        if (!map.has(key)) map.set(key, new Map());
        map.get(key)!.set(m.time, m.score);
    }
    return map;
}

/**
 * Build sparse lookup by series key: seriesKey -> Map(time -> score).
 */
export function buildLookupBySeriesKeyAndTime<T extends Measurement>(
    data: T[],
    groupByDimensions?: string[],
    metricLabelDimension?: string,
): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    for (const m of data) {
        const key = getSeriesKey(m, groupByDimensions, metricLabelDimension);
        if (!map.has(key)) map.set(key, new Map());
        map.get(key)!.set(m.time, m.score);
    }
    return map;
}

// ---- Series builders ----
/**
 * Build aligned series for MUI X LineChart (aligned mode), given keys and times.
 * Missing values become null.
 * When a labels map is provided it wins over the (name, description) decoding.
 */
export function buildAlignedSeries(
    distinctKeys: string[],
    distinctTimes: string[],
    byKeyAndTime: Map<string, Map<string, number>>,
    getColorFromIndex?: (i: number) => string,
    opts?: { showMark?: boolean; curve?: AlignedLineSeries["curve"] },
    labels?: Map<string, string>,
): AlignedLineSeries[] {
    const { showMark = true, curve = "linear" as const } = opts ?? {};
    return distinctKeys.map((key, index) => {
        const { name, description } = fromCompositeKey(key);
        const label = labels?.get(key) ?? (description ? `${name} — ${description}` : name);

        const aligned = distinctTimes.map((t) => byKeyAndTime.get(key)?.get(t) ?? null);

        return {
            id: key,
            label,
            color: getColorFromIndex ? getColorFromIndex(index) : undefined,
            data: aligned,
            showMark,
            curve,
        };
    });
}

// ---- Visibility handling ----
/**
 * Toggle a series ID in the hidden list.
 */
export function toggleHidden(
    hidden: string[],
    id: string,
): string[] {
    return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

/**
 * Replace data with nulls for hidden series so they remain in the legend but render nothing.
 */
export function applyHiddenToSeries(
    series: AlignedLineSeries[],
    hidden: string[],
): AlignedLineSeries[] {
    const hiddenSet = new Set(hidden);
    return series.map((s) => {
        if (!hiddenSet.has(String(s.id))) return s;
        return { ...s, data: s.data.map(() => null) };
    });
}

/**
 * Compute Y domain from currently visible series (ignoring nulls).
 * Adds 10% padding (min 1) like your implementation.
 */
export function computeYDomainFromVisible(
    series: AlignedLineSeries[],
    hidden: string[],
): { yMin: number; yMax: number } {
    const hiddenSet = new Set(hidden);
    const values: number[] = [];

    for (const s of series) {
        if (hiddenSet.has(String(s.id))) continue;
        for (const v of s.data) {
            if (v != null) values.push(v);
        }
    }

    if (values.length === 0) return { yMin: 0, yMax: 1 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || 1;

    return {
        yMin: min - pad,
        yMax: max + pad,
    };
}

/**
 * Compute visible x-index bounds from currently visible series (ignoring nulls).
 * Returns null when there are no visible points.
 */
export function computeXIndexBoundsFromVisible(
    series: AlignedLineSeries[],
    hidden: string[],
): { start: number; end: number } | null {
    const hiddenSet = new Set(hidden);
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;

    for (const s of series) {
        if (hiddenSet.has(String(s.id))) continue;
        for (let i = 0; i < s.data.length; i += 1) {
            if (s.data[i] == null) continue;
            start = Math.min(start, i);
            end = Math.max(end, i);
        }
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
}
