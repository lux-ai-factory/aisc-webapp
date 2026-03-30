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
    return `${name}:::${description ?? ""}`;
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

// ---- Series builders ----
/**
 * Build aligned series for MUI X LineChart (aligned mode), given keys and times.
 * Missing values become null.
 */
export function buildAlignedSeries(
    distinctKeys: string[],
    distinctTimes: string[],
    byKeyAndTime: Map<string, Map<string, number>>,
    getColorFromIndex?: (i: number) => string,
    opts?: { showMark?: boolean; curve?: AlignedLineSeries["curve"] },
): AlignedLineSeries[] {
    const { showMark = true, curve = "linear" as const } = opts ?? {};
    return distinctKeys.map((key, index) => {
        const { name, description } = fromCompositeKey(key);
        const label = description ? `${name} — ${description}` : name;

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
