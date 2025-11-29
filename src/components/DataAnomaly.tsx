import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { API_VERSION_PREFIX } from "../config";

export default function AnomalyVisualization({ evaluationPid }: { evaluationPid: string }) {
    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

    const [rows, setRows] = useState<
        { severity: string; type: string; feature: string; number: number }[]
    >([]);

    function pushRow(arr: any[], { severity, type, feature, number }: any) {
        arr.push({ severity, type, feature, number });
    }

    useEffect(() => {
        async function fetchData() {
            try {
                // ---- 1. UPPER ----
                const upperResp = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=Number of Evaluated Constraint Violations (Upper)`,
                    { headers: { accept: "application/json" } }
                );
                const upperData = await upperResp.json();

                // ---- 2. LOWER ----
                const lowerResp = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=Number of Evaluated Constraint Violations (Lower)`,
                    { headers: { accept: "application/json" } }
                );
                const lowerData = await lowerResp.json();

                // ---- 3. NEW CATEGORIES ----
                const newCatResp = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=Number of New Categories in Test Data Feature`,
                    { headers: { accept: "application/json" } }
                );
                const newCatData = await newCatResp.json();

                // ---- 4. MISSING CATEGORIES ----
                const missingCatResp = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=Number of Missing Categories in Test Data Feature`,
                    { headers: { accept: "application/json" } }
                );
                const missingCatData = await missingCatResp.json();

                // ---- 5. OUTSIDE DISTRIBUTION ----
                const outsideResp = await fetch(
                    `${API_URL}/evaluations/${evaluationPid}/measures?name=Distribution Outside`,
                    { headers: { accept: "application/json" } }
                );
                const outsideData = await outsideResp.json();

                const r: any[] = [];

                // ------------------------------
                // Build rows for all categories
                // ------------------------------

                // Upper
                upperData.forEach((item: any) =>
                    pushRow(r, {
                        severity: item.score > 0 ? "severe" : "pass",
                        type: "out of boundary (upper)",
                        feature: item.description,
                        number: item.score,
                    })
                );

                // Lower
                lowerData.forEach((item: any) =>
                    pushRow(r, {
                        severity: item.score > 0 ? "severe" : "pass",
                        type: "out of boundary (lower)",
                        feature: item.description,
                        number: item.score,
                    })
                );

                // New categories
                newCatData.forEach((item: any) =>
                    pushRow(r, {
                        severity: item.score > 0 ? "severe" : "pass",
                        type: "new categories",
                        feature: item.feature?.name ?? "unknown",
                        number: item.score,
                    })
                );

                // Missing categories
                missingCatData.forEach((item: any) =>
                    pushRow(r, {
                        severity: item.score > 0 ? "low" : "pass",
                        type: "missing categories",
                        feature: item.feature?.name ?? "unknown",
                        number: item.score,
                    })
                );

                // Outside distribution — NEW BLOCK
                outsideData.forEach((item: any) =>
                    pushRow(r, {
                        severity: item.score > 0 ? "low" : "pass",
                        type: "Out of distribution (mean +/- 3 std)",
                        feature: item.description ?? "unknown",
                        number: item.score,
                    })
                );

                // Sort rows: severe → low → pass
                const severityRank: any = { severe: 0, low: 1, pass: 2 };

                r.sort((a, b) => {
                    const s = severityRank[a.severity] - severityRank[b.severity];
                    if (s !== 0) return s;

                    if (b.number !== a.number) return b.number - a.number;

                    return (a.feature || "").localeCompare(b.feature || "");
                });

                setRows(r);
            } catch (error) {
                console.error("Failed to load constraint violations:", error);
            }
        }

        fetchData();
    }, [API_URL, evaluationPid]);

    const severityCounts = rows.reduce(
        (acc: any, r: any) => {
            acc[r.severity] = (acc[r.severity] || 0) + 1;
            return acc;
        },
        { severe: 0, low: 0, pass: 0 }
    );

    const chartData = [
        { name: "Severe", value: severityCounts.severe, color: "#d9534f" },
        { name: "Low", value: severityCounts.low, color: "#f0ad4e" },
        { name: "Pass", value: severityCounts.pass, color: "#5cb85c" }
    ];

    const totalTests = severityCounts.severe + severityCounts.low + severityCounts.pass;

    return (
        <div>
            <h3>The following charts shows the data anomalies in the data divided into different categories according to their severity levels.</h3>

            {rows.length === 0 && <div>Loading...</div>}

            <div style={{ width: "350px", height: "300px", margin: "0 auto" }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={2}
                            label={({ name, value }) =>
                                `${name}: ${((value / totalTests) * 100).toFixed(1)}%`
                            }
                            labelLine={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>

                        {/* Center total number */}
                        <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: "22px", fontWeight: "bold" }}
                        >
                            {totalTests} Tests run
                        </text>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                    <tr>
                        <th style={{ border: "1px solid #ccc", padding: "6px" }}>severity</th>
                        <th style={{ border: "1px solid #ccc", padding: "6px" }}>type</th>
                        <th style={{ border: "1px solid #ccc", padding: "6px" }}>feature</th>
                        <th style={{ border: "1px solid #ccc", padding: "6px" }}>number</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={idx}>
                            <td style={{ border: "1px solid #ccc", padding: "6px" }}>{row.severity}</td>
                            <td style={{ border: "1px solid #ccc", padding: "6px" }}>{row.type}</td>
                            <td style={{ border: "1px solid #ccc", padding: "6px" }}>{row.feature}</td>
                            <td style={{ border: "1px solid #ccc", padding: "6px" }}>{row.number}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
