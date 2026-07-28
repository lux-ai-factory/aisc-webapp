import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { Measurement } from "../../models/models.tsx";
import { getColorFromIndex } from "../../util/util.ts";

interface MeasurementsScatterChartProps {
    title?: string;
    description?: string;
    data: Measurement[];
}

export const MeasurementsScatterChart = ({ title: _title, description: _description, data }: MeasurementsScatterChartProps) => {
    const distinctNames = [...new Set(data.map(m => m.name))];

    const series = distinctNames.map((name, index) => {
        const scores = data
            .filter(m => m.name === name)
            .map(m => m.score);

        const points = scores.map((score, i) => ({ x: i, y: score }));

        return {
            id: name,
            label: name,
            data: points,
            color: getColorFromIndex(index),
            markerSize: 6,
        };
    });

    const maxIndex = Math.max(0, ...series.map(s => (s.data.length ? s.data[s.data.length - 1].x : 0)));

    const xTicks = Array.from({ length: maxIndex + 1 }, (_, i) => i);

    return (
        <ScatterChart
            xAxis={[{
                scaleType: 'linear',
                label: "index",
                min: 0,
                max: maxIndex,
                tickInterval: xTicks,
                domainLimit: 'strict',
            }]}
            yAxis={[{
                scaleType: 'linear',
                width: 50,
            }]}
            series={series}
            height={400}
            grid={{vertical: true, horizontal: true}}
            slotProps={{
              legend: {
                toggleVisibilityOnClick: true,
              },
            }}
            showToolbar={true}
        />
    );
};

export default MeasurementsScatterChart;
