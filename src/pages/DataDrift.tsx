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

/**
 * Interface for project data from API
 */
interface Project {
    project_id: number;
    project_pid: string;
    project_name: string;
}

/**
 * Interface for evaluation data from API
 */
interface Evaluation {
    evaluation_pid: string;
    project_id: number;
    model_id: number;
    test_dataset_id: number;
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
    const [projects, setProjects] = useState<Project[]>([]);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [selectedProjectPid, setSelectedProjectPid] = useState<string>('');
    const [selectedEvaluationPid, setSelectedEvaluationPid] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingEvaluations, setLoadingEvaluations] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX ;

    // Fetch projects on component mount
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API_URL}/projects`);
                if (response.ok) {
                    const projectsData: Project[] = await response.json();
                    setProjects(projectsData);

                    // Select first project by default
                    if (projectsData.length > 0) {
                        setSelectedProjectPid(projectsData[0].project_pid);
                    }
                } else {
                    setError('Failed to fetch projects');
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
                setError('Error fetching projects');
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, [API_URL]);

    // Fetch evaluations when project changes
    useEffect(() => {
        const fetchEvaluations = async () => {
            if (!selectedProjectPid) return;

            try {
                setLoadingEvaluations(true);
                // Get all completed evaluations and filter by project
                const response = await fetch(`${API_URL}/evaluations?status=done`);
                if (response.ok) {
                    const allEvaluations: Evaluation[] = await response.json();
                    // Filter evaluations for the selected project
                    const selectedProject = projects.find(p => p.project_pid === selectedProjectPid);
                    if (selectedProject) {
                        const projectEvaluations = allEvaluations.filter(
                            evaluation => evaluation.project_id === selectedProject.project_id
                        );
                        setEvaluations(projectEvaluations);

                        // Select the most recent evaluation by default (last in the list)
                        if (projectEvaluations.length > 0) {
                            setSelectedEvaluationPid(projectEvaluations[projectEvaluations.length - 1].evaluation_pid);
                        } else {
                            setSelectedEvaluationPid('');
                        }
                    }
                } else {
                    setError('Failed to fetch evaluations');
                }
            } catch (error) {
                console.error('Error fetching evaluations:', error);
                setError('Error fetching evaluations');
            } finally {
                setLoadingEvaluations(false);
            }
        };

        fetchEvaluations();
    }, [selectedProjectPid, projects, API_URL]);

    const handleProjectChange = (projectPid: string) => {
        setSelectedProjectPid(projectPid);
        setSelectedEvaluationPid(''); // Reset evaluation selection
    };

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

    if (projects.length === 0) {
        return (
            <Box sx={{ width: 1 }}>
                <Typography component="h2" variant="h4" gutterBottom>
                    Data Drift
                </Typography>
                <Alert severity="info">No projects found. Please create a project first.</Alert>
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
                        <FormControl fullWidth>
                            <InputLabel id="project-select-label">Project</InputLabel>
                            <Select
                                labelId="project-select-label"
                                value={selectedProjectPid}
                                label="Project"
                                onChange={(e) => handleProjectChange(e.target.value)}
                            >
                                {projects.map((project) => (
                                    <MenuItem key={project.project_pid} value={project.project_pid}>
                                        <Box>
                                            <Typography variant="body1">{project.project_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                ID: {project.project_pid}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                <Grid size={6}>
                        <FormControl fullWidth disabled={loadingEvaluations || evaluations.length === 0}>
                            <InputLabel id="evaluation-select-label">Evaluation</InputLabel>
                            <Select
                                labelId="evaluation-select-label"
                                value={selectedEvaluationPid}
                                label="Evaluation"
                                onChange={(e) => setSelectedEvaluationPid(e.target.value)}
                            >
                                {evaluations.map((evaluation, index) => (
                                    <MenuItem key={evaluation.evaluation_pid} value={evaluation.evaluation_pid}>
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
                                                ID: {evaluation.evaluation_pid}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {loadingEvaluations && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                <Typography variant="caption">Loading evaluations...</Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>

                {evaluations.length === 0 && selectedProjectPid && !loadingEvaluations && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        No completed evaluations found for this project.
                    </Alert>
                )}
            </Paper>

            {/* Metrics Visualization */}
            {selectedProjectPid && selectedEvaluationPid && (
                <Grid container spacing={2}>
                    <Grid size={6}>
                        <MetricTimeline
                            cardTitle='Numerical features - Wasserstein distance'
                            metricNames={['wasserstein_distance']}
                            projectPid={selectedProjectPid}
                            evaluationPid={selectedEvaluationPid}
                            group_by_feature={true}
                            sort_by_value={true}
                        />
                </Grid>
                <Grid size={6}>
                        <MetricTimeline
                            cardTitle='Categorical features - Jensen-Shannon divergence'
                            metricNames={["jensenshannon"]}
                            projectPid={selectedProjectPid}
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