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
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_VERSION_PREFIX } from "../config";
import { useProject } from "../context/ProjectContext";
import keycloak from '../auth/keycloak';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import TuneIcon from '@mui/icons-material/Tune';
import DataObjectIcon from '@mui/icons-material/DataObject';
import toast from 'react-hot-toast';
import {
    createProjectSetting,
    deleteProjectSetting,
    deriveFeaturesFromDataset,
    getProjectSettings,
    updateProjectSetting,
    validateDatasetAgainstDatashape,
} from '../api/api';
import { ProjectSetting, ValidationReport } from '../models/models';
import './Settings.css';
import '../styles/common.css';

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
                className="gradient-card"
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
                            className="gradient-btn"
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
    const { fileUploadingPids } = useProject();
    const backgroundUploading = fileUploadingPids.has(file.pid);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const f = event.target.files?.[0];
        if (!f) return;
        if (type === 'model' && !f.name.toLowerCase().endsWith('.onnx')) {
            alert('Only .onnx files are allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('file', f);
        await keycloak.updateToken(30);
        // Re-upload: overwrites the stored file reference but does NOT delete the old blob from storage
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `${API_URL}/${type}s/${file.pid}/data`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${keycloak.token}`);
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

    // TODO: buffers entire file in memory - use streaming (service worker or backend ?token=) for large artifacts
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
                    label={backgroundUploading ? 'Uploading' : uploaded ? 'Uploaded' : 'Not uploaded'}
                    size="small"
                    color={backgroundUploading ? 'warning' : uploaded ? 'success' : 'default'}
                    variant={uploaded || backgroundUploading ? 'filled' : 'outlined'}
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
                    className: "dialog-paper-blue",
                }
            }}
        >
            <DialogTitle sx={{ color: "white", fontWeight: 700 }}>
                Add File
            </DialogTitle>
            <DialogContent className="dialog-content-white">
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
                    >
                        <MenuItem value="dataset">Dataset</MenuItem>
                        <MenuItem value="model">Model</MenuItem>
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

type FeatureDraft = {
    name: string;
    dtype: string;
    semantic_type: string;
    role: string;
    null_count: number;
    unique_count: number;
    min?: number | null;
    max?: number | null;
    mean?: number | null;
    std?: number | null;
    categories?: unknown[];
    category_mapping?: Record<string, string>;
};

type DataShapeDraft = {
    version: number;
    source_dataset_pid: string;
    source_format: string;
    derived_at: string;
    row_count: number;
    features: FeatureDraft[];
};

const blankGeneralValue = (type: string): unknown => {
    if (type === 'number') return 0;
    if (type === 'boolean') return false;
    if (type === 'json') return {};
    return '';
};

function SettingDialog({
    open,
    setting,
    initialCategory = 'general',
    onClose,
    onSaved,
}: {
    open: boolean;
    setting?: ProjectSetting;
    initialCategory?: 'api_key' | 'general';
    onClose: () => void;
    onSaved: (setting: ProjectSetting) => void;
}) {
    const { projectUUID } = useProject();
    const [category, setCategory] = useState<'api_key' | 'general'>(setting?.category === 'api_key' ? 'api_key' : initialCategory);
    const [key, setKey] = useState(setting?.key ?? '');
    const [name, setName] = useState(setting?.name ?? '');
    const [serviceType, setServiceType] = useState(setting?.service_type ?? '');
    const [value, setValue] = useState(setting?.masked_value ?? '');
    const [valueType, setValueType] = useState(String(setting?.json_value?.type ?? 'string'));
    const [generalValue, setGeneralValue] = useState<unknown>(setting?.json_value?.value ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCategory(setting?.category === 'api_key' ? 'api_key' : initialCategory);
        setKey(setting?.key ?? '');
        setName(setting?.name ?? '');
        setServiceType(setting?.service_type ?? '');
        setValue('');
        setValueType(String(setting?.json_value?.type ?? 'string'));
        setGeneralValue(setting?.json_value?.value ?? blankGeneralValue(String(setting?.json_value?.type ?? 'string')));
    }, [open, setting, initialCategory]);

    const save = async () => {
        if (!projectUUID || !key.trim() || !name.trim()) return;
        setSaving(true);
        try {
            const payload = category === 'api_key'
                ? { key: key.trim(), name: name.trim(), service_type: serviceType.trim(), ...(value ? { value } : {}) }
                : { key: key.trim(), name: name.trim(), json_value: { type: valueType, value: generalValue } };
            const saved = setting
                ? await updateProjectSetting(projectUUID, setting.pid, payload)
                : await createProjectSetting(projectUUID, { category, ...payload });
            onSaved(saved);
            onClose();
            toast.success(setting ? 'Setting updated' : 'Setting created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save setting');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{setting ? 'Edit project setting' : 'Add project setting'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {!setting && (
                        <TextField select label="Category" value={category} onChange={e => setCategory(e.target.value as 'api_key' | 'general')}>
                            <MenuItem value="api_key">API key</MenuItem>
                            <MenuItem value="general">General setting</MenuItem>
                        </TextField>
                    )}
                    <TextField label="Key" value={key} onChange={e => setKey(e.target.value)} helperText="Letters, numbers, and underscores" disabled={!!setting} />
                    <TextField label="Display name" value={name} onChange={e => setName(e.target.value)} />
                    {category === 'api_key' ? (
                        <>
                            <TextField label="Service type" value={serviceType} onChange={e => setServiceType(e.target.value)} placeholder="openai" />
                            <TextField label={setting ? 'New value (leave blank to keep current)' : 'API key'} type="password" value={value} onChange={e => setValue(e.target.value)} />
                        </>
                    ) : (
                        <>
                            <TextField select label="Value type" value={valueType} onChange={e => { const next = e.target.value; setValueType(next); setGeneralValue(blankGeneralValue(next)); }}>
                                <MenuItem value="string">String</MenuItem>
                                <MenuItem value="number">Number</MenuItem>
                                <MenuItem value="boolean">Boolean</MenuItem>
                                <MenuItem value="json">JSON</MenuItem>
                            </TextField>
                            {valueType === 'boolean' ? (
                                <TextField select label="Value" value={String(generalValue)} onChange={e => setGeneralValue(e.target.value === 'true')}>
                                    <MenuItem value="true">True</MenuItem><MenuItem value="false">False</MenuItem>
                                </TextField>
                            ) : valueType === 'json' ? (
                                <TextField multiline minRows={5} label="JSON value" value={JSON.stringify(generalValue, null, 2)} onChange={e => { try { setGeneralValue(JSON.parse(e.target.value)); } catch { /* keep editing invalid JSON */ } }} />
                            ) : (
                                <TextField label="Value" type={valueType === 'number' ? 'number' : 'text'} value={String(generalValue ?? '')} onChange={e => setGeneralValue(valueType === 'number' ? Number(e.target.value) : e.target.value)} />
                            )}
                        </>
                    )}
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving || !key.trim() || !name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}

function DataShapeDialog({
    open,
    setting,
    datasets,
    onClose,
    onSaved,
}: {
    open: boolean;
    setting?: ProjectSetting;
    datasets: FileItem[];
    onClose: () => void;
    onSaved: (setting: ProjectSetting) => void;
}) {
    const { projectUUID } = useProject();
    const [key, setKey] = useState('');
    const [name, setName] = useState('');
    const [datasetPid, setDatasetPid] = useState('');
    const [document, setDocument] = useState<DataShapeDraft | null>(null);
    const [createdSetting, setCreatedSetting] = useState<ProjectSetting | undefined>();
    const [saving, setSaving] = useState(false);
    const [report, setReport] = useState<ValidationReport | null>(null);

    useEffect(() => {
        if (!open) return;
        setKey(setting?.key ?? '');
        setName(setting?.name ?? '');
        setDatasetPid(String(setting?.json_value?.source_dataset_pid ?? ''));
        setDocument(setting?.json_value as unknown as DataShapeDraft ?? null);
        setCreatedSetting(undefined);
        setReport(null);
    }, [open, setting]);

    const updateFeature = (index: number, patch: Partial<FeatureDraft>) => {
        setDocument(previous => previous ? { ...previous, features: previous.features.map((feature, i) => i === index ? { ...feature, ...patch } : feature) } : previous);
    };

    const derive = async () => {
        if (!projectUUID || !datasetPid || !key.trim() || !name.trim()) return;
        setSaving(true);
        try {
            const saved = await deriveFeaturesFromDataset(projectUUID, { dataset_pid: datasetPid, key: key.trim(), name: name.trim() });
            setDocument(saved.json_value as unknown as DataShapeDraft);
            setDatasetPid(String(saved.json_value.source_dataset_pid ?? datasetPid));
            setCreatedSetting(saved);
            onSaved(saved);
            toast.success('Features derived from training dataset');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not derive features');
        } finally {
            setSaving(false);
        }
    };

    const save = async () => {
        const currentSetting = setting ?? createdSetting;
        if (!projectUUID || !currentSetting || !document) return;
        setSaving(true);
        try {
            const saved = await updateProjectSetting(projectUUID, currentSetting.pid, { name: name.trim(), json_value: document });
            onSaved(saved);
            onClose();
            toast.success('Datashape saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save datashape');
        } finally {
            setSaving(false);
        }
    };

    const validate = async () => {
        const currentSetting = setting ?? createdSetting;
        if (!projectUUID || !currentSetting || !datasetPid) return;
        try {
            setReport(await validateDatasetAgainstDatashape(projectUUID, currentSetting.pid, datasetPid));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not validate dataset');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>{setting ? `Edit DataShape: ${setting.name}` : 'Create DataShape'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField fullWidth label="Key" value={key} onChange={e => setKey(e.target.value)} disabled={!!setting} />
                        <TextField fullWidth label="Name" value={name} onChange={e => setName(e.target.value)} />
                    </Stack>
                    <TextField select fullWidth label="Training dataset" value={datasetPid} onChange={e => setDatasetPid(e.target.value)}>
                        {datasets.map(dataset => <MenuItem key={dataset.pid} value={dataset.pid}>{dataset.name}</MenuItem>)}
                    </TextField>
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={derive} disabled={saving || !datasetPid || !key.trim() || !name.trim()}>Derive features</Button>
                        {(setting || createdSetting) && <Button variant="outlined" onClick={validate} disabled={!datasetPid}>Validate dataset</Button>}
                    </Stack>
                    {report && (
                        <Card variant="outlined"><CardContent>
                            <Typography variant="subtitle1" fontWeight={700}>Validation report</Typography>
                            {report.errors.map(error => <Typography key={error} color="error">Error: {error}</Typography>)}
                            {report.warnings.map(warning => <Typography key={warning} color="warning.main">Warning: {warning}</Typography>)}
                            {!report.errors.length && !report.warnings.length && <Typography color="success.main">No mismatches found.</Typography>}
                        </CardContent></Card>
                    )}
                    {document && (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Features ({document.features.length})</Typography>
                            <Stack spacing={1}>
                                {document.features.map((feature, index) => (
                                    <Card key={`${feature.name}-${index}`} variant="outlined"><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                                            <TextField size="small" label="Name" value={feature.name} onChange={e => updateFeature(index, { name: e.target.value })} sx={{ minWidth: 180 }} />
                                            <TextField size="small" select label="Semantic type" value={feature.semantic_type} onChange={e => updateFeature(index, { semantic_type: e.target.value })} sx={{ minWidth: 150 }}>
                                                {['numeric', 'categorical', 'datetime', 'text', 'boolean'].map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                                            </TextField>
                                            <TextField size="small" select label="Role" value={feature.role} onChange={e => updateFeature(index, { role: e.target.value })} sx={{ minWidth: 130 }}>
                                                {['feature', 'target', 'date', 'ignore'].map(role => <MenuItem key={role} value={role}>{role}</MenuItem>)}
                                            </TextField>
                                            <TextField size="small" type="number" label="Min" value={feature.min ?? ''} onChange={e => updateFeature(index, { min: e.target.value === '' ? null : Number(e.target.value) })} sx={{ width: 110 }} />
                                            <TextField size="small" type="number" label="Max" value={feature.max ?? ''} onChange={e => updateFeature(index, { max: e.target.value === '' ? null : Number(e.target.value) })} sx={{ width: 110 }} />
                                        </Stack>
                                        {feature.semantic_type === 'categorical' && (
                                            <TextField fullWidth size="small" label="Category mapping (JSON)" sx={{ mt: 1 }} value={JSON.stringify(feature.category_mapping ?? {}, null, 2)} onChange={e => { try { updateFeature(index, { category_mapping: JSON.parse(e.target.value) }); } catch { /* allow in-progress JSON */ } }} />
                                        )}
                                        <Typography variant="caption" color="text.secondary">dtype: {feature.dtype} · nulls: {feature.null_count} · unique: {feature.unique_count}</Typography>
                                    </CardContent></Card>
                                ))}
                            </Stack>
                        </Box>
                    )}
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving || !(setting || createdSetting) || !document}>Save changes</Button>
                    </Stack>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}

function ProjectSettingsSection({ datasets }: { datasets: FileItem[] }) {
    const { projectUUID } = useProject();
    const [settings, setSettings] = useState<ProjectSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [settingDialog, setSettingDialog] = useState<{ open: boolean; setting?: ProjectSetting; initialCategory?: 'api_key' | 'general' }>({ open: false });
    const [shapeDialog, setShapeDialog] = useState<{ open: boolean; setting?: ProjectSetting }>({ open: false });

    const refresh = useCallback(async () => {
        if (!projectUUID) return;
        setLoading(true);
        try { setSettings(await getProjectSettings(projectUUID)); }
        catch { toast.error('Could not load project settings'); }
        finally { setLoading(false); }
    }, [projectUUID]);

    useEffect(() => { refresh(); }, [refresh]);

    const remove = async (setting: ProjectSetting) => {
        if (!projectUUID || !window.confirm(`Delete ${setting.name}?`)) return;
        try { await deleteProjectSetting(projectUUID, setting.pid); setSettings(previous => previous.filter(item => item.pid !== setting.pid)); toast.success('Setting deleted'); }
        catch { toast.error('Could not delete setting'); }
    };

    const cards = (category: ProjectSetting['category']) => settings.filter(setting => setting.category === category);
    const renderSetting = (setting: ProjectSetting) => (
        <Card key={setting.pid} variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box><Typography fontWeight={700}>{setting.name}</Typography><Typography variant="caption" color="text.secondary">{setting.key}</Typography></Box>
                    <Stack direction="row"><IconButton size="small" onClick={() => setting.category === 'datashape' ? setShapeDialog({ open: true, setting }) : setSettingDialog({ open: true, setting })}><EditIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => remove(setting)}><DeleteIcon fontSize="small" /></IconButton></Stack>
                </Stack>
                {setting.category === 'api_key' && <Typography sx={{ mt: 1 }} color="text.secondary">{setting.service_type || 'Unspecified service'} · {setting.masked_value || 'No value'}</Typography>}
                {setting.category === 'general' && <Typography sx={{ mt: 1 }} color="text.secondary">{String(setting.json_value?.type)} · {JSON.stringify(setting.json_value?.value)}</Typography>}
                {setting.category === 'datashape' && <Typography sx={{ mt: 1 }} color="text.secondary">{Array.isArray(setting.json_value?.features) ? `${setting.json_value.features.length} features` : 'No features'} · {String(setting.json_value?.source_format || 'unknown format')}</Typography>}
            </CardContent>
        </Card>
    );

    const section = (title: string, category: ProjectSetting['category'], icon: React.ReactNode, onAdd: () => void) => (
        <Box sx={{ mt: 4 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box><Typography component="h3" variant="h5">{title}</Typography></Stack><Button startIcon={<AddIcon />} variant="outlined" onClick={onAdd}>{category === 'datashape' ? 'Add DataShape' : 'Add setting'}</Button></Stack>{loading ? <CircularProgress /> : cards(category).length ? <Grid container spacing={2}>{cards(category).map(setting => <Grid key={setting.pid} size={{ xs: 12, md: 6, lg: 4 }}>{renderSetting(setting)}</Grid>)}</Grid> : <Typography color="text.secondary">No {title.toLowerCase()} configured.</Typography>}</Box>
    );

    const upsert = (saved: ProjectSetting) => setSettings(previous => previous.some(item => item.pid === saved.pid) ? previous.map(item => item.pid === saved.pid ? saved : item) : [...previous, saved]);
    return <Box sx={{ mt: 6 }}><Typography component="h2" variant="h4" gutterBottom>Project settings</Typography><Typography variant="body1" color="text.secondary">Values declared by plugins are managed here and resolved when evaluations run.</Typography>{section('API keys', 'api_key', <KeyIcon />, () => setSettingDialog({ open: true, initialCategory: 'api_key' }))}{section('General settings', 'general', <TuneIcon />, () => setSettingDialog({ open: true, initialCategory: 'general' }))}{section('DataShapes', 'datashape', <DataObjectIcon />, () => setShapeDialog({ open: true }))}<SettingDialog open={settingDialog.open} setting={settingDialog.setting} initialCategory={settingDialog.setting?.category === 'api_key' ? 'api_key' : settingDialog.initialCategory ?? 'general'} onClose={() => setSettingDialog({ open: false })} onSaved={upsert} /><DataShapeDialog open={shapeDialog.open} setting={shapeDialog.setting} datasets={datasets} onClose={() => setShapeDialog({ open: false })} onSaved={upsert} /></Box>;
}

export default function SettingsPage() {
    const { projectUUID } = useProject();
    const [datasets, setDatasets] = useState<FileItem[]>([]);
    const [models, setModels] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const fetchFiles = useCallback(async () => {
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
    }, [projectUUID]);

    useEffect(() => {
        fetchFiles();
    }, [projectUUID]);

    useEffect(() => {
        const onFocus = () => { fetchFiles(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [fetchFiles]);

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
            await keycloak.updateToken(30);
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", `${API_URL}/${type}s/${created.pid}/data`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${keycloak.token}`);
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
                    toast.success(`${type === 'dataset' ? 'Dataset' : 'Model'} \`${name}\` uploaded`, { position: 'bottom-right' });
                } else {
                    toast.error(`Failed to upload ${name}`, { position: 'bottom-right' });
                }
            };
            xhr.onerror = () => toast.error(`Failed to upload ${name}`, { position: 'bottom-right' });
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
                                className="gradient-card"
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
                    className="gradient-btn"
                >
                    Add File
                </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {renderSection('Datasets', datasets, 'dataset')}
                {datasets.length > 0 && models.length > 0 && <Divider />}
                {renderSection('Models', models, 'model')}
            </Box>

            <ProjectSettingsSection datasets={datasets} />

            <AddFileDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onAdd={handleAdd}
            />
        </Box>
    );
}
