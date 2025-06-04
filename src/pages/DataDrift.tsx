import { Box, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';
import Grid from '@mui/material/Grid2';

// Register Chart.js plugins
ChartJS.register(...registerables, zoomPlugin);

/**
 * DataDrift page component
 * Displays data drift metrics and visualizations
 * Shows two metric timelines:
 * 1. Wasserstein distance for numerical features
 * 2. Jensen-Shannon divergence for categorical features
 * 
 * Both visualizations are grouped by feature and sorted by value
 * 
 * @returns {JSX.Element} The data drift analysis page with metric timelines
 */
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