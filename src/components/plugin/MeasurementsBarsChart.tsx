import { BarChart } from '@mui/x-charts/BarChart';
import { Measurement } from "../../models/models.tsx";
import { formatDate, getColorFromIndex } from "../../util/util.ts";

interface MeasurementsBarChartProps {
    title?: string;
    data: Measurement[];
    /** If true, stack the series instead of grouping them side-by-side */
    stacked?: boolean;
}

export const MeasurementsBarChart = ({ title: _title, data, stacked = false }: MeasurementsBarChartProps) => {
    // Distinct categories for the x-axis and series grouping
    const distinctTimes = [...new Set(data.map(m => m.time))];

    const distinctKeys = [...new Set(
        data.map(m => {
            const desc = m.description ?? "";
            return `${m.name}:::${desc}`;
        })
    )];

    const byKeyAndTime = new Map<string, Map<string, number>>();

    for (const m of data) {
        const desc = m.description ?? "";
        const composite = `${m.name}:::${desc}`;

        if (!byKeyAndTime.has(composite)) {
            byKeyAndTime.set(composite, new Map());
        }
        byKeyAndTime.get(composite)!.set(m.time, m.score);
    }

    const series = distinctKeys.map((key, index) => {
        const [name, description] = key.split(":::");

        return {
            label: description ? `${name} — ${description}` : name,
            color: getColorFromIndex(index),
            data: distinctTimes.map(
                t => byKeyAndTime.get(key)?.get(t) ?? null // sparse alignment
            ),
            showMark: true,
            curve: "linear" as const,
            ...(stacked ? { stack: "total" as const } : {}),
            valueFormatter: (v: number | null) => (v == null ? "" : `${v}`),
        };
    });

    return (
        <BarChart
            xAxis={[{
               data: distinctTimes,
               scaleType: 'band',
               valueFormatter: (dateStr) => formatDate(dateStr),
            }]}
            yAxis={[{
                width: 50,
            }]}
            series={series}
            height={400}
            slotProps={{
               legend: { toggleVisibilityOnClick: true },
            }}
            grid={{ vertical: true, horizontal: true }}
            showToolbar
        />
    );
};

export default MeasurementsBarChart;
