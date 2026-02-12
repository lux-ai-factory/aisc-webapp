import {LineChart} from '@mui/x-charts/LineChart';
import {Measurement} from "../../models/models.tsx";
import {formatDate, getColorFromIndex} from "../../util/util.ts";


interface MeasurementsLineChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsLineChart = ({title: _title, data}: MeasurementsLineChartProps) => {
    const distinctTimes = [...new Set(data.map(m => m.time))];

    const distinctKeys = [
        ...new Set(
            data.map(m =>{
                const desc = m.description ?? "";
                return `${m.name}:::${desc}`;
            })
        )
    ];

    const series = distinctKeys.map((key, index) => {
        const [name, description] = key.split(":::");

        const filtered = data.filter(
            m => m.name === name && (m.description ?? "") === description
        );

        return {
            data: filtered.map(m => m.score),
            label: description ? `${name} — ${description}` : name,
            showMark: true,
            color: getColorFromIndex(index),
            curve: "linear" as const,
        };
    });

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
