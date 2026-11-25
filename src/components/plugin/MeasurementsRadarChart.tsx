import {RadarChart} from '@mui/x-charts/RadarChart';
import {Measurement} from "../../models/models.tsx";
import {RadarAxis} from "@mui/x-charts";
import { getColorFromIndex } from "../../util/util";
import { Box, Typography } from "@mui/material";
import { getMetricLabel, getGroupLabel } from "./ChartUtils.tsx";


interface MeasurementsRadarChartProps {
    title?: string;
    height?: number;
    description?: string;
    data: Measurement[];
    metricLabelDimension?: string;
    groupByDimensions?: string[];
    labelOverrides?: Record<string, string>;
    seriesOrder?: string[];
}

export const MeasurementsRadarChart = ({title, description, data, metricLabelDimension, groupByDimensions, labelOverrides, seriesOrder, height}: MeasurementsRadarChartProps) => {
    // Distinct axis labels: one radar axis per label
    const axisLabels: string[] = Array.from(new Set(data.map(m => getMetricLabel(m, metricLabelDimension))));

    // Distinct group labels: one radar series (polygon) per group, in user order
    const rawGroupLabels: string[] = Array.from(new Set(data.map(m => getGroupLabel(m, groupByDimensions))));
    const groupLabels = (() => {
        if (!seriesOrder || seriesOrder.length === 0) return rawGroupLabels;
        const rank = new Map(seriesOrder.map((label, i) => [label, i]));
        return [...rawGroupLabels].sort((a, b) => {
            const ia = rank.has(a) ? rank.get(a)! : Number.MAX_SAFE_INTEGER;
            const ib = rank.has(b) ? rank.get(b)! : Number.MAX_SAFE_INTEGER;
            return ia - ib;
        });
    })();

    const series = groupLabels.map((groupLabel, index) => {
        const color = getColorFromIndex ? getColorFromIndex(index) : undefined;
        const base = {
            data: axisLabels.map(axisLabel => {
                const measurement = data.find(m =>
                    getGroupLabel(m, groupByDimensions) === groupLabel &&
                    getMetricLabel(m, metricLabelDimension) === axisLabel
                );
                return measurement ? measurement.score : 0;
            }),
            color,
            strokeWidth: 3,
            fillArea: true,
        };
        const shouldLabel = groupLabels.length > 1 || !!groupLabel;
        const label = labelOverrides?.[groupLabel] || groupLabel;
        return shouldLabel ? { ...base, label } : base;
    });

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
            <RadarChart
                height={height ?? 400}
                series={series}
                radar={{
                    max: 1,
                    metrics: axisLabels,
                }}
                slotProps={{
                    legend: {
                        toggleVisibilityOnClick: true,
                    },
                }}
            >
                {axisLabels.map((axisLabel) => (
                    <RadarAxis
                        key={axisLabel}
                        metric={axisLabel}
                        divisions={5}
                        labelOrientation="rotated"
                        angle={0}
                    />
                ))}
            </RadarChart>
        </Box>
    );
}

export default MeasurementsRadarChart;
