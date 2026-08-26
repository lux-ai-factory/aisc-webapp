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
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
}

export const MeasurementsScatterChart = ({ title: title, description: description, data, metricLabelDimension, groupByDimensions }: MeasurementsScatterChartProps) => {
    const keys = useMemo(
        () => buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension),
        [data, groupByDimensions, metricLabelDimension],
    );
    const labels = useMemo(() => new Map(keys.map(key => [key, labelFromSeriesKey(key)])), [keys]);

    const series = useMemo(
        () =>
            keys.map((key, index) => ({
                id: key,
                label: labels.get(key) ?? key,
                data: data
                    .filter((measurement) => getSeriesKey(measurement, groupByDimensions, metricLabelDimension) === key)
                    .map((measurement, pointIndex) => ({ x: pointIndex, y: measurement.score }))
                    .filter((point) => point.y !== null) as { x: number; y: number }[],
                color: getColorFromIndex(index),
                markerSize: 6,
            })),
        [data, groupByDimensions, keys, labels, metricLabelDimension],
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
                height={400}
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
