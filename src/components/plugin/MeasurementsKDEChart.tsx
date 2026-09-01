import { ChartDataProvider } from '@mui/x-charts/ChartDataProvider';
import { ChartsSurface } from '@mui/x-charts/ChartsSurface';
import { ChartsWrapper } from '@mui/x-charts/ChartsWrapper';
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis';
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis';
import { ChartsGrid } from '@mui/x-charts/ChartsGrid';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { ChartsLegend } from '@mui/x-charts/ChartsLegend';
import { LinePlot, MarkPlot } from '@mui/x-charts/LineChart';
import { BarPlot } from '@mui/x-charts/BarChart';
import { Measurement } from '../../models/models.tsx';
import { getColorFromIndex } from '../../util/util.ts';
import { buildDistinctSeriesKeys, getSeriesKey, labelFromSeriesKey } from './ChartUtils';
import { Box, Typography } from "@mui/material";

interface MeasurementsKDEChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
    bins?: number;
    metricLabelDimension?: string;
    groupByDimensions?: string[];
}

/** Helper: convert #RRGGBB to rgba(r,g,b,a) for semi‑transparent bars */
function hexToRgba(hex: string, alpha = 0.25) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Adaptive formatter to reduce x-axis float precision for better visuals */
function makeXFormatter(range: number) {
    let maxFrac = 4;
    if (range >= 100) maxFrac = 0;
    else if (range >= 10) maxFrac = 1;
    else if (range < 1) maxFrac = 3;

    return (v: number | null) =>
        v == null
        ? ''
        : v.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxFrac,
        });
}

export const MeasurementsKDEChart = ({title: title, description: description, data, bins = 20, metricLabelDimension, groupByDimensions}: MeasurementsKDEChartProps) => {
    if (!data?.length) return null;

    // --- Grouping
    const seriesKeys = buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension);
    const scoresByKey = new Map<string, number[]>();

    for (const key of seriesKeys) {
        scoresByKey.set(
            key,
            data.filter(m => getSeriesKey(m, groupByDimensions, metricLabelDimension) === key).map(m => m.score),
        );
    }

    // Flatten all unique scores to define a shared domain
    const allUniqueScores = seriesKeys.flatMap(key => scoresByKey.get(key) ?? []);
    if (allUniqueScores.length === 0) return null;

    // --- Global domain / bins
    const globalMin = Math.min(...allUniqueScores);
    const globalMax = Math.max(...allUniqueScores);
    const globalRange = globalMax - globalMin || 1;
    const binSize = globalRange / bins;
    const binCenters = Array.from({ length: bins }, (_, i) => globalMin + (i + 0.5) * binSize);

    // --- Simple stats + KDE ---
    const mean = (arr: number[]): number => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);
    const std = (arr: number[]): number => {
        const mu = mean(arr);
        return arr.length === 0 ? 0 : Math.sqrt(arr.reduce((sum, value) => sum + (value - mu) ** 2, 0) / arr.length);
    };
    const gaussianKernel = (x: number) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);

    // Histogram counts
    const histogramCounts = (values: number[]): number[] => {
        const counts = Array.from({ length: bins }, () => 0);
        for (const v of values) {
            // Normalize to [0, 1]
            const t = globalRange === 0 ? 0 : (v - globalMin) / globalRange;
            // Clamp to avoid FP overflow
            const clamped = Math.min(Math.max(t, 0), 1);
            // Map to bin index
            let idx = Math.floor(clamped * bins);
            // Include max value in last bin
            if (idx === bins) idx = bins - 1;
            counts[idx]++;
        }
        return counts;
    };

    // KDE evaluated at the bin centers (so bars & line share the same X positions)
    const kdeAtPoints = (values: number[], xs: number[]) => {
        const n = values.length;
        if (n === 0) return xs.map(() => 0);
        const s = std(values);
        // Silverman's rule with fallback for zero stdev
        const h = 1.06 * (s || globalRange / 4) * Math.pow(n, -1 / 5);
        return xs.map((x) =>
            values.reduce((acc, v) => acc + gaussianKernel((x - v) / h), 0) / (n * h)
        );
    };

    // --- Build a dataset object per bin center so we can use dataKey like your example
    // dataset[i] = { x: <bin center>, 'count__A': <n>, 'kde__A': <d>, 'count__B': <n>, 'kde__B': <d>, ... }
    const dataset = binCenters.map((x) => ({ x })) as Array<Record<string, number>>;

    for (const key of seriesKeys) {
        const values = scoresByKey.get(key) ?? [];
        const counts = histogramCounts(values);
        const dens = kdeAtPoints(values, binCenters);
        for (let i = 0; i < bins; i++) {
            dataset[i][`count__${key}`] = counts[i];
            dataset[i][`kde__${key}`] = dens[i];
        }
    }

    const scientificFormatter = (v: number | null): string => v == null ? '' : v.toExponential(2);

    const series =
        seriesKeys.flatMap((key, idx) => {
            const baseLabel = labelFromSeriesKey(key);
            const bar = {
                id: `${key}-bars`,
                type: 'bar' as const,
                label: `${baseLabel} count` ,
                dataKey: `count__${key}`,
                color: hexToRgba(getColorFromIndex(idx), 0.25),
                yAxisId: 'count',
            };
            const line = {
                id: `${key}-kde`,
                type: 'line' as const,
                label: `${baseLabel} density`,
                dataKey: `kde__${key}`,
                color: getColorFromIndex(idx),
                yAxisId: 'density',
                showMark: false,
                curve: 'natural' as const,
                valueFormatter: (v: number | null) => scientificFormatter(v),
            };
        return [bar, line];
    });

    if (dataset.length === 0) return null;

    
    const xFormatter = makeXFormatter(globalRange);

    return (
        <Box>
            {title && (
                <Typography variant="h6" gutterBottom>
                    {title}
                </Typography>
            )}
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    {description}
                </Typography>
            )}
            <div style={{ width: '100%' }}>
                <ChartDataProvider
                    series={series}
                    dataset={dataset}
                    height={400}
                    xAxis={[{ scaleType: 'band', dataKey: 'x', label: 'Score', valueFormatter: (value) => xFormatter(value as number) }]}
                    yAxis={[
                        { id: 'count', label: 'Count', width: 65, position: 'right' },
                        { id: 'density', label: 'Density', width: 80, position: 'left', valueFormatter: (value: number | null) => scientificFormatter(value) },
                    ]}
                >
                    <ChartsWrapper legendDirection="horizontal">
                        <ChartsLegend toggleVisibilityOnClick />
                        <ChartsSurface>
                            <ChartsGrid horizontal />
                            <BarPlot />
                            <LinePlot />
                            <MarkPlot />
                            <ChartsXAxis />
                            <ChartsYAxis axisId="density" />
                            <ChartsYAxis axisId="count" />
                            <ChartsTooltip />
                        </ChartsSurface>
                    </ChartsWrapper>
                </ChartDataProvider>
            </div>
        </Box>
    );
};

export default MeasurementsKDEChart;
