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
    const distinctNames = [...new Set(data.map((m) => m.name))];
    const distinctTimes = [...new Set(data.map((m) => m.time))];

    // Create a lookup so each series aligns with every x value (time)
    const byNameAndTime = new Map<string, Map<string, number>>();
    for (const m of data) {
        if (!byNameAndTime.has(m.name)) byNameAndTime.set(m.name, new Map());
        byNameAndTime.get(m.name)!.set(m.time, m.score);
    }

    const series = distinctNames.map((name, index) => ({
        label: name,
        color: getColorFromIndex(index),
        // Use null so missing values simply don't render a bar at that spot
        data: distinctTimes.map((t) => byNameAndTime.get(name)?.get(t) ?? null),
        ...(stacked ? { stack: 'total' as const } : {}),
        // Optional: format values in tooltip/labels
        valueFormatter: (v: number | null) => (v == null ? '' : `${v}`),
    }));

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
