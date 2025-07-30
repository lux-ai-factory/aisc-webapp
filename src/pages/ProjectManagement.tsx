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

/** Step names for the project creation process */
const STEP_NAMES = [
    'Project Details',
    'Models & Datasets',
    'Upload Files',
    'Summary'
];

/** Step names for adding to existing project */
const ADD_TO_PROJECT_STEP_NAMES = [
    'Select Project',
    'Models & Datasets',
    'Upload Files',
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
    // Staged files (held in browser until ready to create)
    model_file?: File;
    training_file?: File;
}

/** Interface for a test dataset to be created */
interface TestDatasetInfo {
    id: string;
    name: string;
    dataset_pid?: string;
    uploaded?: boolean;
    test_file?: File;
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

/** Staged file upload component that stores files locally */
interface StagedUploadFieldProps {
    label: string;
    fileType: string;
    file?: File;
    onFileSelect: (file: File | undefined) => void;
    required?: boolean;
}

const StagedUploadField = React.memo(({ label, fileType, file, onFileSelect, required = false }: StagedUploadFieldProps) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        onFileSelect(selectedFile);
    };

    const handleRemove = () => {
        onFileSelect(undefined);
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragOver(false);

        const droppedFiles = event.dataTransfer.files;
        if (droppedFiles.length > 0) {
            const droppedFile = droppedFiles[0];

            // Validate file type
            const acceptedTypes = fileType.split(',').map(t => t.trim());
            const fileExtension = '.' + droppedFile.name.split('.').pop()?.toLowerCase();

            if (acceptedTypes.includes(fileExtension)) {
                onFileSelect(droppedFile);
            } else {
                alert(`File type not supported. Please select a file with extension: ${fileType}`);
            }
        }
    };

    return (
        <Box>
            <Typography variant="subtitle2" gutterBottom>
                {label} {required && <span style={{ color: 'red' }}>*</span>}
            </Typography>

            {/* Drag & Drop Zone */}
            <Box
                sx={{
                    border: isDragOver ? '2px dashed #1976d2' : '2px dashed #ccc',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    backgroundColor: isDragOver ? 'rgba(25, 118, 210, 0.04)' : file ? 'rgba(76, 175, 80, 0.04)' : 'transparent',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.04)',
                        borderColor: '#1976d2'
                    }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById(`file-input-${label.replace(/\s+/g, '-')}`)?.click()}
            >
                {file ? (
                    <Box>
                        <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold', color: 'success.main' }}>
                            📄 {file.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            File ready for upload
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove();
                                }}
                                startIcon={<DeleteIcon />}
                            >
                                Remove
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box>
                        <Typography variant="h4" sx={{ mb: 1 }}>
                            {isDragOver ? '📤' : '📁'}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {isDragOver ? 'Drop file here' : 'Drag & drop file here'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            or click to browse ({fileType})
                        </Typography>
                        <Button variant="outlined" size="small">
                            Browse Files
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Hidden File Input */}
            <input
                id={`file-input-${label.replace(/\s+/g, '-')}`}
                type="file"
                hidden
                accept={fileType}
                onChange={handleFileChange}
            />
        </Box>
    );
});

/** Staged upload card component */
interface StagedUploadCardProps {
    title: string;
    uploadItems: Array<{
        label: string;
        fileType: string;
        file?: File;
        onFileSelect: (file: File | undefined) => void;
        required?: boolean;
    }>;
    isComplete?: boolean;
}

const StagedUploadCard = React.memo(({ title, uploadItems, isComplete }: StagedUploadCardProps) => {
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {title}
                    {isComplete && (
                        <Chip label="Ready" color="success" size="small" sx={{ ml: 2 }} />
                    )}
                </Typography>

                <Stack spacing={3}>
                    {uploadItems.map((item, index) => (
                        <StagedUploadField
                            key={index}
                            label={item.label}
                            fileType={item.fileType}
                            file={item.file}
                            onFileSelect={item.onFileSelect}
                            required={item.required}
                        />
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
interface StagedFileUploadsStepProps {
    models: ModelInfo[];
    onModelsChange: (models: ModelInfo[]) => void;
    testDatasets: TestDatasetInfo[];
    onTestDatasetsChange: (datasets: TestDatasetInfo[]) => void;
}

function StagedFileUploadsStep({ models, onModelsChange, testDatasets, onTestDatasetsChange }: StagedFileUploadsStepProps) {
    const totalRequired = models.length * 2 + testDatasets.length;
    const totalSelected = models.filter(m => m.model_file && m.training_file).length * 2 +
                         testDatasets.filter(d => d.test_file).length;

    const handleModelFileSelect = (modelId: string, type: 'model' | 'training') => (file: File | undefined) => {
        onModelsChange(models.map(m =>
            m.id === modelId ? { ...m, [`${type}_file`]: file } : m
        ));
    };

    const handleDatasetFileSelect = (datasetId: string) => (file: File | undefined) => {
        onTestDatasetsChange(testDatasets.map(d =>
            d.id === datasetId ? { ...d, test_file: file } : d
        ));
    };

    return (
        <Stack spacing={3}>
            <Alert severity={totalSelected === totalRequired ? "success" : "info"}>
                {totalRequired === 0
                    ? "No files required. You can proceed to create the project."
                    : `File selection: ${totalSelected}/${totalRequired} files selected. All files must be selected before creating the project.`
                }
            </Alert>

            {models.map((model) => (
                <StagedUploadCard
                    key={model.id}
                    title={model.name}
                    isComplete={!!model.model_file && !!model.training_file}
                    uploadItems={[
                        {
                            label: "Model File (ONNX)",
                            fileType: ".onnx",
                            file: model.model_file,
                            onFileSelect: handleModelFileSelect(model.id, 'model'),
                            required: true
                        },
                        {
                            label: "Training Dataset (CSV/Parquet)",
                            fileType: ".csv,.parquet",
                            file: model.training_file,
                            onFileSelect: handleModelFileSelect(model.id, 'training'),
                            required: true
                        }
                    ]}
                />
            ))}

            {testDatasets.map((dataset) => (
                <StagedUploadCard
                    key={dataset.id}
                    title={dataset.name}
                    isComplete={!!dataset.test_file}
                    uploadItems={[
                        {
                            label: "Test Dataset (CSV/Parquet)",
                            fileType: ".csv,.parquet",
                            file: dataset.test_file,
                            onFileSelect: handleDatasetFileSelect(dataset.id),
                            required: true
                        }
                    ]}
                />
            ))}

            {totalRequired === 0 && (
                <Alert severity="info">
                    <Typography variant="body2">
                        No models or datasets configured. You can still create the project, or go back to add some models and datasets.
                    </Typography>
                </Alert>
            )}
        </Stack>
    );
}

/** Step 1: Project Selection Component */
interface ProjectSelectionStepProps {
    existingProjects: ExistingProject[];
    selectedProject: string;
    onProjectChange: (projectId: string) => void;
    loading?: boolean;
}

function ProjectSelectionStep({ existingProjects, selectedProject, onProjectChange, loading }: ProjectSelectionStepProps) {
    const handleProjectChange = (event: SelectChangeEvent) => {
        onProjectChange(event.target.value);
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Select Project
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Choose an existing project to add new models and test datasets to.
                </Typography>

                <FormControl fullWidth>
                    <InputLabel>Select Project</InputLabel>
                    <Select
                        value={selectedProject}
                        label="Select Project"
                        onChange={handleProjectChange}
                        disabled={loading}
                    >
                        {existingProjects.map((project) => (
                            <MenuItem key={project.project_pid} value={project.project_pid}>
                                {project.project_name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {existingProjects.length === 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        No existing projects found. Create a new project first.
                    </Alert>
                )}
            </CardContent>
        </Card>
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
                        All files were uploaded successfully, then your project and all resources were created in the database. Zero orphaned resources! You can now navigate to "Start Evaluation" to begin analyzing your models.
                    </Typography>
                </Alert>
            )}

            {!isProjectCreated && (
                <Alert severity="info">
                    <Typography variant="body1" fontWeight="bold">
                        Ready to Create Project
                    </Typography>
                    <Typography variant="body2">
                        All files have been selected and validated. Click "Create Project" to create the project with all resources and files in a single atomic operation.
                    </Typography>
                </Alert>
            )}
        </Stack>
    );
}

/** Step 4: Add to Project Summary Component */
interface AddToProjectSummaryStepProps {
    selectedProject: ExistingProject | null;
    models: ModelInfo[];
    testDatasets: TestDatasetInfo[];
    isResourcesAdded: boolean;
}

function AddToProjectSummaryStep({ selectedProject, models, testDatasets, isResourcesAdded }: AddToProjectSummaryStepProps) {
    return (
        <Stack spacing={3}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Summary - Add to Project
                    </Typography>

                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Target Project</Typography>
                            <Typography>
                                {selectedProject ? selectedProject.project_name : 'No project selected'}
                            </Typography>
                            {selectedProject && (
                                <Typography variant="body2" color="text.secondary">
                                    Project ID: {selectedProject.project_pid}
                                </Typography>
                            )}
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Models to Add ({models.length})</Typography>
                            {models.length === 0 ? (
                                <Typography color="text.secondary">No models configured</Typography>
                            ) : (
                                models.map((model) => (
                                    <Box key={model.id} sx={{ ml: 2 }}>
                                        <Typography>• {model.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Training Dataset: {model.training_dataset_name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                            <Chip
                                                label={model.model_file ? "Model File Selected" : "Model File Pending"}
                                                color={model.model_file ? "success" : "default"}
                                                size="small"
                                            />
                                            <Chip
                                                label={model.training_file ? "Training File Selected" : "Training File Pending"}
                                                color={model.training_file ? "success" : "default"}
                                                size="small"
                                            />
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Test Datasets to Add ({testDatasets.length})</Typography>
                            {testDatasets.length === 0 ? (
                                <Typography color="text.secondary">No test datasets configured</Typography>
                            ) : (
                                testDatasets.map((dataset) => (
                                    <Box key={dataset.id} sx={{ ml: 2 }}>
                                        <Typography>• {dataset.name}</Typography>
                                        <Chip
                                            label={dataset.test_file ? "File Selected" : "File Pending"}
                                            color={dataset.test_file ? "success" : "default"}
                                            size="small"
                                            sx={{ mt: 1 }}
                                        />
                                    </Box>
                                ))
                            )}
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {isResourcesAdded && (
                <Alert severity="success">
                    <Typography variant="body1" fontWeight="bold">
                        Resources Added Successfully!
                    </Typography>
                    <Typography variant="body2">
                        All files were uploaded successfully, and the new models and datasets were added to the project. You can now navigate to "Start Evaluation" to begin analyzing your models.
                    </Typography>
                </Alert>
            )}

            {!isResourcesAdded && (
                <Alert severity="info">
                    <Typography variant="body1" fontWeight="bold">
                        Ready to Add Resources
                    </Typography>
                    <Typography variant="body2">
                        {models.length === 0 && testDatasets.length === 0
                            ? "No resources configured to add. Go back to configure models and datasets."
                            : "All files have been selected and validated. Click 'Add to Project' to add the resources with all files in a single atomic operation."
                        }
                    </Typography>
                </Alert>
            )}
        </Stack>
    );
}

/** Component for adding models and datasets to existing projects */
function AddToExistingProject() {
    const [activeStep, setActiveStep] = useState(0);
    const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [testDatasets, setTestDatasets] = useState<TestDatasetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [isResourcesAdded, setIsResourcesAdded] = useState(false);

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

    const handleProjectChange = (projectId: string) => {
        setSelectedProject(projectId);
        setError('');
    };

    const getSelectedProjectData = (): ExistingProject | null => {
        return existingProjects.find(p => p.project_pid === selectedProject) || null;
    };

    const addResourcesToProjectStaged = async (): Promise<boolean> => {
        if (!selectedProject) {
            setError('Please select a project');
            return false;
        }

        // Validate that all models and test datasets have files
        const modelsWithFiles = models.filter(m => m.model_file && m.training_file);
        const testDatasetsWithFiles = testDatasets.filter(d => d.test_file);

        if (modelsWithFiles.length !== models.length) {
            setError('All models must have both model file and training dataset file selected');
            return false;
        }

        if (testDatasetsWithFiles.length !== testDatasets.length) {
            setError('All test datasets must have files selected');
            return false;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            const modelNames: string[] = [];
            const trainingNames: string[] = [];

            models.forEach((model) => {
                if (model.model_file && model.training_file) {
                    formData.append('model_files', model.model_file);
                    formData.append('training_files', model.training_file);
                    modelNames.push(model.name);
                    trainingNames.push(model.training_dataset_name);
                }
            });

            const testNames: string[] = [];
            testDatasets.forEach((dataset) => {
                if (dataset.test_file) {
                    formData.append('test_files', dataset.test_file);
                    testNames.push(dataset.name);
                }
            });

            modelNames.forEach(name => formData.append('model_names', name));
            trainingNames.forEach(name => formData.append('training_names', name));
            testNames.forEach(name => formData.append('test_names', name));

            // Add resources to project with all files atomically
            const response = await fetch(`${API_URL}/projects/${selectedProject}/resources/staged`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to add resources to project');
            }

            const result = await response.json();
            setIsResourcesAdded(true);
            console.log('Resources added successfully:', result);
            return true;

        } catch (error) {
            console.error('Error adding resources to project:', error);
            setError(error instanceof Error ? error.message : 'Failed to add resources to project');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            // Validate project selection
            if (!selectedProject) {
                setError('Please select a project');
                return;
            }
        } else if (activeStep === 2 && !isResourcesAdded) {
            // Add resources when clicking "Add to Project"
            const success = await addResourcesToProjectStaged();

            if (!success) return;

            setActiveStep(3);
            return;
        }

        // Regular step increment for other cases
        setActiveStep(prev => prev + 1);
        setError('');
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
        setError('');
    };

    const handleFinish = () => {
        const projectName = getSelectedProjectData()?.project_name || selectedProject;
        alert(`Resources successfully added to project "${projectName}"!\n\nYou can now navigate to "Start Evaluation" to begin analyzing your models.`);

        // Reset the form
        setSelectedProject('');
        setModels([]);
        setTestDatasets([]);
        setIsResourcesAdded(false);
        setActiveStep(0);
    };

    const canProceed = () => {
        switch (activeStep) {
            case 0:
                return selectedProject !== '' && existingProjects.length > 0;
            case 1:
                return true; // Models and datasets are optional
            case 2:
                // Check if all required files are selected (or if there are no items)
                const allModelFilesSelected = models.length === 0 || models.every(m => m.model_file && m.training_file);
                const allTestDatasetFilesSelected = testDatasets.length === 0 || testDatasets.every(d => d.test_file);
                return allModelFilesSelected && allTestDatasetFilesSelected;
            case 3:
                return isResourcesAdded;
            default:
                return false;
        }
    };

    return (
        <>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {ADD_TO_PROJECT_STEP_NAMES.map((label) => (
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
                <ProjectSelectionStep
                    existingProjects={existingProjects}
                    selectedProject={selectedProject}
                    onProjectChange={handleProjectChange}
                    loading={loading}
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
                <StagedFileUploadsStep
                    models={models}
                    onModelsChange={setModels}
                    testDatasets={testDatasets}
                    onTestDatasetsChange={setTestDatasets}
                />
            )}

            {activeStep === 3 && (
                <AddToProjectSummaryStep
                    selectedProject={getSelectedProjectData()}
                    models={models}
                    testDatasets={testDatasets}
                    isResourcesAdded={isResourcesAdded}
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

                {activeStep === ADD_TO_PROJECT_STEP_NAMES.length - 1 ? (
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
                        {loading ? <CircularProgress size={24} /> :
                         activeStep === 2 && !isResourcesAdded ? 'Add to Project' : 'Next'}
                        </Button>
                )}
            </Box>
        </>
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

    const createStagedProject = async (): Promise<boolean> => {
        setLoading(true);
        setError('');

        try {
            // Prepare form data with all files
            const formData = new FormData();
            formData.append('project_name', project.name);
            if (project.frequency) formData.append('frequency', project.frequency);
            if (project.window_size) formData.append('window_size', project.window_size);

            // Add model files and names
            const modelNames: string[] = [];
            const trainingNames: string[] = [];

            models.forEach((model) => {
                if (model.model_file && model.training_file) {
                    formData.append('model_files', model.model_file);
                    formData.append('training_files', model.training_file);
                    modelNames.push(model.name);
                    trainingNames.push(model.training_dataset_name);
                }
            });

            const testNames: string[] = [];
            testDatasets.forEach((dataset) => {
                if (dataset.test_file) {
                    formData.append('test_files', dataset.test_file);
                    testNames.push(dataset.name);
                }
            });

            modelNames.forEach(name => formData.append('model_names', name));
            trainingNames.forEach(name => formData.append('training_names', name));
            testNames.forEach(name => formData.append('test_names', name));

            // Create project with all files atomically
            const response = await fetch(`${API_URL}/projects/staged`, {
                    method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create project');
            }

            const projectResult = await response.json();
            setProjectPid(projectResult.project_pid);
            setIsProjectCreated(true);

            console.log('Project created successfully with PID:', projectResult.project_pid);
            return true;

        } catch (error) {
            console.error('Project creation error:', error);
            setError(error instanceof Error ? error.message : 'Failed to create project');
            return false;
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
        } else if (activeStep === 2 && !isProjectCreated) {
            // Create project with all files when clicking "Create Project"
            const success = await createStagedProject();

            if (!success) return;

            setActiveStep(3);
            return;
        }

        // Regular step increment for other cases
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
                // Check if all required files are selected (or if there are no items)
                const allModelFilesSelected = models.length === 0 || models.every(m => m.model_file && m.training_file);
                const allTestDatasetFilesSelected = testDatasets.length === 0 || testDatasets.every(d => d.test_file);
                return allModelFilesSelected && allTestDatasetFilesSelected;
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
                <StagedFileUploadsStep
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
                        {loading ? <CircularProgress size={24} /> :
                         activeStep === 2 && !isProjectCreated ? 'Create Project' : 'Next'}
                    </Button>
                )}
            </Box>
        </>
    );
}

/** Main ProjectManagement Component */
export default function ProjectManagement() {
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
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
