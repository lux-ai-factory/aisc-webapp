import { useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { Measurement } from "../../models/models";
import { formatDate, getColorFromIndex } from "../../util/util";
import { Box, Typography } from "@mui/material";
import {
    buildDistinctTimes,
    buildDistinctSeriesKeys,
    buildLookupBySeriesKeyAndTime,
    buildAlignedSeries,
    labelFromSeriesKey,
    applyHiddenToSeries,
    computeYDomainFromVisible,
    toggleHidden,
} from "./ChartUtils";

interface MeasurementsLineChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
    /** Fit the chart to a fixed pixel height (dashboard widgets pass their body height). */
    height?: number;
    /** Rename legend labels (key = original label, value = displayed label). */
    labelOverrides?: Record<string, string>;
    /** Display series in this order (list of original legend labels). */
    seriesOrder?: string[];
}

export const MeasurementsLineChart = ({ title, description, data, metricLabelDimension, groupByDimensions, height, labelOverrides, seriesOrder }: MeasurementsLineChartProps) => {
    // Fixed x-domain
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    // Distinct series keys: (metric name, display label, group label)
    const keys = useMemo(
        () => buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension),
        [data, groupByDimensions, metricLabelDimension],
    );
    // Display label per series key (metricLabel, plus " (groupLabel)" when grouped)
    const labels = useMemo(() => {
        const map = new Map<string, string>();
        keys.forEach((key) => {
            const base = labelFromSeriesKey(key);
            map.set(key, labelOverrides?.[base] || base);
        });
        return map;
    }, [keys, labelOverrides]);
    // Sparse lookup series key -> time -> score
    const byKeyAndTime = useMemo(
        () => buildLookupBySeriesKeyAndTime(data, groupByDimensions, metricLabelDimension),
        [data, groupByDimensions, metricLabelDimension],
    );
    // Base aligned series
    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(keys, times, byKeyAndTime, getColorFromIndex, {
                showMark: true,
                curve: "linear",
            }, labels),
        [keys, times, byKeyAndTime, labels],
    );

    // Reorder series to match the user's legend order (by original label).
    const orderedSeries = useMemo(() => {
        if (!seriesOrder || seriesOrder.length === 0) return baseSeries;
        const rank = new Map(seriesOrder.map((label, i) => [label, i]));
        return [...baseSeries].sort((a, b) => {
            const la = labelFromSeriesKey(String(a.id));
            const lb = labelFromSeriesKey(String(b.id));
            const ia = rank.has(la) ? rank.get(la)! : Number.MAX_SAFE_INTEGER;
            const ib = rank.has(lb) ? rank.get(lb)! : Number.MAX_SAFE_INTEGER;
            return ia - ib;
        });
    }, [baseSeries, seriesOrder]);

    // Visibility state
    const [hidden, setHidden] = useState<string[]>([]);

    // Replace hidden series with null data so they remain in the legend
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(orderedSeries, hidden),
        [orderedSeries, hidden],
    );

    // Only Y-axis rescales (x-axis stays fixed)
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(orderedSeries, hidden),
        [orderedSeries, hidden],
    );

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
            <LineChart
                height={height ?? 400}
                series={seriesForChart}
                margin={{right: 40}}
                xAxis={[
                    {
                        data: times,
                        scaleType: "point",
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
                />
        </Box>
    );
};

export default MeasurementsLineChart;
