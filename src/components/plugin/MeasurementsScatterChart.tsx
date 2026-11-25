import { useMemo } from "react";
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { Measurement } from "../../models/models.tsx";
import { getColorFromIndex } from "../../util/util.ts";
import {
    buildDistinctSeriesKeys,
    getSeriesKey,
    labelFromSeriesKey,
} from "./ChartUtils";
import { Box, Typography } from "@mui/material";

interface MeasurementsScatterChartProps {
    title?: string;
    height?: number;
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
    labelOverrides?: Record<string, string>;
    seriesOrder?: string[];
}

export const MeasurementsScatterChart = ({ title: title, description: description, data, metricLabelDimension, groupByDimensions, labelOverrides, seriesOrder, height }: MeasurementsScatterChartProps) => {
    const keys = useMemo(
        () => buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension),
        [data, groupByDimensions, metricLabelDimension],
    );
    const labels = useMemo(() => {
        const map = new Map<string, string>();
        keys.forEach((key) => {
            const base = labelFromSeriesKey(key);
            map.set(key, labelOverrides?.[base] || base);
        });
        return map;
    }, [keys, labelOverrides]);

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

    const series = useMemo(
        () =>
            orderedKeys.map((key, index) => ({
                id: key,
                label: labels.get(key) ?? key,
                data: data
                    .filter((measurement) => getSeriesKey(measurement, groupByDimensions, metricLabelDimension) === key)
                    .map((measurement, pointIndex) => ({ x: pointIndex, y: measurement.score }))
                    .filter((point) => point.y !== null) as { x: number; y: number }[],
                color: getColorFromIndex(index),
                markerSize: 6,
            })),
        [data, groupByDimensions, orderedKeys, labels, metricLabelDimension],
    );

    const maxIndex = Math.max(0, ...series.map((s) => (s.data.length ? s.data[s.data.length - 1].x : 0)));

    const xTicks = Array.from({ length: maxIndex + 1 }, (_, i) => i);

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
            <ScatterChart
                xAxis={[{
                    scaleType: 'linear',
                    label: "index",
                    min: 0,
                    max: maxIndex,
                    tickInterval: xTicks,
                    domainLimit: 'strict',
                }]}
                yAxis={[{
                    scaleType: 'linear',
                    width: 50,
                }]}
                series={series}
                height={height ?? 400}
                grid={{vertical: true, horizontal: true}}
                slotProps={{
                legend: {
                    toggleVisibilityOnClick: true,
                },
                }}
                showToolbar={true}
            />
        </Box>
    );
};

export default MeasurementsScatterChart;
