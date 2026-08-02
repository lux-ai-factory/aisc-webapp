import { useMemo, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Measurement } from "../../models/models.tsx";
import { getColorFromIndex } from "../../util/util.ts";
import { Box, Typography } from "@mui/material";
import {
    getMetricLabel,
    getGroupLabel,
    applyHiddenToSeries,
    computeYDomainFromVisible,
    toggleHidden,
} from "./ChartUtils";

interface MeasurementsBarChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
    /** If true, stack the series instead of grouping them side-by-side */
    stacked?: boolean;
}

export const MeasurementsBarChart = ({title: title, description: description, data, metricLabelDimension, groupByDimensions, stacked = false}: MeasurementsBarChartProps) => {
    const [hidden, setHidden] = useState<string[]>([]);

    const metricLabels: string[] = Array.from(new Set(data.map(m => getMetricLabel(m, metricLabelDimension))));
    const groupLabels: string[] = Array.from(new Set(data.map(m => getGroupLabel(m, groupByDimensions))));

    const baseSeries = useMemo(
        () =>
            groupLabels.map((groupLabel, index) => ({
                id: groupLabel || "__ungrouped__",
                label: groupLabel || "All measurements",
                color: getColorFromIndex(index),
                data: metricLabels.map(metricLabel =>
                    data.find(m => getGroupLabel(m, groupByDimensions) === groupLabel && getMetricLabel(m, metricLabelDimension) === metricLabel)?.score ?? null,
                ),
                ...(stacked ? { stack: "total" as const } : {}),
            })),
        [data, groupLabels, metricLabels, groupByDimensions, metricLabelDimension, stacked],
    );
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(baseSeries, hidden),
        [baseSeries, hidden],
    );
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(baseSeries, hidden),
        [baseSeries, hidden]
    );

    const xAxisTick: any = {
        angle: -60,
        textAnchor: 'end',
        dominantBaseline: 'end',
        fontSize: 10,
    };

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
            <BarChart
                height={600}
                series={seriesForChart}
                xAxis={[
                    {
                        data: metricLabels,
                        scaleType: "band",
                        valueFormatter: (value: string) => value,
                        height: 200,
                        tickLabelStyle: xAxisTick,
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
        </Box>
    );
};

export default MeasurementsBarChart;
