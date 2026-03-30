import { useMemo, useState } from "react";
import { PieChart } from "@mui/x-charts";
import { Measurement } from "../../models/models";
import {
    buildDistinctTimes,
    buildDistinctCompositeKeys,
    buildAlignedSeries,
    toggleHidden,
    buildLookupByKeyAndTime,
} from "./ChartUtils";
import { getColorFromIndex } from "../../util/util";

interface MeasurementsPieChartProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsPieChart = ({ title: _title, data }: MeasurementsPieChartProps) => {
    const times = useMemo(() => buildDistinctTimes(data), [data]);
    const keys = useMemo(() => buildDistinctCompositeKeys(data), [data]);
    const byKeyAndTime = useMemo(() => buildLookupByKeyAndTime(data), [data]);

    const baseSeries = useMemo(
        () =>
            buildAlignedSeries(keys, times, byKeyAndTime, getColorFromIndex, {
                showMark: false,
                curve: "linear",
            }),
        [keys, times, byKeyAndTime]
    );

    const pieData = useMemo(
        () =>
            baseSeries.map(s => ({
                id: s.id,
                rawValue: typeof s.data[0] === "number" ? s.data[0]! : 0,
                label: s.label,
                color: s.color,
            })),
        [baseSeries]
    );

    // Hide-with-value=0, keep all in legend
    const [hidden, setHidden] = useState<string[]>([]);
    const seriesData = useMemo(
        () =>
            pieData.map(segment => ({
                ...segment,
                rawValue: hidden.includes(segment.id) ? 0 : segment.rawValue,
            })),
        [pieData, hidden]
    );

    const activeTotal = useMemo(
        () => seriesData
            .filter(segment => segment.rawValue > 0)
            .reduce((sum, item) => sum + item.rawValue, 0),
        [seriesData]
    );

    const normalizedSeriesData = useMemo(
        () =>
            seriesData
                .filter(segment => segment.rawValue > 0)
                .map(segment => ({
                    ...segment,
                    value: activeTotal > 0 ? Number(((segment.rawValue / activeTotal) * 100).toFixed(1)) : 0,
                    label: segment.label,
                    color: segment.color,
                })),
        [seriesData, activeTotal]
    );

    const valueFormatter = (item: { value: number }) => `${item.value}%`;


    // PieChart with legend interactivity
    return (
        <div>
            <PieChart
                height={400}
                series={[
                    {
                        data: normalizedSeriesData,
                        valueFormatter,
                    },
                ]}
                slotProps={{
                    legend: {
                        toggleVisibilityOnClick: true,
                        onItemClick: (_evt: any, item: { seriesId: string | number }) =>
                            setHidden(prev => toggleHidden(prev, String(item.seriesId))),
                    },
                }}
            />
        </div>
    );
};

export default MeasurementsPieChart;
