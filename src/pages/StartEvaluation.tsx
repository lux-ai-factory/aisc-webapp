import { Box, Typography, Button, Paper, Stack, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import React, { useState, useEffect } from 'react';
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';


interface Model {
    pid: string;
    name: string;
    data: string;
}

interface Dataset {
    pid: string;
    name: string;
}

interface ProjectDetail {
    models: Model[];
    datasets: Dataset[];
}

const StartEvaluation: React.FC = () => {
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedDataset, setSelectedDataset] = useState<string>('');

    const [models, setModels] = useState<Model[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
    const { projectUUID } = useProject();

    useEffect(() => {
        if (projectUUID) {
            fetchProjectDetails(projectUUID);
            setSelectedModel('');
            setSelectedDataset('');
        } else {
            setModels([]);
            setDatasets([]);
            setSelectedModel('');
            setSelectedDataset('');
        }
    }, [projectUUID]);

    const apiCall = async (url: string): Promise<ProjectDetail | null> => {
        try {
            const response = await fetch(url);
            return response.ok ? await response.json() : null;
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            return null;
        }
    };

    const fetchProjectDetails = async (projectPid: string) => {
        const projectDetail = await apiCall(`${API_URL}/projects/${projectPid}`);
        console.log(projectDetail)
        if (projectDetail) {
            projectDetail.datasets = projectDetail.datasets.filter((dataset: { name: string; }) => !(dataset.name.startsWith('artifact')));
            setModels(projectDetail.models || []);
            setDatasets(projectDetail.datasets || []);
        }
    };

    const handleModelChange = (event: SelectChangeEvent) => setSelectedModel(event.target.value);
    const handleDatasetChange = (event: SelectChangeEvent) => setSelectedDataset(event.target.value);

    const resetForm = () => {
        setSelectedModel('');
        setSelectedDataset('');
        setModels([]);
        setDatasets([]);
    };

    const handleStartEvaluation = async () => {
        if (!projectUUID || !selectedModel || !selectedDataset) {
            return alert('Please select a project, model, and dataset before starting evaluation.');
        }

        setLoading(true);

        try {
            const params = new URLSearchParams({
                project_pid: projectUUID,
                model_pid: selectedModel,
                test_dataset_pid: selectedDataset,
            });

            console.log('Making POST request to:', `${API_URL}/evaluations?${params}`);
            const response = await fetch(`${API_URL}/evaluations?${params}`, { method: 'POST' });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                return alert(`Error creating evaluation: ${error.detail || 'Unknown error'}`);
            }

            alert("Evaluation started. This may take a while to appear on the front end.")

            resetForm();

        } catch (error) {
            console.error('Error in handleStartEvaluation:', error);
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

                    <FormControl fullWidth disabled={!projectUUID}>
                        <InputLabel id="model-select-label">Model</InputLabel>
                        <Select
                            labelId="model-select-label"
                            id="model-select"
                            value={selectedModel}
                            label="Model"
                            onChange={handleModelChange}
                        >
                            {models.map((model) => (
                                <MenuItem key={model.pid} value={model.pid}>
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth disabled={!projectUUID}>
                        <InputLabel id="dataset-select-label">Test Dataset</InputLabel>
                        <Select
                            labelId="dataset-select-label"
                            id="dataset-select"
                            value={selectedDataset}
                            label="Test Dataset"
                            onChange={handleDatasetChange}
                        >
                            {datasets.map((dataset) => (
                                <MenuItem key={dataset.pid} value={dataset.pid}>
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
                    disabled={loading || !projectUUID || !selectedModel || !selectedDataset}
                >
                    {loading ? 'Creating & Starting Evaluation...' : 'Start Evaluation'}
                </Button>
            </Box>
        </Box>
    );
};

export default StartEvaluation;
