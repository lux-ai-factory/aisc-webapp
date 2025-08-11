import React, { ChangeEvent, useEffect, useState } from 'react';
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import { Box, Button, CircularProgress, Divider, IconButton, List, ListItem, styled, TextField, Typography } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUpload from '@mui/icons-material/CloudUpload';

interface ProjectResponse {
    project_pid: string;
    name: string;
    status: string;
    frequency: string;
    window_size: string;
    dataset: Array<{
        pid: string;
        name: string;
        data: string;
    }>;
    model: Array<{
        model_pid: string;
        name: string;
        data: string;
        project_id: number;
        dataset_id: number;
    }>;
}


interface Dataset {
    pid: string;
    name: string;
    data: string;
}



interface UploadDatasetProps {
    dataset: Dataset; // ✅ prop named "dataset"
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


const UploadDataset = ({ dataset, onUploadSuccess }: UploadDatasetProps) => {

    const uploaded = Boolean(dataset.data);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        // formData.append('pid', dataset.pid);

        try {
            // 🔹 Replace with your API URL
            const response = await fetch(`/api/v1/datasets/${dataset.pid}/data`, {
                method: 'PUT',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const responseData = await response.json();
            const fileName = responseData.file_name as string;

            onUploadSuccess(dataset.pid, fileName);

        } catch (error) {
            console.error('Upload error:', error);
        }
    };

    if (uploaded) {
        return (<CloudDoneIcon color="success" sx={{ mr: 2 }} />)
    }

    return (

        <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUpload />}
            sx={{ mr: 2 }}
        >
            Upload files
            <VisuallyHiddenInput
                type="file"
                onChange={handleFileChange}
            />
        </Button>

    );
};


const DatasetModelSettings = () => {

    const { projectUUID } = useProject();
    const [datasetList, setDatasetList] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [newDatasetName, setNewDatasetName] = useState<string>('');
    const [formError, setFormError] = useState<string>('');

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewDatasetName(value);

        if (value.length > 0 && value.length < 3) {
            setFormError('Name must be at least 3 characters');
        } else {
            setFormError('');
        }
    };


    const handleUploadSuccess = (pid: string, data: string) => {
        setDatasetList((prevList) =>
            prevList.map((ds) =>
                ds.pid === pid ? { ...ds, data: data } : ds
            )
        );
    };

    const handleAdd = async () => {
        if (newDatasetName.trim().length < 3) {
            setFormError('Dataset name is too short');
            return;
        }

        try {

            const response = await fetch(`${API_URL}/projects/${projectUUID}/datasets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDatasetName }),
            });

            if (!response.ok) {
                throw new Error('Failed to add dataset');
            }

            const createdDataset: Dataset = await response.json();

            // ✅ Add to local list
            setDatasetList((prev) => [...prev, createdDataset]);
            setNewDatasetName('');
            setFormError('');
        } catch (error) {
            setFormError((error as Error).message);
        }
    };

    useEffect(() => {
        async function fetchProject() {
            setLoading(true);
            try {
                const response = await fetch(
                    `${API_URL}/projects/${projectUUID}`
                );
                const data: ProjectResponse = await response.json();

                const datasets = data.dataset.map(ds => ({
                    pid: ds.pid,
                    name: ds.name,
                    data: ds.data
                }));
                setDatasetList(datasets);

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
                Evaluation datasets
            </Typography>
            <List sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1, p: 2 }}>
                {datasetList.map((dataset) => (
                    <ListItem key={dataset.pid} >
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>{dataset.name}</Typography>
                                <Typography variant="body2" color="text.secondary">{dataset.pid}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {/* <CloudDoneIcon color="success" sx={{ mr: 2 }} /> */}
                                <UploadDataset dataset={dataset} onUploadSuccess={handleUploadSuccess} />
                                <IconButton edge="end" aria-label="delete" color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        </Box>

                    </ListItem>
                ))}

                <Divider sx={{ my: 2 }} />

                <ListItem key={0} >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flexGrow: 1 }}>


                            <TextField
                                label="Dataset Name"
                                variant="outlined"
                                fullWidth
                                value={newDatasetName}
                                onChange={handleChange}
                                error={Boolean(formError)}
                                helperText={formError}
                            />

                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconButton
                                edge="end"
                                aria-label="add"
                                color="primary"
                                onClick={handleAdd}
                            >
                                <AddIcon />
                            </IconButton>
                        </Box>
                    </Box>

                </ListItem>
            </List>
        </Box>

    );
};

export default DatasetModelSettings;
