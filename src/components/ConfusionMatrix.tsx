import React, { useEffect, useState } from "react";
import { API_VERSION_PREFIX } from "../config";

export default function ConfusionMatrixHeatmap({ evaluationPid }) {
  const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
  const [matrix, setMatrix] = useState<number[][] | null>(null);

  // ----------------------------
  // Parse backend confusion matrix
  // ----------------------------
  function parseBackendConfusionMatrix(apiResponse) {
    let maxRow = 0;
    let maxCol = 0;

    const parsedCells = apiResponse.map((item) => {
      const match = item.description.match(/^\((\d+),(\d+)\)\/\((\d+),(\d+)\)$/);

      if (!match) {
        throw new Error("Invalid confusion matrix cell: " + item.description);
      }

      const row = Number(match[1]);
      const col = Number(match[2]);

      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);

      return { row, col, value: item.score };
    });

    const matrix = Array.from({ length: maxRow + 1 }, () =>
      Array(maxCol + 1).fill(0)
    );

    parsedCells.forEach(({ row, col, value }) => {
      matrix[row][col] = value;
    });

    return matrix;
  }

  // ----------------------------
  // Fetch data on mount
  // ----------------------------
  useEffect(() => {
    async function loadMatrix() {
      try {
        const resp = await fetch(
          `${API_URL}/evaluations/${evaluationPid}/measures?name=Confusion Matrix`,
          { headers: { accept: "application/json" } }
        );

        const data = await resp.json();
        const parsed = parseBackendConfusionMatrix(data);
        setMatrix(parsed);
      } catch (error) {
        console.error("Failed to load confusion matrix:", error);
      }
    }

    loadMatrix();
  }, [API_URL, evaluationPid]);

  // ----------------------------
  // If matrix isn’t ready yet
  // ----------------------------
  if (!matrix) return <div>Loading Confusion Matrix…</div>;

  const labels = Array.from({ length: matrix.length }, (_, i) => `${i}`);
  const maxVal = Math.max(...matrix.flat());

  const getColor = (value: number) => {
    const intensity = value / maxVal;
    return `rgba(30, 64, 175, ${0.2 + intensity * 0.8})`;
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 10 }}>Confusion Matrix (Heatmap)</h2>

      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th></th>
            {labels.map((label) => (
              <th
                key={label}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  background: "#f3f4f6",
                }}
              >
                Pred: {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {matrix.map((row, r) => (
            <tr key={r}>
              <th
                style={{
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  background: "#f3f4f6",
                }}
              >
                Truth: {labels[r]}
              </th>

              {row.map((value, c) => (
                <td
                  key={c}
                  style={{
                    padding: 12,
                    textAlign: "center",
                    border: "1px solid #ddd",
                    background: getColor(value),
                    color: "white",
                    fontWeight: 600,
                    width: 250,
                    height: 250,
                  }}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}