import { useMemo, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Measurement } from "../../models/models.tsx";
import { formatDate, getColorFromIndex } from "../../util/util.ts";
import {
    AlignedLineSeries,
    buildDistinctTimes,
    buildDistinctCompositeKeys,
    buildLookupByKeyAndTime,
    buildAlignedSeries,
    applyHiddenToSeries,
    computeYDomainFromVisible,
    toggleHidden,
} from "./ChartUtils";

interface MeasurementsBarChartProps {
    title?: string;
    data: Measurement[];
    /** If true, stack the series instead of grouping them side-by-side */
    stacked?: boolean;
}

export const MeasurementsBarChart = ({title: _title, data, stacked = false}: MeasurementsBarChartProps) => {
    // Fixed x-domain
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    // Distinct (name, description) keys
    const keys = useMemo(() => buildDistinctCompositeKeys(data), [data]);
    // Sparse lookup key -> time -> score
    const byKeyAndTime = useMemo(() => buildLookupByKeyAndTime(data), [data]);
    // Base aligned series
    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(keys, times, byKeyAndTime, getColorFromIndex, {
                showMark: false,
                curve: "linear",
            }),
        [keys, times, byKeyAndTime],
    );

    // Visibility state
    const [hidden, setHidden] = useState<string[]>([]);

    // Map to BarChart series
    const series = useMemo(
        () =>
            baseSeries.map((s: AlignedLineSeries) => ({
                id: s.id,
                label: s.label,
                color: s.color,
                data: s.data, // (number | null)[], aligned to `times`
                ...(stacked ? { stack: "total" as const } : {}),
            })),
        [baseSeries, stacked],
    );

    // Replace hidden series with null data so they remain in the legend
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(series, hidden),
        [series, hidden],
    );

    // Only Y-axis rescales (x-axis stays fixed)
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(series, hidden),
        [series, hidden],
    );

    return (
        <BarChart
            height={400}
            series={seriesForChart}
            xAxis={[
                {
                    data: times,
                    scaleType: "band",
                    valueFormatter: (dateStr: string) => formatDate(dateStr),
                },
            ]}
            yAxis={[
                {
                    width: 50,
                    min: yMin,
                    max: yMax,
                },
            ]}
            grid={{ vertical: true, horizontal: true }}
            slotProps={{
                legend: {
                    toggleVisibilityOnClick: true,
                    onItemClick: (_evt: any, item: { seriesId: string | number }) => {
                        setHidden((prev) => toggleHidden(prev, String(item.seriesId)));
                    },
                },
            }}
            showToolbar
        />
    );
};

export default MeasurementsBarChart;
