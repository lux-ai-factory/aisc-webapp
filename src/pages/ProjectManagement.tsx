import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Button,
    Paper,
    TextField,
    Stack,
    Card,
    CardContent,
    Alert,
    CircularProgress,
    Divider,
    Chip,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    SelectChangeEvent,
    Tabs,
    Tab
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import UploadFileField from '../components/UploadFileField';

/** Step names for the project creation process */
const STEP_NAMES = [
    'Project Details',
    'Models & Datasets',
    'Upload Files (Required)',
    'Summary'
];

/** Interface for project basic info */
interface ProjectInfo {
    name: string;
    frequency?: string;
    window_size?: string;
}

/** Interface for a model to be created */
interface ModelInfo {
    id: string;
    name: string;
    model_pid?: string;
    training_dataset_pid?: string;
    training_dataset_name: string;
    model_uploaded?: boolean;
    training_uploaded?: boolean;
}

/** Interface for a test dataset to be created */
interface TestDatasetInfo {
    id: string;
    name: string;
    dataset_pid?: string;
    uploaded?: boolean;
}

/** Interface for existing project selection */
interface ExistingProject {
    project_id: number;
    project_pid: string;
    project_name: string;
}

/** Interface for tab panels */
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

/** Custom hook for managing collections */
function useCollection<T extends { id: string }>(initialItems: T[] = []) {
    const [items, setItems] = useState<T[]>(initialItems);

    const addItem = (item: T) => setItems(prev => [...prev, item]);
    const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));
    const updateItem = (id: string, updates: Partial<T>) => {
        setItems(prev => prev.map(item => 
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    return { items, setItems, addItem, removeItem, updateItem };
}

/** Generic upload card component */
interface UploadCardProps {
    title: string;
    uploadItems: Array<{
        label: string;
        fileType: string;
        uploadUrl?: string;
        isUploaded?: boolean;
        onSuccess: (fileName: string) => void;
    }>;
    isComplete?: boolean;
}

const UploadCard = React.memo(({ title, uploadItems, isComplete }: UploadCardProps) => {
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {title}
                    {isComplete && (
                        <Chip label="Complete" color="success" size="small" sx={{ ml: 2 }} />
                    )}
                </Typography>
                
                <Stack spacing={3}>
                    {uploadItems.map((item, index) => (
                        <Box key={index}>
                            <Typography variant="subtitle1" gutterBottom>
                                {item.label} {item.isUploaded && "✓"}
                            </Typography>
                            {item.uploadUrl ? (
                                <UploadFileField
                                    label={item.label}
                                    fileType={item.fileType}
                                    uploadUrl={item.uploadUrl}
                                    onSuccess={item.onSuccess}
                                />
                            ) : (
                                <Alert severity="warning">
                                    Complete project creation first to enable file upload.
                                </Alert>
                            )}
                        </Box>
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
});

/** Simplified validation functions */
const validators = {
    projectName: (name: string) => {
        if (name.trim().length < 3) {
            return { isValid: false, error: 'Project name must be at least 3 characters' };
        }
        return { isValid: true };
    },
    
    frequency: (frequency: string) => {
        if (!frequency.trim()) return { isValid: true };
        const pattern = /^\d+\s*[DWMY]$/i;
        if (!pattern.test(frequency)) {
            return { isValid: false, error: 'Format should be like "30D", "2W", "1M", or "1Y"' };
        }
        return { isValid: true };
    },
    
    windowSize: (windowSize: string) => {
        if (!windowSize.trim()) return { isValid: true };
        const pattern = /^\d+\s+(day|days|week|weeks|month|months|year|years)$/i;
        if (!pattern.test(windowSize)) {
            return { isValid: false, error: 'Format should be like "90 days", "1 week", "3 months", or "2 years"' };
        }
        return { isValid: true };
    }
};

/** Step 1: Project Details Component */
interface ProjectDetailsStepProps {
    project: ProjectInfo;
    onChange: (field: keyof ProjectInfo, value: string) => void;
}

function ProjectDetailsStep({ project, onChange }: ProjectDetailsStepProps) {
    const [errors, setErrors] = useState<{ name?: string; frequency?: string; window_size?: string }>({});

    const handleChange = (field: keyof ProjectInfo, value: string) => {
        onChange(field, value);
        
        // Validate on change
        let error: string | undefined;
        if (field === 'name') {
            const validation = validators.projectName(value);
            error = validation.error;
        } else if (field === 'frequency') {
            const validation = validators.frequency(value);
            error = validation.error;
        } else if (field === 'window_size') {
            const validation = validators.windowSize(value);
            error = validation.error;
        }
        
        setErrors(prev => ({ ...prev, [field]: error }));
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Project Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Configure your project settings. Name is required, while frequency and window size are optional for time-series analysis.
                </Typography>
                
                <Stack spacing={3}>
                    <TextField
                        label="Project Name"
                        value={project.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        fullWidth
                        required
                        error={!!errors.name}
                        helperText={errors.name || "A descriptive name for your AI project"}
                    />
                    
                    <TextField
                        label="Frequency (Optional)"
                        value={project.frequency || ''}
                        onChange={(e) => handleChange('frequency', e.target.value)}
                        fullWidth
                        error={!!errors.frequency}
                        helperText={
                            errors.frequency ||
                            "Data frequency for time-series analysis (e.g., '30D', '1M'). This setting determines how often metrics are calculated (e.g., '7D' will compute metrics every 7 days)."
                        }
                        placeholder="e.g., 30D, 1M, 1W"
                    />
                    
                    <TextField
                        label="Window Size (Optional)"
                        value={project.window_size || ''}
                        onChange={(e) => handleChange('window_size', e.target.value)}
                        fullWidth
                        error={!!errors.window_size}
                        helperText={
                            errors.window_size ||
                            "Analysis window size (e.g., '90 days', '3 months'). This setting determines the time period over which metrics are calculated (e.g., '90 days' will compute metrics for the last 90 days)."
                        }
                        placeholder="e.g., 90 days, 3 months"
                    />
                </Stack>
            </CardContent>
        </Card>
    );
}

/** Step 2: Models & Datasets Configuration Component */
interface ModelsDatasetStepProps {
    models: ModelInfo[];
    onModelsChange: (models: ModelInfo[]) => void;
    testDatasets: TestDatasetInfo[];
    onTestDatasetsChange: (datasets: TestDatasetInfo[]) => void;
}

function ModelsDatasetStep({ models, onModelsChange, testDatasets, onTestDatasetsChange }: ModelsDatasetStepProps) {
    const modelsCollection = useCollection<ModelInfo>();
    const datasetsCollection = useCollection<TestDatasetInfo>();

    // Keep original props in sync with collection
    React.useEffect(() => {
        modelsCollection.setItems(models);
    }, [models]);

    React.useEffect(() => {
        datasetsCollection.setItems(testDatasets);
    }, [testDatasets]);

    React.useEffect(() => {
        onModelsChange(modelsCollection.items);
    }, [modelsCollection.items, onModelsChange]);

    React.useEffect(() => {
        onTestDatasetsChange(datasetsCollection.items);
    }, [datasetsCollection.items, onTestDatasetsChange]);

    const addModel = () => {
        const newModel: ModelInfo = {
            id: `model_${Date.now()}`,
            name: `Model ${models.length + 1}`,
            training_dataset_name: `Training Dataset ${models.length + 1}`
        };
        modelsCollection.addItem(newModel);
    };

    const addTestDataset = () => {
        const newDataset: TestDatasetInfo = {
            id: `dataset_${Date.now()}`,
            name: `Test Dataset ${testDatasets.length + 1}`
        };
        datasetsCollection.addItem(newDataset);
    };

    return (
        <Stack spacing={3}>
            {/* Models Section */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Models
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={addModel}
                        >
                            Add Model
                        </Button>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Add models to your project. Each model will have its own training dataset.
                    </Typography>

                    {models.length === 0 ? (
                        <Alert severity="info">
                            No models added yet. Click "Add Model" to get started.
                        </Alert>
                    ) : (
                        <Stack spacing={2}>
                            {models.map((model) => (
                                <Paper key={model.id} variant="outlined" sx={{ p: 2 }}>
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <TextField
                                                label="Model Name"
                                                value={model.name}
                                                onChange={(e) => modelsCollection.updateItem(model.id, { name: e.target.value })}
                                                size="small"
                                                sx={{ flex: 1 }}
                                            />
                                            <IconButton onClick={() => modelsCollection.removeItem(model.id)} color="error">
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                        <TextField
                                            label="Training Dataset Name"
                                            value={model.training_dataset_name}
                                            onChange={(e) => modelsCollection.updateItem(model.id, { training_dataset_name: e.target.value })}
                                            size="small"
                                            helperText="Name for the training dataset associated with this model"
                                        />
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </CardContent>
            </Card>

            {/* Test Datasets Section */}
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Test Datasets
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={addTestDataset}
                        >
                            Add Test Dataset
                        </Button>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Add test datasets to your project. These will be used for model evaluation.
                    </Typography>

                    {testDatasets.length === 0 ? (
                        <Alert severity="info">
                            No test datasets added yet. Click "Add Test Dataset" to get started.
                        </Alert>
                    ) : (
                        <Stack spacing={2}>
                            {testDatasets.map((dataset) => (
                                <Paper key={dataset.id} variant="outlined" sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <TextField
                                            label="Test Dataset Name"
                                            value={dataset.name}
                                            onChange={(e) => datasetsCollection.updateItem(dataset.id, { name: e.target.value })}
                                            size="small"
                                            sx={{ flex: 1 }}
                                        />
                                        <IconButton onClick={() => datasetsCollection.removeItem(dataset.id)} color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </Stack>
    );
}

/** Step 3: File Uploads Component */
interface FileUploadsStepProps {
    models: ModelInfo[];
    onModelsChange: (models: ModelInfo[]) => void;
    testDatasets: TestDatasetInfo[];
    onTestDatasetsChange: (datasets: TestDatasetInfo[]) => void;
}

function FileUploadsStep({ models, onModelsChange, testDatasets, onTestDatasetsChange }: FileUploadsStepProps) {
    const API_URL = import.meta.env.VITE_BACKEND_API_URL;

    const totalUploads = models.length * 2 + testDatasets.length;
    const completedUploads = models.filter(m => m.model_uploaded).length + 
                           models.filter(m => m.training_uploaded).length + 
                           testDatasets.filter(d => d.uploaded).length;

    const handleModelUpload = (modelId: string, type: 'model' | 'training') => (fileName: string) => {
        onModelsChange(models.map(m => 
            m.id === modelId ? { ...m, [`${type}_uploaded`]: true } : m
        ));
    };

    const handleDatasetUpload = (datasetId: string) => (fileName: string) => {
        onTestDatasetsChange(testDatasets.map(d => 
            d.id === datasetId ? { ...d, uploaded: true } : d
        ));
    };

    return (
        <Stack spacing={3}>
            <Alert severity={completedUploads === totalUploads ? "success" : "warning"}>
                {totalUploads === 0 
                    ? "No files to upload. You can proceed to the summary."
                    : `File uploads required: ${completedUploads}/${totalUploads} completed.`
                }
            </Alert>

            {models.map((model) => (
                <UploadCard
                    key={model.id}
                    title={model.name}
                    isComplete={model.model_uploaded && model.training_uploaded}
                    uploadItems={[
                        {
                            label: "Model File (ONNX)",
                            fileType: ".onnx",
                            uploadUrl: model.model_pid ? `${API_URL}/models/${model.model_pid}/data` : undefined,
                            isUploaded: model.model_uploaded,
                            onSuccess: handleModelUpload(model.id, 'model')
                        },
                        {
                            label: "Training Dataset (CSV)",
                            fileType: ".csv,.parquet",
                            uploadUrl: model.training_dataset_pid ? `${API_URL}/datasets/${model.training_dataset_pid}/data` : undefined,
                            isUploaded: model.training_uploaded,
                            onSuccess: handleModelUpload(model.id, 'training')
                        }
                    ]}
                />
            ))}

            {testDatasets.map((dataset) => (
                <UploadCard
                    key={dataset.id}
                    title={dataset.name}
                    isComplete={dataset.uploaded}
                    uploadItems={[
                        {
                            label: "Test Dataset (CSV)",
                            fileType: ".csv,.parquet",
                            uploadUrl: dataset.dataset_pid ? `${API_URL}/datasets/${dataset.dataset_pid}/data` : undefined,
                            isUploaded: dataset.uploaded,
                            onSuccess: handleDatasetUpload(dataset.id)
                        }
                    ]}
                />
            ))}
        </Stack>
    );
}

/** Step 4: Summary Component */
interface SummaryStepProps {
    project: ProjectInfo;
    models: ModelInfo[];
    testDatasets: TestDatasetInfo[];
    projectPid?: string;
    isProjectCreated: boolean;
}

function SummaryStep({ project, models, testDatasets, projectPid, isProjectCreated }: SummaryStepProps) {
    return (
        <Stack spacing={3}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Project Summary
                    </Typography>
                    
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Project Details</Typography>
                            <Typography>Name: {project.name}</Typography>
                            {project.frequency && <Typography>Frequency: {project.frequency}</Typography>}
                            {project.window_size && <Typography>Window Size: {project.window_size}</Typography>}
                            {projectPid && <Typography>Project ID: {projectPid}</Typography>}
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Models ({models.length})</Typography>
                            {models.map((model) => (
                                <Box key={model.id} sx={{ ml: 2 }}>
                                    <Typography>• {model.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Training Dataset: {model.training_dataset_name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        <Chip 
                                            label={model.model_uploaded ? "Model Uploaded" : "Model Pending"} 
                                            color={model.model_uploaded ? "success" : "default"}
                                            size="small"
                                        />
                                        <Chip 
                                            label={model.training_uploaded ? "Training Data Uploaded" : "Training Data Pending"} 
                                            color={model.training_uploaded ? "success" : "default"}
                                            size="small"
                                        />
                                    </Box>
                                </Box>
                            ))}
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Test Datasets ({testDatasets.length})</Typography>
                            {testDatasets.map((dataset) => (
                                <Box key={dataset.id} sx={{ ml: 2 }}>
                                    <Typography>• {dataset.name}</Typography>
                                    <Chip 
                                        label={dataset.uploaded ? "Uploaded" : "Pending"} 
                                        color={dataset.uploaded ? "success" : "default"}
                                        size="small"
                                        sx={{ mt: 1 }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {isProjectCreated && (
                <Alert severity="success">
                    <Typography variant="body1" fontWeight="bold">
                        Project Created Successfully!
                    </Typography>
                    <Typography variant="body2">
                        Your project has been created and is ready to use. You can now navigate to "Start Evaluation" to begin analyzing your models.
                    </Typography>
                </Alert>
            )}
        </Stack>
    );
}

/** Component for adding models and datasets to existing projects */
function AddToExistingProject() {
    const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [testDatasets, setTestDatasets] = useState<TestDatasetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    const API_URL = import.meta.env.VITE_BACKEND_API_URL;

    // Fetch existing projects on component mount
    useEffect(() => {
        fetchExistingProjects();
    }, []);

    const fetchExistingProjects = async () => {
        try {
            const response = await fetch(`${API_URL}/projects`);
            if (response.ok) {
                const data = await response.json();
                setExistingProjects(data);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        }
    };

    const handleProjectChange = (event: SelectChangeEvent) => {
        setSelectedProject(event.target.value);
        setError('');
        setSuccess('');
    };

    const modelsCollection = useCollection<ModelInfo>();
    const datasetsCollection = useCollection<TestDatasetInfo>();

    const addModel = () => {
        const newModel: ModelInfo = {
            id: `model_${Date.now()}`,
            name: `Model ${models.length + 1}`,
            training_dataset_name: `Training Dataset ${models.length + 1}`
        };
        modelsCollection.addItem(newModel);
        setModels([...models, newModel]);
    };

    const addTestDataset = () => {
        const newDataset: TestDatasetInfo = {
            id: `dataset_${Date.now()}`,
            name: `Test Dataset ${testDatasets.length + 1}`
        };
        datasetsCollection.addItem(newDataset);
        setTestDatasets([...testDatasets, newDataset]);
    };

    const addResourcesToProject = async () => {
        if (!selectedProject) {
            setError('Please select a project');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Add models to the project
            const updatedModels = [...models];
            for (let i = 0; i < updatedModels.length; i++) {
                const model = updatedModels[i];

                // Create standalone training dataset (not linked to project)
                const trainingDatasetResponse = await fetch(`${API_URL}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: model.training_dataset_name })
                });

                if (!trainingDatasetResponse.ok) {
                    throw new Error(`Failed to create training dataset: ${model.training_dataset_name}`);
                }

                const trainingDatasetResult = await trainingDatasetResponse.json();
                updatedModels[i].training_dataset_pid = trainingDatasetResult.dataset_pid;

                // Create model linked to the standalone training dataset
                const modelResponse = await fetch(`${API_URL}/projects/${selectedProject}/models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: model.name,
                        dataset_pid: trainingDatasetResult.dataset_pid
                    })
                });

                if (!modelResponse.ok) {
                    throw new Error(`Failed to create model: ${model.name}`);
                }

                const modelResult = await modelResponse.json();
                updatedModels[i].model_pid = modelResult.model_pid;
                updatedModels[i].model_uploaded = false;
                updatedModels[i].training_uploaded = false;
            }

            // Add test datasets to the project
            const updatedTestDatasets = [...testDatasets];
            for (let i = 0; i < updatedTestDatasets.length; i++) {
                const dataset = updatedTestDatasets[i];

                const datasetResponse = await fetch(`${API_URL}/projects/${selectedProject}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: dataset.name })
                });

                if (!datasetResponse.ok) {
                    throw new Error(`Failed to create test dataset: ${dataset.name}`);
                }

                const datasetResult = await datasetResponse.json();
                updatedTestDatasets[i].dataset_pid = datasetResult.dataset_pid;
                updatedTestDatasets[i].uploaded = false;
            }

            // Update state
            setModels(updatedModels);
            setTestDatasets(updatedTestDatasets);
            setSuccess(`Successfully added ${models.length} models and ${testDatasets.length} test datasets to the project. You can now upload files below.`);

        } catch (error) {
            console.error('Error adding resources to project:', error);
            setError(error instanceof Error ? error.message : 'Failed to add resources to project');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedProject('');
        setModels([]);
        setTestDatasets([]);
        modelsCollection.setItems([]);
        datasetsCollection.setItems([]);
        setError('');
        setSuccess('');
    };

    return (
        <Stack spacing={3}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Add to Existing Project
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Select an existing project and add new models and test datasets to it.
                    </Typography>
                    
                    <FormControl fullWidth sx={{ mb: 3 }}>
                        <InputLabel>Select Project</InputLabel>
                        <Select
                            value={selectedProject}
                            label="Select Project"
                            onChange={handleProjectChange}
                        >
                            {existingProjects.map((project) => (
                                <MenuItem key={project.project_pid} value={project.project_pid}>
                                    {project.project_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {success && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            {success}
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {selectedProject && (
                <>
                    {/* Models Section */}
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">
                                    Models to Add
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={addModel}
                                >
                                    Add Model
                                </Button>
                            </Box>

                            {models.length === 0 ? (
                                <Alert severity="info">
                                    No models to add. Click "Add Model" to get started.
                                </Alert>
                            ) : (
                                <Stack spacing={2}>
                                    {models.map((model) => (
                                        <Paper key={model.id} variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                                        <TextField
                                        label="Model Name"
                                        value={model.name}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            modelsCollection.updateItem(model.id, { name: newValue });
                                            setModels(models.map(m => m.id === model.id ? { ...m, name: newValue } : m));
                                        }}
                                        size="small"
                                        sx={{ flex: 1 }}
                                    />
                                    <IconButton onClick={() => {
                                        modelsCollection.removeItem(model.id);
                                        setModels(models.filter(m => m.id !== model.id));
                                    }} color="error">
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                                <TextField
                                    label="Training Dataset Name"
                                    value={model.training_dataset_name}
                                    onChange={(e) => {
                                        const newValue = e.target.value;
                                        modelsCollection.updateItem(model.id, { training_dataset_name: newValue });
                                        setModels(models.map(m => m.id === model.id ? { ...m, training_dataset_name: newValue } : m));
                                    }}
                                    size="small"
                                    helperText="Name for the training dataset associated with this model"
                                />
                                            </Stack>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>

                    {/* Test Datasets Section */}
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6">
                                    Test Datasets to Add
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={addTestDataset}
                                >
                                    Add Test Dataset
                                </Button>
                            </Box>

                            {testDatasets.length === 0 ? (
                                <Alert severity="info">
                                    No test datasets to add. Click "Add Test Dataset" to get started.
                                </Alert>
                            ) : (
                                <Stack spacing={2}>
                                    {testDatasets.map((dataset) => (
                                        <Paper key={dataset.id} variant="outlined" sx={{ p: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                                        <TextField
                                            label="Test Dataset Name"
                                            value={dataset.name}
                                            onChange={(e) => {
                                                const newValue = e.target.value;
                                                datasetsCollection.updateItem(dataset.id, { name: newValue });
                                                setTestDatasets(testDatasets.map(d => d.id === dataset.id ? { ...d, name: newValue } : d));
                                            }}
                                            size="small"
                                            sx={{ flex: 1 }}
                                        />
                                        <IconButton onClick={() => {
                                            datasetsCollection.removeItem(dataset.id);
                                            setTestDatasets(testDatasets.filter(d => d.id !== dataset.id));
                                        }} color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                            </Box>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            onClick={addResourcesToProject}
                            disabled={loading || (models.length === 0 && testDatasets.length === 0)}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Add to Project'}
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={resetForm}
                            disabled={loading}
                        >
                            Reset
                        </Button>
                    </Box>

                    {/* File Upload Section */}
                    {(models.some(m => m.model_pid) || testDatasets.some(d => d.dataset_pid)) && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Upload Files
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Upload the required files for the models and datasets you just added.
                                </Typography>
                                
                                <FileUploadsStep 
                                    models={models}
                                    onModelsChange={setModels}
                                    testDatasets={testDatasets}
                                    onTestDatasetsChange={setTestDatasets}
                                />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </Stack>
    );
}

/** New project creation component */
function NewProjectContent() {
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    
    // Separate state for each part
    const [project, setProject] = useState<ProjectInfo>({ name: '', frequency: '', window_size: '' });
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [testDatasets, setTestDatasets] = useState<TestDatasetInfo[]>([]);
    const [projectPid, setProjectPid] = useState<string>('');
    const [isProjectCreated, setIsProjectCreated] = useState(false);

    const API_URL = import.meta.env.VITE_BACKEND_API_URL;

    const handleProjectChange = (field: keyof ProjectInfo, value: string) => {
        setProject(prev => ({ ...prev, [field]: value }));
    };

    const createProjectResources = async () => {
        setLoading(true);
        setError('');

        try {
            // Step 1: Create Project
            const projectResponse = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: project.name,
                    frequency: project.frequency || undefined,
                    window_size: project.window_size || undefined
                })
            });

            if (!projectResponse.ok) {
                const errorData = await projectResponse.json();
                throw new Error(errorData.detail || 'Failed to create project');
            }

            const projectResult = await projectResponse.json();
            const newProjectPid = projectResult.project_pid;
            setProjectPid(newProjectPid);

            // Step 2: Create Models and their Training Datasets with file uploads (following hydrate.py pattern)
            const updatedModels = [...models];
            for (let i = 0; i < updatedModels.length; i++) {
                const model = updatedModels[i];

                // Create standalone training dataset (not linked to project)
                const trainingDatasetResponse = await fetch(`${API_URL}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: model.training_dataset_name })
                });

                if (!trainingDatasetResponse.ok) {
                    throw new Error(`Failed to create training dataset: ${model.training_dataset_name}`);
                }

                const trainingDatasetResult = await trainingDatasetResponse.json();
                updatedModels[i].training_dataset_pid = trainingDatasetResult.dataset_pid;

                // Create model linked to the standalone training dataset
                const modelResponse = await fetch(`${API_URL}/projects/${newProjectPid}/models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name: model.name,
                        dataset_pid: trainingDatasetResult.dataset_pid
                    })
                });

                if (!modelResponse.ok) {
                    throw new Error(`Failed to create model: ${model.name}`);
                }

                const modelResult = await modelResponse.json();
                updatedModels[i].model_pid = modelResult.model_pid;

                // Mark as created but files need to be uploaded
                updatedModels[i].model_uploaded = false;
                updatedModels[i].training_uploaded = false;
            }

            // Step 3: Create Test Datasets with file upload tracking
            const updatedTestDatasets = [...testDatasets];
            for (let i = 0; i < updatedTestDatasets.length; i++) {
                const dataset = updatedTestDatasets[i];

                const datasetResponse = await fetch(`${API_URL}/projects/${newProjectPid}/datasets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: dataset.name })
                });

                if (!datasetResponse.ok) {
                    throw new Error(`Failed to create test dataset: ${dataset.name}`);
                }

                const datasetResult = await datasetResponse.json();
                updatedTestDatasets[i].dataset_pid = datasetResult.dataset_pid;
                
                // Mark as created but file needs to be uploaded
                updatedTestDatasets[i].uploaded = false;
            }

            // Update state
            setModels(updatedModels);
            setTestDatasets(updatedTestDatasets);
            setIsProjectCreated(true);
            
            // Move to next step on success
            setActiveStep(2);

        } catch (error) {
            console.error('Project creation error:', error);
            setError(error instanceof Error ? error.message : 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            // Validate project details
            const nameValidation = validators.projectName(project.name);
            const frequencyValidation = validators.frequency(project.frequency || '');
            const windowSizeValidation = validators.windowSize(project.window_size || '');
            
            if (!nameValidation.isValid || !frequencyValidation.isValid || !windowSizeValidation.isValid) {
                setError('Please correct the validation errors');
                return;
            }
        } else if (activeStep === 1) {
            // Create all project resources
            setError(''); // Clear any previous errors
            await createProjectResources();
            // Don't proceed to next step here - let createProjectResources handle it
            return;
        }

        setActiveStep(prev => prev + 1);
        setError('');
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
        setError('');
    };

    const handleFinish = () => {
        alert(`Project "${project.name}" has been created successfully!\n\nProject ID: ${projectPid}\n\nYou can now navigate to "Start Evaluation" to begin using your project.`);
        
        // Reset the form
        setProject({ name: '', frequency: '', window_size: '' });
        setModels([]);
        setTestDatasets([]);
        setProjectPid('');
        setIsProjectCreated(false);
        setActiveStep(0);
    };

    const canProceed = () => {
        switch (activeStep) {
            case 0:
                return project.name.trim().length >= 3 &&
                       validators.frequency(project.frequency || '').isValid &&
                       validators.windowSize(project.window_size || '').isValid;
            case 1:
                return true; // Models and datasets are optional
            case 2:
                // Check if all files are uploaded (or if there are no items to upload)
                const allModelsUploaded = models.length === 0 || models.every(m => m.model_uploaded && m.training_uploaded);
                const allTestDatasetsUploaded = testDatasets.length === 0 || testDatasets.every(d => d.uploaded);
                return allModelsUploaded && allTestDatasetsUploaded;
            case 3:
                return isProjectCreated;
            default:
                return false;
        }
    };

    return (
        <>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {STEP_NAMES.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Step Content */}
            {activeStep === 0 && (
                <ProjectDetailsStep 
                    project={project} 
                    onChange={handleProjectChange}
                />
            )}
            
            {activeStep === 1 && (
                <ModelsDatasetStep 
                    models={models}
                    onModelsChange={setModels}
                    testDatasets={testDatasets}
                    onTestDatasetsChange={setTestDatasets}
                />
            )}
            
            {activeStep === 2 && (
                <FileUploadsStep 
                    models={models}
                    onModelsChange={setModels}
                    testDatasets={testDatasets}
                    onTestDatasetsChange={setTestDatasets}
                />
            )}

            {activeStep === 3 && (
                <SummaryStep 
                    project={project}
                    models={models}
                    testDatasets={testDatasets}
                    projectPid={projectPid}
                    isProjectCreated={isProjectCreated}
                />
            )}

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', flexDirection: 'row', pt: 4 }}>
                <Button
                    color="inherit"
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    sx={{ mr: 1 }}
                >
                    Back
                </Button>
                <Box sx={{ flex: '1 1 auto' }} />
                
                {activeStep === STEP_NAMES.length - 1 ? (
                    <Button 
                        variant="contained" 
                        onClick={handleFinish}
                        disabled={!canProceed()}
                    >
                        Finish
                    </Button>
                ) : (
                    <Button 
                        variant="contained" 
                        onClick={handleNext}
                        disabled={loading || !canProceed()}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Next'}
                    </Button>
                )}
            </Box>
        </>
    );
}

/** Main ProjectManagement Component */
export default function ProjectManagement() {
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h4" gutterBottom>
                Project Management
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Create new projects or add models and datasets to existing projects.
            </Typography>

            <Paper sx={{ p: 3 }}>
                <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
                    <Tab label="Create New Project" />
                    <Tab label="Add to Existing Project" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <NewProjectContent />
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <AddToExistingProject />
                </TabPanel>
            </Paper>
        </Box>
    );
} 