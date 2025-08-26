import {
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Alert,
    CircularProgress,
    Chip
} from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import MetricTimeline from '../components/MetricTimeline';
import Grid from '@mui/material/Grid2';
import { useState, useEffect } from 'react';
import { API_VERSION_PREFIX } from '../config';

// Register Chart.js plugins
ChartJS.register(...registerables, zoomPlugin);


import { useProject } from '../context/ProjectContext';

/**
 * Interface for evaluation data from API
 */
interface Evaluation {
    pid: string;
}

/**
 * DataDrift page component with project and evaluation selectors
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
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [selectedEvaluationPid, setSelectedEvaluationPid] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX ;

    const { projectUUID } = useProject();

    // Fetch evaluations when project changes
    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!projectUUID) return;
            try {
                setLoading(true);
                // Get all completed evaluations and filter by project
                const response = await fetch(`${API_URL}/projects/${projectUUID}/evaluations?status=done`);

                if (response.ok) {
                    const evaluations: Evaluation[] = await response.json();
                    // Filter evaluations for the selected project

                        // Select the most recent evaluation by default (last in the list)
                    setEvaluations(evaluations)
                    if (evaluations.length > 0) {
                        setSelectedEvaluationPid(evaluations[evaluations.length - 1].pid);
                    } else {
                        setSelectedEvaluationPid('');
                    }
                } else {
                    setError('Failed to fetch evaluations');
                }
            } catch (error) {
                console.error('Error fetching evaluations:', error);
                setError('Error fetching evaluations');
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [projectUUID]);


    if (loading) {
        return (
            <Box sx={{ width: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading projects...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ width: 1 }}>
                <Typography component="h2" variant="h4" gutterBottom>
                    Data Drift
                </Typography>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }


    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Data Drift Analysis
            </Typography>

            {/* Selectors Section */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
                <Typography variant="h6" gutterBottom color="primary">
                    Select Project and Evaluation
                </Typography>

                <Grid container spacing={3} alignItems="center">


                <Grid size={6}>
                        <FormControl fullWidth disabled={loading || evaluations.length === 0}>
                            <InputLabel id="evaluation-select-label">Evaluation</InputLabel>
                            <Select
                                labelId="evaluation-select-label"
                                value={selectedEvaluationPid}
                                label="Evaluation"
                                onChange={(e) => setSelectedEvaluationPid(e.target.value)}
                            >
                                {evaluations.map((evaluation, index) => (
                                    <MenuItem key={evaluation.pid} value={evaluation.pid}>
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="body1">
                                                    Evaluation #{index + 1}
                                                </Typography>
                                                {index === evaluations.length - 1 && (
                                                    <Chip label="Latest" size="small" color="primary" />
                                                )}
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">
                                                ID: {evaluation.pid}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {loading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                <Typography variant="caption">Loading evaluations...</Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>

                {evaluations.length === 0 && projectUUID && !loading && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        No completed evaluations found for this project.
                    </Alert>
                )}
            </Paper>

            {/* Metrics Visualization */}
            {projectUUID && selectedEvaluationPid && (
                <Grid container spacing={2}>
                    <Grid size={6}>
                        <MetricTimeline
                            cardTitle='Numerical features - Wasserstein distance'
                            metricNames={['wasserstein_distance']}
                            projectPid={projectUUID}
                            evaluationPid={selectedEvaluationPid}
                            group_by_feature={true}
                            sort_by_value={true}
                        />
                </Grid>
                <Grid size={6}>
                        <MetricTimeline
                            cardTitle='Categorical features - Jensen-Shannon divergence'
                            metricNames={["jensenshannon"]}
                            projectPid={projectUUID}
                            evaluationPid={selectedEvaluationPid}
                            group_by_feature={true}
                            sort_by_value={true}
                        />
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
