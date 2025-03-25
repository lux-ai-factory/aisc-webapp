
import { Box, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';
import Grid from '@mui/material/Grid2';

ChartJS.register(...registerables, zoomPlugin);




export default function ModelPerformance() {
    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Accuracy and correctness
            </Typography>
            <Grid container spacing={2}>
                <Grid size={6}>
                    <MetricTimeline cardTitle='Performance over time' metricNames={["ROCAUC", "MCC", "F1", "Accuracy", "Precision", "Recall"]} group_by_feature={false} sort_by_value={true} />
                </Grid>
            </Grid>

            {/* <MetricTimeline cardTitle='MCC' metricName='mcc' /> */}

        </Box>
    );
}
