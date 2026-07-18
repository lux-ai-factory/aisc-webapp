import React, {ChangeEvent, useEffect, useState} from 'react';
import {API_VERSION_PREFIX} from '../config';
import {useProject} from '../context/ProjectContext';
import {
    Box,
    Button,
    CircularProgress,
    Collapse,
    Divider,
    IconButton,
    List,
    ListItem,
    styled,
    TextField,
    Typography
} from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {patchDatasetLabelMappings} from "../api/api.tsx";

interface ProjectResponse {
    pid: string;
    name: string;
    status: string;
    datasets: Array<{
        pid: string;
        name: string;
        data: string;
        label_mappings: object;
    }>;
    models: Array<{
        pid: string;
        name: string;
        data: string;
        dataset: Array<{
            pid: string;
            name: string;
            data: string;
            label_mappings: object;
        }>
    }>;
}


interface Dataset {
    pid: string;
    name: string;
    data: string;
    label_mappings: object;
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


const UploadDataset = ({dataset, onUploadSuccess}: UploadDatasetProps) => {
    const uploaded = Boolean(dataset.data);
    const [progress, setProgress] = useState<number>(0);
    const [uploading, setUploading] = useState<boolean>(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;


        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${API_URL}/datasets/${dataset.pid}/data`, true);

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
                onUploadSuccess(dataset.pid, fileName);
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
        return <CloudDoneIcon color="success" sx={{mr: 2}}/>;
    }

    return (
        <Box sx={{position: "relative", display: "inline-flex", mr: 2}}>
            <Button
                component="label"
                role={undefined}
                variant="contained"
                disabled={uploading}
                startIcon={<CloudUpload/>}
            >
                {uploading ? "Uploading..." : "Upload files"}
                <VisuallyHiddenInput
                    type="file"
                    accept="*/*"
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


const DatasetSettings = () => {

    const {projectUUID} = useProject();
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

    const [expandedMappings, setExpandedMappings] = useState<string | null>(null);
    const [editMappings, setEditMappings] = useState<Record<string, string>>({});

    const handleUploadSuccess = (pid: string, data: string) => {
        setDatasetList((prevList) =>
            prevList.map((ds) =>
                ds.pid === pid ? {...ds, data: data} : ds
            )
        );
    };

    const handleToggleMappings = (pid: string) => {
        if (expandedMappings === pid) {
            setExpandedMappings(null);
        } else {
            const dataset = datasetList.find(ds => ds.pid === pid);
            setEditMappings(prev => ({...prev, [pid]: JSON.stringify(dataset?.label_mappings || {}, null, 2)}));
            setExpandedMappings(pid);
        }
    };

    const handleMappingsChange = (pid: string, value: string) => {
        setEditMappings(prev => ({...prev, [pid]: value}));
    };

    const handleSaveMappings = async (pid: string) => {
        const raw = editMappings[pid];
        try {
            const parsed = JSON.parse(raw);
            await patchDatasetLabelMappings(pid, parsed);
            setDatasetList((prevList) =>
                prevList.map((ds) =>
                    ds.pid === pid ? {...ds, label_mappings: parsed} : ds
                )
            );
            setExpandedMappings(null);
        } catch {
            alert("Invalid JSON. Please fix and try again.");
        }
    };

    const handleAdd = async () => {
        if (newDatasetName.trim().length < 3) {
            setFormError('Dataset name is too short');
            return;
        }

        try {

            const response = await fetch(`${API_URL}/projects/${projectUUID}/datasets`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: newDatasetName}),
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

                const datasets = data.datasets.map(ds => ({
                    pid: ds.pid,
                    name: ds.name,
                    data: ds.data,
                    label_mappings: ds.label_mappings || {},
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
        return <CircularProgress/>;
    }
    return (

        <Box>
            <Typography component="h4" variant="h6" gutterBottom sx={{mt: 4}}>
                Datasets
            </Typography>
            <List sx={{border: 1, borderColor: 'divider', borderRadius: 1, mb: 1, p: 2}}>
                {datasetList.map((dataset) => (
                    <ListItem key={dataset.pid} sx={{flexDirection: 'column', alignItems: 'stretch'}}>
                        <Box sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
                            <Box sx={{flexGrow: 1}}>
                                <Typography variant="subtitle1" sx={{fontWeight: 'medium'}}>{dataset.name}</Typography>
                                <Typography variant="body2" color="text.secondary">{dataset.pid}</Typography>
                            </Box>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <IconButton onClick={() => handleToggleMappings(dataset.pid)} size="small" sx={{mr: 1}}>
                                    {expandedMappings === dataset.pid ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
                                </IconButton>
                                <UploadDataset dataset={dataset} onUploadSuccess={handleUploadSuccess}/>
                                <IconButton edge="end" aria-label="delete" color="error">
                                    <DeleteIcon/>
                                </IconButton>
                            </Box>
                        </Box>
                        <Collapse in={expandedMappings === dataset.pid}>
                            <Box sx={{p: 2, mt: 1, bgcolor: 'grey.50', borderRadius: 1}}>
                                <Typography variant="body2" sx={{mb: 1, fontWeight: 500}}>
                                    Label Mappings
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{mb: 1, display: 'block'}}>
                                    Map categorical values to display labels.
                                </Typography>
                                <TextField
                                    multiline
                                    fullWidth
                                    minRows={4}
                                    maxRows={12}
                                    value={editMappings[dataset.pid] || ''}
                                    onChange={(e) => handleMappingsChange(dataset.pid, e.target.value)}
                                    sx={{mb: 1}}
                                    placeholder='{"home_ownership": {"0": "Rent", "1": "Own", "2": "Mortgage"}}'
                                />
                                <Button variant="contained" size="small" onClick={() => handleSaveMappings(dataset.pid)}>
                                    Save Mappings
                                </Button>
                            </Box>
                        </Collapse>
                    </ListItem>
                ))}

                <Divider sx={{my: 2}}/>

                <ListItem key={0}>
                    <Box sx={{display: 'flex', alignItems: 'center', width: '100%'}}>
                        <Box sx={{flexGrow: 1}}>


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
                        <Box sx={{display: 'flex', alignItems: 'center'}}>
                            <IconButton
                                edge="end"
                                aria-label="add"
                                color="primary"
                                onClick={handleAdd}
                            >
                                <AddIcon/>
                            </IconButton>
                        </Box>
                    </Box>

                </ListItem>
            </List>
        </Box>

    );
};

export default DatasetSettings;
