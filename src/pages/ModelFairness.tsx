import { Alert, Box, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import FairnessTimeline from '../components/FairnessTimeline';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';
import { useEffect, useState } from 'react';
import { API_VERSION_PREFIX } from '../config';

// Register Chart.js plugins
ChartJS.register(...registerables, zoomPlugin);

interface Evaluation {
    pid: string;
}

/**
 * ModelFairness page component
 * Displays model fairness metrics over time
 *
 * All metrics are plotted on the same timeline for easy comparison
 *
 * @returns {JSX.Element} The model fairness analysis page with metric timeline
 */
export default function ModelFairness() {

    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [selectedEvaluationPid, setSelectedEvaluationPid] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

    const { projectUUID } = useProject();

    // Fetch evaluations when project changes
    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!projectUUID) return;
            try {
                setLoading(true);
                // Get all completed evaluations and filter by project
                const response = await fetch(`${API_URL}/projects/${projectUUID}/evaluations?status=Done`);

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
        <Stack spacing={4} sx={{ p: 3 }}>
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Accuracy and correctness
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
                    <Grid size={12}>
                        <FairnessTimeline
                            cardTitle="Fairness (Accuracy) Over Time"
                            metricNames={["Fairness_Accuracy"]}
                            evaluationPid={selectedEvaluationPid}
                        />
                    </Grid>
                </Grid>
            )}
        </Box>
        </Stack>
    );
}
