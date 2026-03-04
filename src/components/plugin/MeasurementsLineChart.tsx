import { useMemo, useState } from "react";
import { LineChartPro } from "@mui/x-charts-pro/LineChartPro";
import { Measurement } from "../../models/models";
import { formatDate, getColorFromIndex } from "../../util/util";
import {
    buildDistinctTimes,
    buildDistinctCompositeKeys,
    buildLookupByKeyAndTime,
    buildAlignedSeries,
    applyHiddenToSeries,
    computeYDomainFromVisible,
    toggleHidden,
} from "./ChartUtils";

interface MeasurementsLineChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsLineChart = ({ title: _title, data }: MeasurementsLineChartProps) => {
    // Fixed x-domain
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    // Distinct (name, description) keys
    const keys = useMemo(() => buildDistinctCompositeKeys(data), [data]);
    // Sparse lookup key -> time -> score
    const byKeyAndTime = useMemo(() => buildLookupByKeyAndTime(data), [data]);
    // Base aligned series
    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(keys, times, byKeyAndTime, getColorFromIndex, {
                showMark: true,
                curve: "linear",
            }),
        [keys, times, byKeyAndTime],
    );

    // Visibility state
    const [hidden, setHidden] = useState<string[]>([]);

    // Replace hidden series with null data so they remain in the legend
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(baseSeries, hidden),
        [baseSeries, hidden],
    );

    // Only Y-axis rescales (x-axis stays fixed)
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(baseSeries, hidden),
        [baseSeries, hidden],
    );

    return (
        <LineChartPro
            height={400}
            series={seriesForChart}
            margin={{right: 40}}
            xAxis={[
                {
                    data: times,
                    scaleType: "point",
                    valueFormatter: (dateStr: string) => formatDate(dateStr),
                },
            ]}
            yAxis={[
                {
                    zoom: {
                        slider: {enabled: true}
                    },
                    width: 50,
                    min: yMin,
                    max: yMax,
                },
            ]}
            grid={{ vertical: true, horizontal: true }}
            slotProps={{
                legend: {
                    toggleVisibilityOnClick: true,
                    onItemClick: (_evt: any, item: { seriesId: string | number }) => {
                        setHidden((prev) => toggleHidden(prev, String(item.seriesId)));
                    },
                },
            }}
        />
    );
};

export default MeasurementsLineChart;
