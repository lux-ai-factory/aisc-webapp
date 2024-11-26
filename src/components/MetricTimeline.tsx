
import React, { useState, useEffect } from "react";

import { Box, Typography, Card, CardContent } from '@mui/material';
import { Line, Pie, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(...registerables, zoomPlugin);

const Utils = {
    months: ({ count }: { count: number }) => {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July"];
        return monthNames.slice(0, count);
    }
};

const labels = Utils.months({ count: 7 });
// const data = {
//     labels: labels,
//     datasets: [{
//         label: 'My First Dataset',
//         data: [65, 59, 80, 81, 56, 55, 40],
//         fill: false,
//         borderColor: 'rgb(75, 192, 192)',
//         tension: 0.1
//     }]
// };

function parse_data(data, metricName) {
    const labels = data.map((d) => new Date(d.time).toISOString().slice(0, 19).replace('T', ' '));
    const values = data.map((d) => d.score);
    return {
        labels: labels,
        datasets: [{
            label: metricName,
            data: values,
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    };
}

export default function MetricTimeline(props: { metricName: string }) {
    const { metricName } = props;
    const [graph, setGraph] = useState({
        labels: [],
        datasets: [{
            label: 'My First Dataset',
            data: [],
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
        }]
    });
    useEffect(() => {
        fetch(`/api/metrics?name=${metricName}`, {
            method: "GET",
        })
            .then((response) => response.json())
            .then((data) => {
                setGraph(parse_data(data, metricName));
            })
            .catch((error) => console.log(error));
    }, [metricName]);



    return (
        <Box>
            <Card variant="outlined" sx={{ flexGrow: 1, mb: 2 }}>
                <CardContent>
                    <Typography component="h3" variant="subtitle2" gutterBottom>
                        Hello
                    </Typography>
                    <Box>
                        <Line data={graph} />
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}