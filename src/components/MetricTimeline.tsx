
import { useState, useEffect } from "react";

// TODO: kebab case for file name

import { Box, Typography, Card, CardContent, CircularProgress } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables, ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { mapMetricsName } from "../utils";
ChartJS.register(...registerables, zoomPlugin);
import { enGB } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';


interface MetricApiData {
    name: string;
    time: string;
    score: number;
}

function parse_datas(metrics: MetricApiData[][]) {
    const datasets = metrics.map(metric => {
        const parsed_data = metric.map((d) => {
            return {
                'x': new Date(d.time).toISOString().slice(0, 19).replace('T', ' '),
                'y': d.score
            }
        });
        const label = metric.length > 0 ? mapMetricsName(metric[0].name) || 'Unknown' : 'Unknown';
        return {
            label: label,
            data: parsed_data,
            fill: false,
            tension: 0.1
        };
    });
    return { datasets };
}


function Loading() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
        </Box>
    );

}

function ErrorComponent() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography component="h3" variant="subtitle2" gutterBottom>
                Error loading data
            </Typography>
        </Box>
    );
}

// TODO: keep only function and then export later, and not default

interface MetricTimelineProps {
    cardTitle: string;
    metricNames: string[];

}

function fetchMetricData(url: string) {
    return fetch(url)
        .then(response => response.json())
        .then(data => data);
}


export default function MetricTimeline(props: MetricTimelineProps) {
    const { metricNames, cardTitle } = props;
    const [chartData, setChartData] = useState<{ datasets: { label: string; data: { x: string; y: number }[]; fill: boolean; tension: number }[] }>({ datasets: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const options: ChartOptions<'line'> = {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day'
                },
                adapters: {
                    date: {
                        locale: enGB
                    }
                }
            }

        }
    }


    useEffect(() => {
        Promise.all(metricNames.map(metricName => `/api/metrics?name=${metricName}`).map((url: string) => fetchMetricData(url)))
            .then(metrics => {
                const parsedData = parse_datas(metrics);
                setChartData(parsedData);
                setLoading(false);
            })
            .catch(() => {
                console.error('Error loading data');
                setError(true);
                setLoading(false);
            });
    }, [metricNames]);

    if (loading) return <Loading />;
    if (error) return <ErrorComponent />;

    return (
        <Box sx={{ width: 1 }}>
            <Card variant="outlined" sx={{ flexGrow: 1, mb: 2, }}>
                <CardContent>
                    <Typography component="h3" variant="h5" gutterBottom>
                        {cardTitle}
                    </Typography>
                    <Box>
                        <Line data={chartData} options={options} />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}