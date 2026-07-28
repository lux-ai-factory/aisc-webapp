import {RadarChart} from '@mui/x-charts/RadarChart';
import {Measurement} from "../../models/models.tsx";
import {RadarAxis} from "@mui/x-charts";
import { getColorFromIndex } from "../../util/util";
import {Box, Typography} from "@mui/material";


interface MeasurementsRadarChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
}

export const MeasurementsRadarChart = ({title, description, data}: MeasurementsRadarChartProps) => {
    const metricNames: string[] = [];
    data.forEach(m => {
        if (!metricNames.includes(m.name)) metricNames.push(m.name);
    });

    const groups: string[] = Array.from(new Set(data.map(m => String(m.dimensions?.group ?? ''))));

    const series = groups.map((group, index) => {
        const color = getColorFromIndex ? getColorFromIndex(index) : undefined;
        const base = {
            data: metricNames.map(metric => {
                const measurement = data.find(m => String(m.dimensions?.group ?? '') === String(group) && m.name === metric);
                return measurement ? measurement.score : 0;
            }),
            color,
            strokeWidth: 3,
            fillArea: true,
        };
        const shouldLabel = groups.length > 1 || !!group;
        return shouldLabel
            ? { ...base, label: group }
            : base;
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
