import {LineChart} from '@mui/x-charts/LineChart';
import {Measurement} from "../../models/models.tsx";
import {formatDate, getColorFromIndex} from "../../util/util.ts";


interface MeasurementsLineChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsLineChart = ({title: _title, data}: MeasurementsLineChartProps) => {
    const distinctNames = [...new Set(data.map(m => m.name))];
    const distinctTimes = [...new Set(data.map(m => m.time))];

    const series = distinctNames.map((name, index) => ({
        data: data.filter(m => m.name === name).map(m => (m.score)),
        label: name,
        showMark: true,
        color: getColorFromIndex(index),
        curve: "linear" as const
    }));

    return (
        <LineChart
            xAxis={[{
                data: distinctTimes,
                scaleType: 'point',
                valueFormatter: (dateStr) => formatDate(dateStr)
            }]}
            yAxis={[{
                width: 50,
            }]}
            series={series}
            height={400}
            slotProps={{
              legend: {
                toggleVisibilityOnClick: true,
              },
            }}
            grid={{vertical: true, horizontal: true}}
        />
        
    );
}

export default MeasurementsLineChart;
