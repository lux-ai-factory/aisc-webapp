import { Box, Typography, Button, Paper, Stack, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { API_VERSION_PREFIX } from '../config';

/**
 * Interface for project data from API
 */
interface Project {
    project_id: number;
    project_pid: string;
    project_name: string;
}

/**
 * Interface for model data from API
 */
interface Model {
    model_pid: string;
    name: string;
    data: string;
    project_id: number;
    dataset_id: number;
}

/**
 * Interface for dataset data from API
 */
interface Dataset {
    id: number;
    dataset_pid: string;
    name: string;
    project_id: number;
    datashape_id: number;
}

/**
 * StartEvaluation page component
 * Main page for initiating model evaluation processes
 * Provides interface for configuring and starting model evaluation workflows
 *
 * @returns {JSX.Element} The start evaluation page with configuration options
 */
const StartEvaluation: React.FC = () => {
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedDataset, setSelectedDataset] = useState<string>('');

    const [projects, setProjects] = useState<Project[]>([]);
    const [models, setModels] = useState<Model[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);

    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
    const EVAL_API_URL = import.meta.env.VITE_EVAL_API_URL;

    // Fetch projects on component mount
    useEffect(() => {
        fetchProjects();
    }, []);

    // Fetch models and datasets when project changes
    useEffect(() => {
        if (selectedProject) {
            fetchProjectDetails(selectedProject);
            // Reset model and dataset selections when project changes
            setSelectedModel('');
            setSelectedDataset('');
        } else {
            setModels([]);
            setDatasets([]);
            setSelectedModel('');
            setSelectedDataset('');
        }
    }, [selectedProject]);

    // Helper function for API calls
    const apiCall = async (url: string) => {
        try {
            const response = await fetch(url);
            return response.ok ? await response.json() : null;
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            return null;
        }
    };

    const fetchProjects = async () => {
        const data = await apiCall(`${API_URL}/projects`);
        if (data) setProjects(data);
    };

    const fetchProjectDetails = async (projectPid: string) => {
        const projectDetail = await apiCall(`${API_URL}/projects/${projectPid}`);
        if (projectDetail) {
            setModels(projectDetail.model || []);
            setDatasets(projectDetail.dataset || []);
        }
    };

    const handleProjectChange = (event: SelectChangeEvent) => setSelectedProject(event.target.value);
    const handleModelChange = (event: SelectChangeEvent) => setSelectedModel(event.target.value);
    const handleDatasetChange = (event: SelectChangeEvent) => setSelectedDataset(event.target.value);

    const triggerEvaluation = async () => {
        const response = await fetch(`${EVAL_API_URL}/evaluate`);
        if (response?.ok) {
            console.log('Evaluation triggered successfully');
            return { success: true };
        }
        const error = response ? await response.json().catch(() => ({})) : {};
        return { success: false, error: error.detail || 'Failed to trigger evaluation' };
    };

    const resetForm = () => {
        setSelectedProject('');
        setSelectedModel('');
        setSelectedDataset('');
        setModels([]);
        setDatasets([]);
    };

    const handleStartEvaluation = async () => {
        if (!selectedProject || !selectedModel || !selectedDataset) {
            return alert('Please select a project, model, and dataset before starting evaluation.');
        }

        setLoading(true);

        try {
            const params = new URLSearchParams({
                project_pid: selectedProject,
                model_pid: selectedModel,
                test_dataset_pid: selectedDataset,
            });

            const response = await fetch(`${API_URL}/evaluations?${params}`, { method: 'POST' });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return alert(`Error creating evaluation: ${error.detail || 'Unknown error'}`);
            }

            const evaluationData = await response.json();
            const triggerResult = await triggerEvaluation();

            const message = triggerResult.success
                ? `Evaluation created and started successfully! ID: ${evaluationData.evaluation_pid}`
                : `Evaluation created (ID: ${evaluationData.evaluation_pid}) but failed to start: ${triggerResult.error}`;

            alert(message);
            resetForm();

        } catch (error) {
            alert('Network error occurred while creating evaluation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Start Model Evaluation
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
                Configure and initiate your AI model evaluation process. This will analyze your model's data drift for now, but will be expanded to include other metrics in the future.
            </Typography>

            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Evaluation Configuration
                </Typography>

                <Stack spacing={3}>
                    <FormControl fullWidth>
                        <InputLabel id="project-select-label">Project</InputLabel>
                        <Select
                            labelId="project-select-label"
                            id="project-select"
                            value={selectedProject}
                            label="Project"
                            onChange={handleProjectChange}
                        >
                            {projects.map((project) => (
                                <MenuItem key={project.project_pid} value={project.project_pid}>
                                    {project.project_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth disabled={!selectedProject}>
                        <InputLabel id="model-select-label">Model</InputLabel>
                        <Select
                            labelId="model-select-label"
                            id="model-select"
                            value={selectedModel}
                            label="Model"
                            onChange={handleModelChange}
                        >
                            {models.map((model) => (
                                <MenuItem key={model.model_pid} value={model.model_pid}>
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth disabled={!selectedProject}>
                        <InputLabel id="dataset-select-label">Test Dataset</InputLabel>
                        <Select
                            labelId="dataset-select-label"
                            id="dataset-select"
                            value={selectedDataset}
                            label="Test Dataset"
                            onChange={handleDatasetChange}
                        >
                            {datasets.map((dataset) => (
                                <MenuItem key={dataset.dataset_pid} value={dataset.dataset_pid}>
                                    {dataset.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2 }}>
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={handleStartEvaluation}
                    disabled={loading || !selectedProject || !selectedModel || !selectedDataset}
                >
                    {loading ? 'Creating & Starting Evaluation...' : 'Start Evaluation'}
                </Button>
            </Box>
        </Box>
    );
};

export default StartEvaluation;
