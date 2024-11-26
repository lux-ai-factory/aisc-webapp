
import * as React from 'react';

import { Box, Typography, Card, CardContent } from '@mui/material';
import { Line, Pie, Scatter } from 'react-chartjs-2';
import { Chart as ChartJS, registerables} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';

ChartJS.register(...registerables, zoomPlugin);

const Utils = {
    months: ({ count }: { count: number }) => {
        const monthNames = ["January", "February", "March", "April", "May", "June", "July"];
        return monthNames.slice(0, count);
    }
};

const labels = Utils.months({ count: 7 });
const data = {
  labels: labels,
  datasets: [{
    label: 'My First Dataset',
    data: [65, 59, 80, 81, 56, 55, 40],
    fill: false,
    borderColor: 'rgb(75, 192, 192)',
    tension: 0.1
  }]
};

export default function ModelPerformance() {
    return (
        <Box>
            <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
                Accuracy and Correctness
            </Typography>
            <Card variant="outlined" sx={{ flexGrow: 1 }}>
                <CardContent>
                    <Typography component="h3" variant="subtitle2" gutterBottom>
                        Hello
                    </Typography>
                    <Box>
                        <Line data={data} />
                    </Box>
                </CardContent>
            </Card>
            <MetricTimeline metricName='test_get_metric' />
        </Box>
    );
}