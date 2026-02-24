import {RadarChart} from '@mui/x-charts/RadarChart';
import {Measurement} from "../../models/models.tsx";
import {RadarAxis} from "@mui/x-charts";

interface MeasurementsRadarChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsRadarChart = ({title: _title, data}: MeasurementsRadarChartProps) => {
    return (
        <RadarChart
            height={400}
            // series={[{label: title, data: data.map(m => m.score)}]}
            series={[{data: data.map(m => m.score)}]}
            radar={{
                max: 1,
                metrics: data.map(m => m.name),
            }}
        >
            <RadarAxis
                metric={data[0].name}
                divisions={5}
                labelOrientation="rotated"
                angle={0}
            />
        </RadarChart>
    );
}

export default MeasurementsRadarChart;
