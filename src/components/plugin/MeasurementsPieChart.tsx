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
                value: typeof s.data[0] === "number" ? s.data[0]! : 0,
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
                value: hidden.includes(segment.id) ? 0 : segment.value,
            })),
        [pieData, hidden]
    );

    // PieChart with legend interactivity
    return (
        <div>
            <PieChart
                height={400}
                series={[
                    {
                        data: seriesData,
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
