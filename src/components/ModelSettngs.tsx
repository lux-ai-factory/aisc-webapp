import React, { ChangeEvent, useEffect, useState } from 'react';
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    List,
    ListItem,
    styled,
    TextField,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUpload from '@mui/icons-material/CloudUpload';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface Dataset {
    pid: string;
    name: string;
    data: string;
}

interface Model {
    pid: string;
    name: string;
    data: string;
    dataset: Dataset;
}

interface ProjectResponse {
    pid: string;
    name: string;
    status: string;
    frequency: string;
    window_size: string;
    datasets: Dataset[];
    models: Model[];
}

interface UploadModelProps {
    model: Model;
    onUploadSuccess: (pid: string, data: string) => void;
}

const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});

const UploadModel = ({ model, onUploadSuccess }: UploadModelProps) => {
    const uploaded = Boolean(model.data);
    const [progress, setProgress] = useState<number>(0);
    const [uploading, setUploading] = useState<boolean>(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.onnx')) {
            alert('Only .onnx files are allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${API_URL}/models/${model.pid}/data`, true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                setProgress(percent);
            }
        };

        xhr.onloadstart = () => {
            setUploading(true);
            setProgress(0);
        };

        xhr.onloadend = () => {
            setUploading(false);
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const responseData = JSON.parse(xhr.responseText);
                const fileName = responseData.file_name as string;
                onUploadSuccess(model.pid, fileName);
                setProgress(100);
            } else {
                console.error("Upload failed:", xhr.statusText);
            }
        };

        xhr.onerror = () => {
            console.error("Upload error");
            setUploading(false);
        };

        xhr.send(formData);
    };

    if (uploaded) {
        return <CloudDoneIcon color="success" sx={{ mr: 2 }} />;
    }

    return (
        <Box sx={{ position: "relative", display: "inline-flex", mr: 2 }}>
            <Button
                component="label"
                role={undefined}
                variant="contained"
                disabled={uploading}
                startIcon={<CloudUpload />}
            >
                {uploading ? "Uploading..." : "Upload ONNX"}
                <VisuallyHiddenInput
                    type="file"
                    onChange={handleFileChange}
                />
            </Button>

            {uploading && (
                <CircularProgress
                    variant="determinate"
                    value={progress}
                    size={36}
                    sx={{
                        color: "primary.main",
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        marginTop: "-18px",
                        marginLeft: "-18px",
                    }}
                />
            )}
        </Box>
    );
};

const ModelSettings = () => {
    const { projectUUID } = useProject();
    const [datasetList, setDatasetList] = useState<Dataset[]>([]);
    const [modelList, setModelList] = useState<Model[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [newModelName, setNewModelName] = useState<string>('');
    const [selectedDataset, setSelectedDataset] = useState<string>('');
    const [formError, setFormError] = useState<string>('');

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewModelName(value);

        if (value.length > 0 && value.length < 3) {
            setFormError('Name must be at least 3 characters');
        } else {
            setFormError('');
        }
    };

    const handleUploadSuccess = (pid: string, data: string) => {
        setModelList((prevList) =>
            prevList.map((m) =>
                m.pid === pid ? { ...m, data } : m
            )
        );
    };

    const handleAdd = async () => {
        if (newModelName.trim().length < 3) {
            setFormError('Model name is too short');
            return;
        }
        if (!selectedDataset) {
            setFormError('Please select a dataset');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/projects/${projectUUID}/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newModelName,
                    dataset_pid: selectedDataset
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to add model');
            }

            const createdModel: Model = await response.json();

            setModelList((prev) => [...prev, createdModel]);
            setNewModelName('');
            setSelectedDataset('');
            setFormError('');
        } catch (error) {
            setFormError((error as Error).message);
        }
    };

    useEffect(() => {
        async function fetchProject() {
            setLoading(true);
            try {
                const response = await fetch(`${API_URL}/projects/${projectUUID}`);
                const data: ProjectResponse = await response.json();

                console.log(data)

                setDatasetList(data.datasets);
                setModelList(data.models);
            } catch (error) {
                console.error("Error fetching project:", error);
            } finally {
                setLoading(false);
            }
        }

        if (projectUUID) {
            fetchProject();
        }
    }, [projectUUID]);

    if (loading) {
        return <CircularProgress />;
    }

    return (
        <Box>
            <Typography component="h4" variant="h6" gutterBottom sx={{ mt: 4 }}>
                Models
            </Typography>
            <List sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1, p: 2 }}>
                {modelList.map((model) => (
                    <ListItem key={model.pid} >
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>{model.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {/* Dataset: {datasetList.find(ds => ds.pid === model.pid)?.name || 'Unknown'} */}
                                    Dataset: {model.dataset.name}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <UploadModel model={model} onUploadSuccess={handleUploadSuccess} />
                                <IconButton edge="end" aria-label="delete" color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    </ListItem>
                ))}

                <Divider sx={{ my: 2 }} />

                <ListItem key={0} >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
                        <TextField
                            label="Model Name"
                            variant="outlined"
                            fullWidth
                            value={newModelName}
                            onChange={handleChange}
                            error={Boolean(formError)}
                            helperText={formError}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Dataset</InputLabel>
                            <Select
                                value={selectedDataset}
                                onChange={(e) => setSelectedDataset(e.target.value)}
                                label="Dataset"
                            >
                                {datasetList.map((ds) => (
                                    <MenuItem key={ds.pid} value={ds.pid}>
                                        {ds.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <IconButton
                            edge="end"
                            aria-label="add"
                            color="primary"
                            onClick={handleAdd}
                        >
                            <AddIcon />
                        </IconButton>
                    </Box>
                </ListItem>
            </List>
        </Box>
    );
};

export default ModelSettings;
