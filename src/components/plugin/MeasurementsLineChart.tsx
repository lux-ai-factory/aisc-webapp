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
}

export const MeasurementsLineChart = ({ title, description, data, metricLabelDimension, groupByDimensions }: MeasurementsLineChartProps) => {
    // Fixed x-domain
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    // Distinct series keys: (metric name, display label, group label)
    const keys = useMemo(
        () => buildDistinctSeriesKeys(data, groupByDimensions, metricLabelDimension),
        [data, groupByDimensions, metricLabelDimension],
    );
    // Display label per series key (metricLabel, plus " (groupLabel)" when grouped)
    const labels = useMemo(() => new Map(keys.map(key => [key, labelFromSeriesKey(key)])), [keys]);
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

    // Visibility state
    const [hidden, setHidden] = useState<string[]>([]);

    // Replace hidden series with null data so they remain in the legend
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(baseSeries, hidden),
        [baseSeries, hidden],
    );

    // Only Y-axis rescales (x-axis stays fixed)
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(baseSeries, hidden),
        [baseSeries, hidden],
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
                height={400}
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
