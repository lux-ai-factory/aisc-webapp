
import { Box, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';

ChartJS.register(...registerables, zoomPlugin);




export default function ModelPerformance() {
    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Accuracy and Correctness
            </Typography>

            <MetricTimeline cardTitle='Performance over time' metricNames={['accuracy', 'mcc',]} />
            {/* <MetricTimeline cardTitle='MCC' metricName='mcc' /> */}

        </Box>
    );
}