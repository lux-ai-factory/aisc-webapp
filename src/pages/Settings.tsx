import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_VERSION_PREFIX } from "../config";
import { useProject } from "../context/ProjectContext";
import AISystemSettings from '../components/AISystemSettings';
import ReportSettings from '../components/ReportSettings';
import AppDialog from '../components/AppDialog';
import AppCard from '../components/AppCard';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import TuneIcon from '@mui/icons-material/Tune';
import toast from 'react-hot-toast';
import {
    createProjectConfig,
    deleteProjectConfig,
    getProjectConfigs,
    updateProjectConfig,
} from '../api/api';
import { ProjectConfig } from '../models/models';
import './Settings.css';
import '../styles/common.css';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const normalizeSettingKey = (name: string): string => {
    if (!name.trim()) return '';
    let key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!key) key = 'unnamed';
    else if (/^\d/.test(key)) key = `setting_${key}`;
    return key;
};

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



const blankGeneralValue = (type: string): unknown => {
    if (type === 'number') return 0;
    if (type === 'boolean') return false;
    if (type === 'json') return {};
    return '';
};

/** Config category chip, styled like the AI-system component "type" chip:
 *  filled with a light background and dark text (never white). */
const CATEGORY_CHIP: Record<ProjectConfig['category'], { bg: string; fg: string }> = {
    secrets: { bg: '#fef3c7', fg: '#92400e' },
    variables: { bg: '#e3f2fd', fg: '#0d47a1' },
    datashape: { bg: '#ffe0b2', fg: '#e65100' },
    api_endpoint: { bg: '#ede7f6', fg: '#4527a0' },
};

/** Value-type chip for variables, same filled light-bg / dark-text look. */
const VALUE_TYPE_CHIP: Record<string, { bg: string; fg: string }> = {
    string: { bg: '#e8f5e9', fg: '#1b5e20' },
    number: { bg: '#bbdefb', fg: '#0d47a1' },
    boolean: { bg: '#f3e5f5', fg: '#7b1fa2' },
    json: { bg: '#ffe0b2', fg: '#e65100' },
};
const VALUE_TYPE_DEFAULT = VALUE_TYPE_CHIP['string'];

function isValidJson(text: string): boolean {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

function SettingDialog({
    open,
    setting,
    initialCategory = 'variables',
    onClose,
    onSaved,
}: {
    open: boolean;
    setting?: ProjectConfig;
    initialCategory?: 'secrets' | 'variables';
    onClose: () => void;
    onSaved: (setting: ProjectConfig) => void;
}) {
    const { projectUUID } = useProject();
    const [category, setCategory] = useState<'secrets' | 'variables'>(setting?.category === 'secrets' ? 'secrets' : initialCategory);
    const [name, setName] = useState(setting?.name ?? '');
    const [value, setValue] = useState(setting?.masked_value ?? '');
    const [valueType, setValueType] = useState(String(setting?.json_value?.type ?? 'string'));
    const [generalValue, setGeneralValue] = useState<unknown>(setting?.json_value?.value ?? '');
    const [saving, setSaving] = useState(false);
    /** Raw JSON text being edited: keeps the field editable while the JSON is
     *  mid-edit/invalid, instead of snapping back to the last valid value. */
    const [jsonText, setJsonText] = useState<string | null>(null);
    const [numberText, setNumberText] = useState<string | null>(null);

    const generatedKey = useMemo(() => normalizeSettingKey(name), [name]);

    useEffect(() => {
        if (!open) return;
        setCategory(setting?.category === 'secrets' ? 'secrets' : initialCategory);
        setName(setting?.name ?? '');
        setValue('');
        setValueType(String(setting?.json_value?.type ?? 'string'));
        setGeneralValue(setting?.json_value?.value ?? blankGeneralValue(String(setting?.json_value?.type ?? 'string')));
        setJsonText(null);
        setNumberText(null);
    }, [open, setting, initialCategory]);

    const jsonInvalid = jsonText !== null && !isValidJson(jsonText);
    const numberInvalid =
        numberText !== null && (numberText.trim() === '' || !Number.isFinite(Number(numberText)));
    //: a variable value is only genuinely invalid for free-form types
    const variableInvalid = valueType === 'json' ? jsonInvalid : valueType === 'number' ? numberInvalid : false;

    const save = async () => {
        if (!projectUUID || !name.trim()) return;
        if (category === 'variables' && variableInvalid) {
            toast.error('Cannot save: variable value is invalid', { position: 'bottom-right' });
            return;
        }
        setSaving(true);
        try {
            const payload = category === 'secrets'
                ? { key: generatedKey, name: name.trim(), ...(value ? { value } : {}) }
                : { key: generatedKey, name: name.trim(), json_value: { type: valueType, value: generalValue } };
            const saved = setting
                ? await updateProjectConfig(projectUUID, setting.pid, payload)
                : await createProjectConfig(projectUUID, { category, ...payload });
            onSaved(saved);
            onClose();
            toast.success(setting ? 'Config updated' : 'Config created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save config');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            title={setting ? 'Edit project config' : 'Add project config'}
            actions={
                <>
                    <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        onClick={save}
                        disabled={saving || !name.trim() || (category === 'variables' && variableInvalid)}
                        sx={{ textTransform: 'none' }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </>
            }
        >
            <Stack spacing={2}>
                <TextField label="Config name" value={name} onChange={e => setName(e.target.value)} helperText={setting ? `Internal key: ${setting.key}` : `Internal key: ${generatedKey}`} />
                {category === 'secrets' ? (
                    <>
                        <TextField label={setting ? 'New value (leave blank to keep current)' : 'Secret value'} type="password" value={value} onChange={e => setValue(e.target.value)} />
                    </>
                ) : (
                    <>
                        <TextField select label="Value type" value={valueType} onChange={e => { const next = e.target.value; setValueType(next); setGeneralValue(blankGeneralValue(next)); setJsonText(null); setNumberText(null); }}>
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
                            <TextField
                                multiline
                                minRows={5}
                                label="JSON value"
                                value={jsonText ?? JSON.stringify(generalValue, null, 2)}
                                onChange={e => {
                                    const text = e.target.value;
                                    setJsonText(text);
                                    try { setGeneralValue(JSON.parse(text)); } catch { /* keep editing invalid JSON */ }
                                }}
                                helperText={jsonInvalid ? 'invalid JSON' : undefined}
                                error={jsonInvalid}
                                sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                            />
                        ) : (
                            <TextField
                                label="Value"
                                type="number"
                                value={numberText ?? String(generalValue ?? '')}
                                onChange={e => {
                                    const text = e.target.value;
                                    setNumberText(text);
                                    setGeneralValue(text === '' ? null : Number(text));
                                }}
                                helperText={numberInvalid ? 'invalid number' : undefined}
                                error={numberInvalid}
                            />
                        )}
                    </>
                )}
            </Stack>
        </AppDialog>
    );
}



function ProjectConfigsSection() {
    const { projectUUID } = useProject();
    const [settings, setSettings] = useState<ProjectConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [settingDialog, setSettingDialog] = useState<{ open: boolean; setting?: ProjectConfig; initialCategory?: 'secrets' | 'variables' }>({ open: false });

    const refresh = useCallback(async () => {
        if (!projectUUID) return;
        setLoading(true);
        try { setSettings(await getProjectConfigs(projectUUID)); }
        catch { toast.error('Could not load project configs'); }
        finally { setLoading(false); }
    }, [projectUUID]);

    useEffect(() => { refresh(); }, [refresh]);

    const remove = async (setting: ProjectConfig) => {
        if (!projectUUID || !window.confirm(`Delete ${setting.name}?`)) return;
        try { await deleteProjectConfig(projectUUID, setting.pid); setSettings(previous => previous.filter(item => item.pid !== setting.pid)); toast.success('Config deleted'); }
        catch { toast.error('Could not delete config'); }
    };

    const cards = (category: ProjectConfig['category']) => settings.filter(setting => setting.category === category);
    const settingSummary = (setting: ProjectConfig): string => {
        if (setting.category === 'secrets') return setting.masked_value ? '•••••••• (secret)' : 'No value';
        if (setting.category === 'variables') return `${String(setting.json_value?.type)} · ${JSON.stringify(setting.json_value?.value)}`;
        if (setting.category === 'datashape') {
            return `${Array.isArray(setting.json_value?.features) ? `${setting.json_value.features.length} features` : 'No features'} · ${String(setting.json_value?.source_format || 'unknown format')}`;
        }
        return `${setting.endpoint_type} · ${setting.url || 'no url'} · ${setting.masked_value ? '•••••••• (key)' : 'no key'}`;
    };
    const renderSetting = (setting: ProjectConfig) => (
        <AppCard
            active
            header={
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1, minWidth: 0 }}>
                        {setting.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                        <IconButton size="small" onClick={() => setSettingDialog({ open: true, setting })}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => remove(setting)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                </Box>
            }
            footer={
                <>
                    <Chip
                        label={setting.category}
                        size="small"
                        variant="filled"
                        sx={{
                            height: 22,
                            fontWeight: 600,
                            bgcolor: CATEGORY_CHIP[setting.category].bg,
                            color: CATEGORY_CHIP[setting.category].fg,
                        }}
                    />
                    {setting.category === 'variables' && (
                        <Chip
                            label={String(setting.json_value?.type ?? 'string')}
                            size="small"
                            variant="filled"
                            sx={{
                                height: 22,
                                fontWeight: 600,
                                bgcolor: (VALUE_TYPE_CHIP[String(setting.json_value?.type ?? 'string')] ?? VALUE_TYPE_DEFAULT).bg,
                                color: (VALUE_TYPE_CHIP[String(setting.json_value?.type ?? 'string')] ?? VALUE_TYPE_DEFAULT).fg,
                            }}
                        />
                    )}
                    <Chip label={setting.key} size="small" variant="outlined" />
                </>
            }
        >
            <Typography variant="caption" color="text.secondary">
                {settingSummary(setting)}
            </Typography>
        </AppCard>
    );

    const section = (title: string, category: ProjectConfig['category'], icon: React.ReactNode, onAdd: () => void) => (
        <Box sx={{ mt: 4 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box><Typography component="h3" variant="h5">{title}</Typography></Stack><Button startIcon={<AddIcon />} variant="contained" className="gradient-btn" onClick={onAdd}>{category === 'datashape' ? 'Add DataShape' : 'Add config'}</Button></Stack>{loading ? <CircularProgress /> : cards(category).length ? <Grid container spacing={2} className="plugins-grid">{cards(category).map(setting => <Grid key={setting.pid} size={{ xs: 12, md: 6, lg: 4 }}>{renderSetting(setting)}</Grid>)}</Grid> : <Typography color="text.secondary">No {title.toLowerCase()} configured.</Typography>}</Box>
    );

    const upsert = (saved: ProjectConfig) => setSettings(previous => previous.some(item => item.pid === saved.pid) ? previous.map(item => item.pid === saved.pid ? saved : item) : [...previous, saved]);
     return <Box sx={{ mt: 6 }}><Typography component="h2" variant="h4" gutterBottom>Configuration data</Typography><Typography variant="body1" color="text.secondary">Values declared by plugins are managed here and resolved when evaluations run.</Typography>{section('Secrets', 'secrets', <KeyIcon />, () => setSettingDialog({ open: true, initialCategory: 'secrets' }))}{section('Variables', 'variables', <TuneIcon />, () => setSettingDialog({ open: true, initialCategory: 'variables' }))}<SettingDialog open={settingDialog.open} setting={settingDialog.setting} initialCategory={settingDialog.setting?.category === 'secrets' ? 'secrets' : settingDialog.initialCategory ?? 'variables'} onClose={() => setSettingDialog({ open: false })} onSaved={upsert} /></Box>;
}

export default function SettingsPage() {
    const { projectUUID } = useProject();
    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Project settings
            </Typography>

            <ProjectDetailsSection />

            <AISystemSettings />

            <ProjectConfigsSection />

            {projectUUID && <ReportSettings projectPid={projectUUID} />}
        </Box>
    );
}
