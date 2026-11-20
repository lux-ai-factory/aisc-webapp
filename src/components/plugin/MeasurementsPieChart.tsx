import { useMemo, useState } from "react";
import { PieChart } from "@mui/x-charts";
import { Measurement } from "../../models/models";
import {
    buildDistinctTimes,
    buildDistinctSeriesKeys,
    buildAlignedSeries,
    toggleHidden,
    buildLookupBySeriesKeyAndTime,
    labelFromSeriesKey,
} from "./ChartUtils";
import { getColorFromIndex } from "../../util/util";
import { Box, Typography } from "@mui/material";

interface MeasurementsPieChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
    labelOverrides?: Record<string, string>;
    seriesOrder?: string[];
}

export const MeasurementsPieChart = ({title: title, description: description, data, metricLabelDimension, groupByDimensions, labelOverrides, seriesOrder}: MeasurementsPieChartProps) => {
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    const keys = useMemo(() => buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension), [data, groupByDimensions, metricLabelDimension]);
    const orderedKeys = useMemo(() => {
        if (!seriesOrder || seriesOrder.length === 0) return keys;
        const rank = new Map(seriesOrder.map((label, i) => [label, i]));
        return [...keys].sort((a, b) => {
            const la = labelFromSeriesKey(a);
            const lb = labelFromSeriesKey(b);
            const ia = rank.has(la) ? rank.get(la)! : Number.MAX_SAFE_INTEGER;
            const ib = rank.has(lb) ? rank.get(lb)! : Number.MAX_SAFE_INTEGER;
            return ia - ib;
        });
    }, [keys, seriesOrder]);
    const labels = useMemo(() => {
        const map = new Map<string, string>();
        keys.forEach((key) => {
            const base = labelFromSeriesKey(key);
            map.set(key, labelOverrides?.[base] || base);
        });
        return map;
    }, [keys, labelOverrides]);
    const byKeyAndTime = useMemo(() => buildLookupBySeriesKeyAndTime(data, groupByDimensions, metricLabelDimension), [data, groupByDimensions, metricLabelDimension]);

    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(orderedKeys, times, byKeyAndTime, getColorFromIndex, {
                showMark: false,
                curve: "linear",
            }, labels),
        [orderedKeys, times, byKeyAndTime, labels]
    );

    const pieData = useMemo(
        () =>
            baseSeries.map(s => ({
                id: s.id,
                rawValue: typeof s.data[0] === "number" ? s.data[0]! : 0,
                label: s.label,
                color: s.color,
            })),
        [baseSeries]
    );

    // Hide-with-value=0, keep all in legend
    const [hidden, setHidden] = useState<string[]>([]);
    const seriesData = useMemo(
        () =>
            pieData.map(segment => ({
                ...segment,
                rawValue: hidden.includes(segment.id) ? 0 : segment.rawValue,
            })),
        [pieData, hidden]
    );

    const activeTotal = useMemo(
        () => seriesData
            .filter(segment => segment.rawValue > 0)
            .reduce((sum, item) => sum + item.rawValue, 0),
        [seriesData]
    );

    const normalizedSeriesData = useMemo(
        () =>
            seriesData
                .filter(segment => segment.rawValue > 0)
                .map(segment => ({
                    ...segment,
                    value: activeTotal > 0 ? Number(((segment.rawValue / activeTotal) * 100).toFixed(1)) : 0,
                    label: segment.label,
                    color: segment.color,
                })),
        [seriesData, activeTotal]
    );

    const valueFormatter = (item: { value: number }) => `${item.value}%`;


    // PieChart with legend interactivity
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
            <PieChart
                height={400}
                series={[
                    {
                        data: normalizedSeriesData,
                        valueFormatter,
                    },
                ]}
                slotProps={{
                    legend: {
                        toggleVisibilityOnClick: true,
                        onItemClick: (_evt: any, item: { seriesId: string | number }) =>
                            setHidden(prev => toggleHidden(prev, String(item.seriesId))),
                    },
                }}
            />
        </Box>
    );
};

export default MeasurementsPieChart;
