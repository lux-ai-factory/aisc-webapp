import {RadarChart} from '@mui/x-charts/RadarChart';
import {Measurement} from "../../models/models.tsx";
import {RadarAxis} from "@mui/x-charts";
import { getColorFromIndex } from "../../util/util";
import {Box, Typography} from "@mui/material";


interface MeasurementsRadarChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
    groupByDimensions?: string[];
}

export const MeasurementsRadarChart = ({title, description, data, groupByDimensions}: MeasurementsRadarChartProps) => {
    const metricNames: string[] = [];
    data.forEach(m => {
        if (!metricNames.includes(m.name)) metricNames.push(m.name);
    });

    const getGroupLabel = (m: Measurement): string => {
        if (!groupByDimensions || groupByDimensions.length === 0) {
            return '';
        }
        return groupByDimensions
            .map(key => m.dimensions && m.dimensions[key] !== undefined ? String(m.dimensions[key]) : 'N/A')
            .join(' - ');
    };

    const groupLabels: string[] = Array.from(new Set(data.map(getGroupLabel)));

    const series = groupLabels.map((groupLabel, index) => {
        const color = getColorFromIndex ? getColorFromIndex(index) : undefined;
        const base = {
            data: metricNames.map(metric => {
                const measurement = data.find(m => getGroupLabel(m) === groupLabel && m.name === metric);
                return measurement ? measurement.score : 0;
            }),
            color,
            strokeWidth: 3,
            fillArea: true,
        };
        const shouldLabel = groupLabels.length > 1 || !!groupLabel;
        return shouldLabel ? { ...base, label: groupLabel } : base;
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
                height={400}
                series={series}
                radar={{
                    max: 1,
                    metrics: metricNames,
                }}
                slotProps={{
                    legend: {
                        toggleVisibilityOnClick: true,
                    },
                }}
            >
                {metricNames.map((metric) => (
                    <RadarAxis
                        key={metric}
                        metric={metric}
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
