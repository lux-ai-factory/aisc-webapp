import { useMemo, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { Measurement } from "../../models/models.tsx";
import { formatDate, getColorFromIndex } from "../../util/util.ts";
import {
    AlignedLineSeries,
    buildDistinctTimes,
    buildDistinctCompositeKeys,
    buildLookupByKeyAndTime,
    buildAlignedSeries,
    applyHiddenToSeries,
    computeYDomainFromVisible,
    toggleHidden,
} from "./ChartUtils";

interface MeasurementsBarChartProps {
    title?: string;
    data: Measurement[];
    /** If true, stack the series instead of grouping them side-by-side */
    stacked?: boolean;
}

export const MeasurementsBarChart = ({title: _title, data, stacked = false}: MeasurementsBarChartProps) => {
    // Distinct times and keys (keys are measure names)
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    const keys = useMemo(() => buildDistinctCompositeKeys(data), [data]);
    const byKeyAndTime = useMemo(() => buildLookupByKeyAndTime(data), [data]);

    // Find all descriptions for the (possibly single) measure
    const descriptions = Array.from(new Set(data.map(m => m.description ?? '')));

    // Determine cardinality
    const singleTime = times.length === 1;
    const singleMeasure = new Set(data.map(m => m.name)).size === 1;
    const singleTimeAndSingleMeasure = singleTime && singleMeasure;

    // Base: group by (key = measure name), each series is a measure
    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(keys, times, byKeyAndTime, getColorFromIndex, {
                showMark: false,
                curve: "linear",
            }),
        [keys, times, byKeyAndTime],
    );
    const [hidden, setHidden] = useState<string[]>([]);
    const series = useMemo(
        () =>
            baseSeries.map((s: AlignedLineSeries) => ({
                id: s.id,
                label: s.label,
                color: s.color,
                data: s.data,
                ...(stacked ? { stack: "total" as const } : {}),
            })),
        [baseSeries, stacked],
    );
    const seriesForChart = useMemo(
        () => applyHiddenToSeries(series, hidden),
        [series, hidden]
    );
    const { yMin, yMax } = useMemo(
        () => computeYDomainFromVisible(series, hidden),
        [series, hidden]
    );

    // --- Dynamic axes and title ---
    let xAxisData: string[] = times;
    let xAxisFormatter: (v: string) => string = formatDate;
    let adjustedSeriesForChart = seriesForChart;
    let xAxisTick: any = {}; // To hold possible label rotation
    let chartHeight: number = 400;
    let xAxisHeight: number = 50;

    if (singleTimeAndSingleMeasure) {
        // CASE: Single time and single measure
        const measureName = data[0]?.name ?? (keys[0] ?? "");
        xAxisData = descriptions;
        xAxisFormatter = v => v;
        xAxisTick = {
            angle: -60,
            textAnchor: 'end',
            dominantBaseline: 'end',
            fontSize: 10,
        };
        chartHeight = 600;
        xAxisHeight = 200;

        // Only one series; its data is value at single time for each description
        adjustedSeriesForChart = [{
            id: measureName,
            label: measureName,
            color: getColorFromIndex(0),
            data: descriptions.map(desc =>
                data.find(m => (m.name === measureName) && (m.description === desc))?.score ?? null
            ),
            ...(stacked ? { stack: "total" as const } : {})
        }];
    }
    else if (singleTime) {
        // CASE: Only a single time; x-axis = measure names
        xAxisData = keys;
        xAxisFormatter = v => v;
        xAxisTick = {
            angle: -60,
            textAnchor: 'end',
            dominantBaseline: 'end',
            fontSize: 10,
        };
        chartHeight = 600;
        xAxisHeight = 200;

        adjustedSeriesForChart = [{
            id: 'singleTime',
            label: times[0],
            color: getColorFromIndex(0),
            data: keys.map(k => byKeyAndTime.get(k)?.get(times[0]) ?? null),
            ...(stacked ? { stack: "total" as const } : {})
        }];
    }

    return (
        <BarChart
            height={chartHeight}
            series={adjustedSeriesForChart}
            xAxis={[
                {
                    data: xAxisData,
                    scaleType: "band",
                    valueFormatter: xAxisFormatter,
                    height: xAxisHeight,
                    tickLabelStyle: xAxisTick,
                },
            ]}
            yAxis={[
                {
                    width: 50,
                    min: yMin,
                    max: Math.max(1, yMax),
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
            showToolbar
        />
    );
};

export default MeasurementsBarChart;
