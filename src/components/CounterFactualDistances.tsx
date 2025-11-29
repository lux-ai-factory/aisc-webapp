import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
} from "recharts";
import { API_VERSION_PREFIX } from "../config";

export default function AnomalyVisualization({ evaluationPid, metric, numBins }: { evaluationPid: string, metric: string, numBins: number }) {
    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
    const [histData, setHistData] = useState<{ bin: string; count: number }[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=${metric}`,
                    { headers: { accept: "application/json" } }
                );
                const data = await res.json();

                const scores: number[] = data.map((d: any) => d.score);

                // ---- Create histogram bins ----
                const min = Math.min(...scores);
                const max = Math.max(...scores);
                const binSize = (max - min) / numBins;

                const bins = Array(numBins).fill(0);

                scores.forEach((value) => {
                    let binIndex = Math.floor((value - min) / binSize);
                    if (binIndex === numBins) binIndex--; // put max value into last bin
                    bins[binIndex]++;
                });

                const formatted = bins.map((count, i) => {
                    const start = min + i * binSize;
                    const end = start + binSize;
                    return {
                        bin: `${start.toFixed(1)} - ${end.toFixed(1)}`,
                        count,
                    };
                });

                setHistData(formatted);
            } catch (error) {
                console.error("Failed to load euclidean measures:", error);
            }
        }

        fetchData();
    }, [API_URL, evaluationPid]);

    return (
        <div style={{ width: "100%", height: 500 }}>
            <h3>{metric} Histogram</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" angle={-45} textAnchor="end" interval={0} height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
