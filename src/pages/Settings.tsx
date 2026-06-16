import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useRef, useState } from "react";
import { API_VERSION_PREFIX } from "../config";
import { useProject } from "../context/ProjectContext";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const validators = {
    projectName: (name: string) => {
        if (name.trim().length < 3) {
            return {
                isValid: false,
                error: "Project name must be at least 3 characters"
            };
        }
        return { isValid: true };
    }
};

interface FileItem {
    pid: string;
    name: string;
    data: string;
    size?: number;
    type: 'dataset' | 'model';
    uploadProgress?: number;
}

interface ProjectDetails {
    pid: string;
    name: string;
    datasets: FileItem[];
    models: FileItem[];
}

function ProjectDetailsSection() {
    const [project, setProject] = useState<ProjectDetails | null>(null);
    const [fetchedProject, setFetchedProject] = useState<ProjectDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [edited, setEdited] = useState(false);
    const { projectUUID } = useProject();
    const [errors, setErrors] = useState<{ name?: string }>({});

    useEffect(() => {
        async function fetchProject() {
            try {
                const response = await fetch(`${API_URL}/projects/${projectUUID}`);
                const data = await response.json();
                setProject({ pid: data.pid, name: data.name ?? '', datasets: [], models: [] });
                setFetchedProject({ pid: data.pid, name: data.name ?? '', datasets: [], models: [] });
            } catch (error) {
                console.error("Error fetching project:", error);
            } finally {
                setLoading(false);
            }
        }
        if (projectUUID) fetchProject();
    }, [projectUUID]);

    useEffect(() => {
        if (fetchedProject && project) {
            setEdited(fetchedProject.name.trim() !== project.name.trim());
        }
    }, [fetchedProject, project]);

    if (loading || !project) return <CircularProgress />;

    const handleSave = async () => {
        if (!project || !projectUUID) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/projects/${projectUUID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: project.name }),
            });
            const updated = await response.json();
            setProject(prev => prev ? { ...prev, name: updated.name ?? '' } : prev);
            setFetchedProject(prev => prev ? { ...prev, name: updated.name ?? '' } : prev);
            setEdited(false);
        } catch (error) {
            console.error('Error updating project:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Tooltip title={project.pid} placement="right" arrow>
                <Typography component="h3" variant="h5" gutterBottom sx={{ mt: 4, cursor: 'help', display: 'inline-block' }}>
                    Project Details
                </Typography>
            </Tooltip>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Configure your project's basic information and settings.
            </Typography>
            <Card
                variant="outlined"
                sx={{
                    border: '2px solid',
                    borderColor: 'rgba(28, 92, 198, 0.28)',
                    background: 'linear-gradient(165deg, rgba(247, 251, 255, 0.98), rgba(232, 241, 255, 0.96))',
                    borderRadius: 2,
                    transition: 'all 0.22s ease',
                    '&:hover': {
                        boxShadow: '0 14px 28px rgba(20, 77, 172, 0.22)',
                        borderColor: 'rgba(28, 92, 198, 0.62)',
                        background: 'linear-gradient(160deg, rgba(227, 241, 255, 0.98), rgba(190, 223, 255, 0.94))',
                    },
                }}
            >
                <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <TextField
                            label="Project Name"
                            value={project.name}
                            onChange={(e) => {
                                const value = e.target.value;
                                setProject(prev => prev ? { ...prev, name: value } : prev);
                                const validation = validators.projectName(value);
                                setErrors(prev => ({ ...prev, name: validation.error }));
                            }}
                            fullWidth
                            required
                            error={!!errors.name}
                            helperText={errors.name || ""}
                            sx={{ flex: 1 }}
                        />
                        <Button
                            variant="contained"
                            disabled={!edited || !!errors.name}
                            onClick={handleSave}
                            sx={{
                                mt: 0.5,
                                borderRadius: "10px",
                                fontSize: "0.95rem",
                                fontWeight: 600,
                                textTransform: "none",
                                whiteSpace: 'nowrap',
                                background: "linear-gradient(135deg, #57a8ff 0%, #2f7df6 48%, #0d47b8 100%)",
                                boxShadow: "0 8px 18px rgba(18, 84, 188, 0.32)",
                                "&:hover": {
                                    background: "linear-gradient(135deg, #6ab4ff 0%, #3b88ff 45%, #1554c7 100%)",
                                    boxShadow: "0 10px 20px rgba(14, 75, 173, 0.4)"
                                },
                                "&:disabled": {
                                    background: "#9bbcff",
                                    boxShadow: "none"
                                }
                            }}
                        >
                            Save Changes
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}

function FileRow({ file, type, onUploadSuccess }: {
    file: FileItem;
    type: 'dataset' | 'model';
    onUploadSuccess: (pid: string, data: string, size: number) => void;
}) {
    const uploaded = Boolean(file.data);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [fileSize, setFileSize] = useState<number | undefined>(file.size);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const f = event.target.files?.[0];
        if (!f) return;
        if (type === 'model' && !f.name.toLowerCase().endsWith('.onnx')) {
            alert('Only .onnx files are allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('file', f);
        // Re-upload: overwrites the stored file reference but does NOT delete the old blob from storage
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${API_URL}/${type}s/${file.pid}/data`, true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onloadstart = () => { setUploading(true); setProgress(0); };
        xhr.onloadend = () => setUploading(false);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const responseData = JSON.parse(xhr.responseText);
                const size = responseData.file_size ?? f.size;
                onUploadSuccess(file.pid, responseData.file_name as string, size);
                setFileSize(size);
                setProgress(100);
            }
        };
        xhr.onerror = () => setUploading(false);
        xhr.send(formData);
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(`${API_URL}/${type}s/${file.pid}/data`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = file.name;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            console.error('Download failed');
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0.5 }}>
            <Tooltip title={file.pid} placement="top">
                <Typography variant="subtitle1" fontWeight={600} noWrap>
                    {file.name}
                </Typography>
            </Tooltip>
            <Stack direction="row" spacing={0.5} sx={{ alignSelf: 'flex-start' }}>
                <Chip
                    label={type === 'dataset' ? 'Dataset' : 'Model'}
                    size="small"
                    variant="filled"
                    sx={{ height: 22, fontWeight: 600, bgcolor: type === 'dataset' ? '#bbdefb' : '#f3e5f5', color: type === 'dataset' ? '#0d47a1' : '#7b1fa2' }}
                />
                <Chip
                    label={uploaded ? 'Uploaded' : 'Not uploaded'}
                    size="small"
                    color={uploaded ? 'success' : 'default'}
                    variant={uploaded ? 'filled' : 'outlined'}
                    sx={{ height: 22, fontWeight: 600 }}
                />
                {uploaded && (file.size ?? fileSize) != null && (
                    <Chip
                        label={formatSize(file.size ?? fileSize!)}
                        size="small"
                        variant="filled"
                        sx={{ height: 22, fontWeight: 500, bgcolor: '#fff9c4' }}
                    />
                )}
            </Stack>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', pt: 1 }}>
                {uploading || file.uploadProgress !== undefined ? (
                    <CircularProgress variant="determinate" value={file.uploadProgress ?? progress} size={28} />
                ) : (
                    <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        startIcon={<CloudUploadIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                    >
                        {uploaded ? 'Re-upload' : 'Upload'}
                        <input type="file" hidden accept={type === 'model' ? '.onnx' : '*/*'} onChange={handleUpload} />
                    </Button>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {uploaded && (
                        <Tooltip title="Download file" placement="top">
                            <IconButton size="small" color="primary" onClick={handleDownload}>
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton size="small" color="error">
                        <DeleteIcon />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
}

function AddFileDialog({ open, onClose, onAdd }: {
    open: boolean;
    onClose: () => void;
    onAdd: (name: string, type: 'dataset' | 'model', file?: File) => Promise<void>;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'dataset' | 'model'>('dataset');
    const [file, setFile] = useState<File | undefined>();
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAdd = async () => {
        if (name.trim().length < 3) {
            setError('Name must be at least 3 characters');
            return;
        }
        setAdding(true);
        try {
            await onAdd(name.trim(), type, file);
            setName('');
            setType('dataset');
            setFile(undefined);
            setError('');
            onClose();
        } catch {
            setError('Failed to add file');
        } finally {
            setAdding(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: "#0048ff",
                        backgroundImage: "linear-gradient(135deg, #001075, #0020b5)",
                        borderRadius: "16px",
                        boxShadow: "none",
                    }
                }
            }}
        >
            <DialogTitle sx={{ color: "white", fontWeight: 700 }}>
                Add File
            </DialogTitle>
            <DialogContent sx={{
                paddingBottom: 4,
                backgroundColor: "white",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px",
                mx: 1,
                mb: 1,
                mt: 1,
            }}>
                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    <TextField
                        label="File name"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        fullWidth
                        required
                        autoFocus
                        error={!!error}
                        helperText={error || "A descriptive name for your file"}
                        sx={{ flex: 3 }}
                    />
                    <TextField
                        select
                        label="File Type"
                        value={type}
                        onChange={(e) => setType(e.target.value as 'dataset' | 'model')}
                        sx={{ flex: 1 }}
                        SelectProps={{ native: true }}
                    >
                        <option value="dataset">Dataset</option>
                        <option value="model">Model</option>
                    </TextField>
                </Stack>

                <Box sx={{ mt: 2 }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        hidden
                        accept={type === 'model' ? '.onnx' : '*/*'}
                        onChange={(e) => setFile(e.target.files?.[0] || undefined)}
                    />
                    <Button
                        variant="outlined"
                        component="span"
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                    >
                        {file ? file.name : 'Choose file (optional)'}
                    </Button>
                    {file && (
                        <Button
                            size="small"
                            sx={{ ml: 1, textTransform: 'none', color: 'error.main' }}
                            onClick={() => { setFile(undefined); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        >
                            Remove
                        </Button>
                    )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button disabled={adding} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={adding}
                        onClick={handleAdd}
                    >
                        {adding ? 'Adding...' : 'Add'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}

export default function SettingsPage() {
    const { projectUUID } = useProject();
    const [datasets, setDatasets] = useState<FileItem[]>([]);
    const [models, setModels] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const fetchFiles = async () => {
        if (!projectUUID) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/projects/${projectUUID}`);
            const data = await response.json();
            setDatasets((data.datasets || []).map((ds: any) => ({ pid: ds.pid, name: ds.name, data: ds.data, size: ds.file_size, type: 'dataset' as const })));
            setModels((data.models || []).map((m: any) => ({ pid: m.pid, name: m.name, data: m.data, size: m.file_size, type: 'model' as const })));
        } catch (error) {
            console.error("Error fetching project:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, [projectUUID]);

    const handleUploadSuccess = (pid: string, data: string, size: number, type: 'dataset' | 'model') => {
        const updater = (items: FileItem[]) => items.map(item => item.pid === pid ? { ...item, data, size } : item);
        if (type === 'dataset') setDatasets(updater);
        else setModels(updater);
    };

    const handleAdd = async (name: string, type: 'dataset' | 'model', file?: File) => {
        if (!projectUUID) throw new Error('No project');
        const response = await fetch(`${API_URL}/projects/${projectUUID}/${type}s`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (!response.ok) throw new Error('Failed to add');
        const created = await response.json();
        const item: FileItem = { pid: created.pid, name: created.name, data: '', type };
        if (type === 'dataset') setDatasets(prev => [...prev, item]);
        else setModels(prev => [...prev, item]);

        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", `${API_URL}/${type}s/${created.pid}/data`, true);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const updater = (items: FileItem[]) => items.map(i => i.pid === created.pid ? { ...i, uploadProgress: Math.round((e.loaded / e.total) * 100) } : i);
                    if (type === 'dataset') setDatasets(updater);
                    else setModels(updater);
                }
            };
            xhr.onloadend = () => {
                const updater = (items: FileItem[]) => items.map(i => i.pid === created.pid ? { ...i, uploadProgress: undefined } : i);
                if (type === 'dataset') setDatasets(updater);
                else setModels(updater);
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const responseData = JSON.parse(xhr.responseText);
                    const size = responseData.file_size ?? file.size;
                    const updater = (items: FileItem[]) => items.map(i => i.pid === created.pid ? { ...i, data: responseData.file_name as string, size } : i);
                    if (type === 'dataset') setDatasets(updater);
                    else setModels(updater);
                }
            };
            xhr.send(formData);
        }
    };

    const renderSection = (title: string, items: FileItem[], type: 'dataset' | 'model') => (
        <Box>
            {loading ? (
                <CircularProgress />
            ) : items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No {title.toLowerCase()} yet.
                </Typography>
            ) : (
                <Grid container spacing={2}>
                    {items.map(item => (
                        <Grid key={item.pid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                            <Card
                                variant="outlined"
                                sx={{
                                    minWidth: 250,
                                    border: '2px solid',
                                    borderColor: 'rgba(28, 92, 198, 0.28)',
                                    background: 'linear-gradient(165deg, rgba(247, 251, 255, 0.98), rgba(232, 241, 255, 0.96))',
                                    transition: 'all 0.22s ease',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    '&:hover': {
                                        boxShadow: '0 14px 28px rgba(20, 77, 172, 0.22)',
                                        borderColor: 'rgba(28, 92, 198, 0.62)',
                                        background: 'linear-gradient(160deg, rgba(227, 241, 255, 0.98), rgba(190, 223, 255, 0.94))',
                                    },
                                }}
                            >
                                <CardContent sx={{ height: '100%' }}>
                                    <FileRow
                                        file={item}
                                        type={type}
                                        onUploadSuccess={(pid, data, size) => handleUploadSuccess(pid, data, size, type)}
                                    />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );

    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Project settings
            </Typography>

            <ProjectDetailsSection />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 6, mb: 1 }}>
                <Box>
                    <Typography component="h3" variant="h5" gutterBottom sx={{ mb: 0 }}>
                        Datasets & Models
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                        Set up the datasets and models for your project.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddDialogOpen(true)}
                    sx={{
                        borderRadius: "10px",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        textTransform: "none",
                        gap: 1,
                        background: "linear-gradient(135deg, #57a8ff 0%, #2f7df6 48%, #0d47b8 100%)",
                        boxShadow: "0 8px 18px rgba(18, 84, 188, 0.32)",
                        "&:hover": {
                            background: "linear-gradient(135deg, #6ab4ff 0%, #3b88ff 45%, #1554c7 100%)",
                            boxShadow: "0 10px 20px rgba(14, 75, 173, 0.4)"
                        },
                    }}
                >
                    Add File
                </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {renderSection('Datasets', datasets, 'dataset')}
                {datasets.length > 0 && models.length > 0 && <Divider />}
                {renderSection('Models', models, 'model')}
            </Box>

            <AddFileDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onAdd={handleAdd}
            />
        </Box>
    );
}
