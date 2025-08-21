import { Box, CircularProgress, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';

// Register Chart.js plugins
ChartJS.register(...registerables, zoomPlugin);

/**
 * ModelPerformance page component
 * Displays model performance metrics over time
 * Shows a timeline of various classification metrics:
 * - ROC AUC
 * - Matthews Correlation Coefficient (MCC)
 * - F1 Score
 * - Accuracy
 * - Precision
 * - Recall
 *
 * All metrics are plotted on the same timeline for easy comparison
 *
 * @returns {JSX.Element} The model performance analysis page with metric timeline
 */
export default function ModelPerformance() {

    const {projectUUID} = useProject()


    if (!projectUUID) return <CircularProgress />;

    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Accuracy and correctness
            </Typography>
            <Grid container spacing={2}>
                <Grid size={6}>
                    <MetricTimeline projectPid={projectUUID} cardTitle='Performance over time' metricNames={["ROCAUC", "MCC", "F1", "Accuracy", "Precision", "Recall"]} group_by_feature={false} sort_by_value={true} />
                </Grid>
            </Grid>

            {/* <MetricTimeline cardTitle='MCC' metricName='mcc' /> */}

        </Box>
    );
}
