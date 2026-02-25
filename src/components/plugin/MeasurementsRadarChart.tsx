import {RadarChart} from '@mui/x-charts/RadarChart';
import {Measurement} from "../../models/models.tsx";
import {RadarAxis} from "@mui/x-charts";
import { getColorFromIndex } from "../../util/util";


interface MeasurementsRadarChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsRadarChart = ({title: _title, data}: MeasurementsRadarChartProps) => {
    // List unique metric names (keep order as they first appear)
    const metricNames: string[] = [];
    data.forEach(m => {
        if (!metricNames.includes(m.name)) metricNames.push(m.name);
    });

    // List unique descriptions
    const descriptionSet: string[] = Array.from(new Set(data.map(m => m.description ?? '')));

    // Build series for each description
    const series = descriptionSet.map((desc, index) => {
        const color = getColorFromIndex ? getColorFromIndex(index) : undefined;
        const base = {
            data: metricNames.map(metric => {
                const measurement = data.find(m => (m.description ?? 'Unknown') === desc && m.name === metric);
                return measurement ? measurement.score : 0;
            }),
            color,
            strokeWidth: 3,
            fillArea: true,
        };
        // Only add label if we have more than one description or if desc is valid
        const shouldLabel = descriptionSet.length > 1 || !!desc;
        return shouldLabel
            ? { ...base, label: desc }
            : base;
    });

    return (
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
            {metricNames.map((metric, _i) => (
                <RadarAxis
                    key={metric}
                    metric={metric}
                    divisions={5}
                    labelOrientation="rotated"
                    angle={0}
                    // angle={(i / metricNames.length) * 360}
                />
            ))}
        </RadarChart>
    );
}

export default MeasurementsRadarChart;
