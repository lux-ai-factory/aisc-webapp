import {PieChart} from '@mui/x-charts/PieChart';
import {Measurement} from "../../models/models.tsx";

interface MeasurementsPieChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsPieChart = ({title: _title, data}: MeasurementsPieChartProps) => {
    return (
        <PieChart
            height={400}
            series={[
                {
                    data: data.map(m => ({
                        value: m.score,
                        label: m.name,
                    })),
                },
            ]}
        />
    );
}

export default MeasurementsPieChart;
