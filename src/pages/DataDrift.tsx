
import { Box, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';
import Grid from '@mui/material/Grid2';

ChartJS.register(...registerables, zoomPlugin);




export default function DataDrift() {
    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Data Drift
            </Typography>
            <Grid container spacing={2}>
                <Grid size={6}>
                    <MetricTimeline cardTitle='Numerical features, Wasserstein distance' metricNames={['wasserstein_distance']} group_by_feature={true} sort_by_value={true} />
                </Grid>
                <Grid size={6}>
                    <MetricTimeline cardTitle='Categorical features, Jensen-Shannon divergence' metricNames={["jensenshannon"]} group_by_feature={true} sort_by_value={true} />
                </Grid>
            </Grid>

            {/* <MetricTimeline cardTitle='MCC' metricName='mcc' /> */}

        </Box>
    );
}