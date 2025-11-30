import * as React from "react";
import { API_VERSION_PREFIX } from '../config';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts';

interface FairnessTimelineTableProps {
  cardTitle: string;
  metricNames: string[];
  evaluationPid?: string;
}

interface MetricApiData {
  name: string;
  time: string;
  score: number;
  description: string;
  feature: {
    name: string;
  };
}

const fetchMetricData = async (url: string): Promise<MetricApiData[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
  }
  return response.json();
};

export default function FairnessTimelineTable({
  cardTitle,
  metricNames,
  evaluationPid
}: FairnessTimelineTableProps) {
  const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<MetricApiData[]>([]);
  const [selectedFeature, setSelectedFeature] = React.useState<string>("");

  React.useEffect(() => {
    if (!evaluationPid) return;

    const load = async () => {
      try {
        setLoading(true);
        const metricName = metricNames.join(',');
        const url = `${API_URL}/evaluations/${evaluationPid}/measures?name=${metricName}`;
        const d = await fetchMetricData(url);
        setData(d);

        const features = Array.from(new Set(d.map(x => x.feature.name)));
        if (features.length > 0) setSelectedFeature(features[0]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [evaluationPid, metricNames]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const features = Array.from(new Set(data.map(d => d.feature.name)));
  const filtered = data.filter(d => d.feature.name === selectedFeature);

  const extractCategory = (desc: string) => {
    const match = desc.match(/category:(\d+)/);
    return match ? match[1] : "unknown";
  };

  // --- Prepare data for line chart ---
  const seriesByCategory: Record<string, any[]> = {};
  filtered.forEach(item => {
    const category = extractCategory(item.description);
    if (!seriesByCategory[category]) seriesByCategory[category] = [];
    seriesByCategory[category].push({ time: item.time, score: item.score });
  });

  const unifiedData: any[] = [];
  Object.keys(seriesByCategory).forEach(cat => {
    seriesByCategory[cat].forEach(point => {
      const existing = unifiedData.find(d => d.time === point.time);
      if (existing) {
        existing[`cat_${cat}`] = point.score;
      } else {
        unifiedData.push({ time: point.time, [`cat_${cat}`]: point.score });
      }
    });
  });
  unifiedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // --- Prepare data for bar chart: mean score per category ---
  const categoryMeans = Object.keys(seriesByCategory).map(cat => {
    const scores = seriesByCategory[cat].map(p => p.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { category: `Category ${cat}`, meanScore: parseFloat(mean.toFixed(3)) };
  });

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "auto" }}>
      <h2 className="text-xl font-semibold">{cardTitle}</h2>

      {/* Feature Dropdown */}
      <div style={{ marginBottom: "1rem" }}>
        <select
          value={selectedFeature}
          onChange={e => setSelectedFeature(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        >
          {features.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Bar chart of mean scores */}
      <div style={{ width: "100%", height: "250px", marginBottom: "2rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryMeans} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="meanScore" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart over time */}
      <div style={{ width: "100%", height: "400px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={unifiedData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            {Object.keys(seriesByCategory).map(cat => (
              <Line
                key={cat}
                type="monotone"
                dataKey={`cat_${cat}`}
                name={`Category ${cat}`}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}