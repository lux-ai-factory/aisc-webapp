import { useCallback, useEffect, useRef, useState } from "react";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
    DialogContent, DialogTitle, Divider, IconButton, List,
    MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import toast from "react-hot-toast";
import { useProject } from "../context/ProjectContext";
import { deriveFeaturesFromDataset, getProjectConfigs } from "../api/api";
import keycloak from "../auth/keycloak";
import { API_VERSION_PREFIX } from "../config";
import { AIComponent, AIComponentType, ProjectConfig } from "../models/models";
import "../styles/common.css";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

function formatBytes(bytes?: number | null): string {
    if (bytes === null || bytes === undefined || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function uploadWithProgress(url: string, formData: FormData, onProgress: (percent: number) => void): Promise<void> {
    if (keycloak.authenticated) {
        try {
            await keycloak.updateToken(30);
        } catch {
            keycloak.authenticated = false;
        }
    }
    const bearer = keycloak.authenticated && keycloak.token ? `Bearer ${keycloak.token}` : "";
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        if (bearer) {
            xhr.setRequestHeader("Authorization", bearer);
        }
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error(`Upload failed (HTTP ${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(formData);
    });
}

const COMPONENT_TYPES: { value: AIComponentType; label: string }[] = [
    { value: "model", label: "Model (file upload)" },
    { value: "dataset", label: "Dataset (file upload)" },
    { value: "llm", label: "LLM (OpenAI-compatible endpoint)" },
    { value: "datashape", label: "DataShape (from dataset)" },
    { value: "resource", label: "Resource (generic reference)" },
];

const SEMANTIC_TYPES = ["numeric", "categorical", "datetime", "text", "boolean"];
const ROLES = ["feature", "target", "date", "ignore"];

interface FeatureDraft {
    name: string;
    dtype?: string;
    semantic_type?: string;
    role?: string;
    category_mapping?: Record<string, string>;
    categories?: unknown[];
}

function DataShapeFeaturesEditor({ value, onChange }: {
    value: { features?: FeatureDraft[] } | undefined;
    onChange: (v: { features: FeatureDraft[] }) => void;
}) {
    const features = value?.features ?? [];
    const update = (i: number, patch: Partial<FeatureDraft>) => {
        const next = features.map((f, idx) => idx === i ? { ...f, ...patch } : f);
        onChange({ features: next });
    };
    const updateLabel = (i: number, raw: string, label: string) => {
        const f = features[i];
        const mapping = { ...(f.category_mapping ?? {}) };
        mapping[raw] = label;
        update(i, { category_mapping: mapping });
    };

    if (features.length === 0) {
        return <Typography color="text.secondary">No features extracted yet.</Typography>;
    }

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Extracted features ({features.length})</Typography>
            <List sx={{ maxHeight: 400, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                {features.map((f, i) => (
                    <Box key={i} sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={600}>{f.name} <Chip size="small" label={f.dtype ?? ''} /></Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                            <TextField select size="small" label="Type" value={f.semantic_type ?? "numeric"} sx={{ minWidth: 140 }}
                                onChange={(e) => update(i, { semantic_type: e.target.value })}>
                                {SEMANTIC_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </TextField>
                            <TextField select size="small" label="Role" value={f.role ?? "feature"} sx={{ minWidth: 120 }}
                                onChange={(e) => update(i, { role: e.target.value })}>
                                {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                            </TextField>
                        </Stack>
                        {f.semantic_type === "categorical" && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary">Category labels</Typography>
                                {(f.category_mapping ? Object.entries(f.category_mapping) : []).map(([raw, label]) => (
                                    <Stack key={raw} direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                        <Typography variant="body2" sx={{ minWidth: 40 }}>{raw}</Typography>
                                        <TextField size="small" value={label} onChange={(e) => updateLabel(i, raw, e.target.value)} fullWidth sx={{ maxWidth: 260 }} />
                                    </Stack>
                                ))}
                            </Box>
                        )}
                    </Box>
                ))}
            </List>
        </Box>
    );
}

export default function AISystemSettings() {
    const { projectUUID, fileUploadingPids, addFileUploadingPid, removeFileUploadingPid } = useProject();
    const [systemInfo, setSystemInfo] = useState<{ pid: string; name: string } | null>(null);
    const [components, setComponents] = useState<AIComponent[]>([]);
    const [secrets, setSecrets] = useState<ProjectConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

    // add-dialog state
    const [name, setName] = useState("");
    const [type, setType] = useState<AIComponentType>("model");
    const [file, setFile] = useState<File | undefined>();
    const [addLlmUrl, setAddLlmUrl] = useState("");
    const [addSecretKey, setAddSecretKey] = useState("");
    const [addResourceValue, setAddResourceValue] = useState("");
    const [sourceDatasetPid, setSourceDatasetPid] = useState("");
    const [addJsonValue, setAddJsonValue] = useState<{ features?: FeatureDraft[] }>({});
    const [addDeriving, setAddDeriving] = useState(false);
    const [addDeriveError, setAddDeriveError] = useState<string | null>(null);
    const [addImported, setAddImported] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const datashapeFileInputRef = useRef<HTMLInputElement>(null);

    // edit-dialog state
    const [editTarget, setEditTarget] = useState<AIComponent | null>(null);
    const [editName, setEditName] = useState("");
    const [editFile, setEditFile] = useState<File | undefined>();
    const [editLlmUrl, setEditLlmUrl] = useState("");
    const [editSecretKey, setEditSecretKey] = useState("");
    const [editResourceValue, setEditResourceValue] = useState("");
    const [editSourceDatasetPid, setEditSourceDatasetPid] = useState("");
    const [editJsonValue, setEditJsonValue] = useState<{ features?: FeatureDraft[] }>({});
    const [editSaving, setEditSaving] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    const datasetComponents = components.filter(c => c.component_type === "dataset");

    const fetchData = useCallback(async () => {
        if (!projectUUID) return;
        const res = await fetch(`${API_URL}/projects/${projectUUID}/aisystem`);
        if (res.ok) {
            const data = await res.json();
            setSystemInfo({ pid: data.pid, name: data.name });
            setComponents(data.components ?? []);
        }
        const settings = await getProjectConfigs(projectUUID);
        setSecrets(settings.filter(s => s.category === "secrets"));
    }, [projectUUID]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            await fetchData();
        } finally {
            setLoading(false);
        }
    }, [fetchData]);

    // Silent background refresh: only shows the spinner on the first load so
    // that upload progress/cards are not replaced by a loading placeholder.
    const refresh = useCallback(() => {
        fetchData().catch(() => { /* keep current data on failure */ });
    }, [fetchData]);

    useEffect(() => { load(); }, [load]);

    // When a source dataset is picked in the add-dialog (datashape), derive the
    // data shape and let the user inspect/edit it BEFORE creating the component.
    useEffect(() => {
        if (addImported) return;
        if (type !== "datashape" || !sourceDatasetPid || !projectUUID) {
            setAddJsonValue({});
            setAddDeriveError(null);
            setAddDeriving(false);
            return;
        }
        let cancelled = false;
        setAddDeriving(true);
        setAddDeriveError(null);
        deriveFeaturesFromDataset(projectUUID, sourceDatasetPid)
            .then((res) => {
                if (cancelled) return;
                setAddJsonValue({ features: (res.features ?? []) as FeatureDraft[] });
            })
            .catch(() => {
                if (cancelled) return;
                setAddDeriveError("Could not derive the data shape from this dataset.");
            })
            .finally(() => {
                if (!cancelled) setAddDeriving(false);
            });
        return () => { cancelled = true; };
    }, [type, sourceDatasetPid, projectUUID, addImported]);

    const openDialog = async () => {
        setName("");
        setType("model");
        setFile(undefined);
        setAddLlmUrl("");
        setAddSecretKey("");
        setAddResourceValue("");
        setSourceDatasetPid("");
        setAddJsonValue({});
        setAddDeriveError(null);
        setAddDeriving(false);
        setAddImported(false);
        if (projectUUID) {
            try {
                const settings = await getProjectConfigs(projectUUID);
                setSecrets(settings.filter(s => s.category === "secrets"));
            } catch { /* keep current secrets on failure */ }
        }
        setOpen(true);
    };

    const handleDatashapeImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result ?? "");
                const parsed = JSON.parse(text);
                const features = Array.isArray((parsed as { features?: unknown })?.features) ? (parsed as { features: unknown[] }).features : Array.isArray(parsed) ? parsed : null;
                if (!features) throw new Error("Missing features array");
                setAddJsonValue({ features: features as FeatureDraft[] });
                setAddDeriveError(null);
                setAddImported(true);
                toast.success("Datashape imported", { position: 'bottom-right' });
            } catch {
                toast.error("Invalid datashape JSON", { position: 'bottom-right' });
            } finally {
                e.target.value = "";
            }
        };
        reader.readAsText(file);
    };

    const addComponent = async () => {
        if (!projectUUID || name.trim().length < 1) return;
        if (type === "llm" && (!addLlmUrl.trim() || !addSecretKey)) return;
        if (type === "resource" && !addResourceValue.trim()) return;
        if (type === "datashape" && !sourceDatasetPid) return;
        if ((type === "model" || type === "dataset") && !file) return;
        setSaving(true);
        try {
            const payload: Record<string, unknown> = { name: name.trim(), component_type: type };
            if (type === "llm") {
                payload.json_value = { endpoint_url: addLlmUrl.trim(), secret_key: addSecretKey };
            }
            if (type === "resource") {
                payload.json_value = { value: addResourceValue.trim() };
            }
            if (type === "datashape") {
                payload.source_dataset_pid = sourceDatasetPid;
                payload.json_value = { features: addJsonValue.features ?? [] };
            }
            const res = await fetch(`${API_URL}/projects/${projectUUID}/components`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return;
            const created = await res.json();
            // Close the dialog immediately so the UI is not blocked while the
            // file uploads in the background.
            setOpen(false);
            refresh();
            if ((type === "model" || type === "dataset") && file) {
                const formData = new FormData();
                formData.append("file", file);
                addFileUploadingPid(created.pid);
                setUploadProgress(prev => ({ ...prev, [created.pid]: 0 }));
                uploadWithProgress(
                    `${API_URL}/components/${created.pid}/data`,
                    formData,
                    (percent) => setUploadProgress(prev => ({ ...prev, [created.pid]: percent })),
                ).then(() => {
                    removeFileUploadingPid(created.pid);
                    refresh();
                    toast.success(`Component \`${created.name}\` uploaded`, { position: 'bottom-right' });
                }).catch(() => {
                    removeFileUploadingPid(created.pid);
                    toast.error(`Failed to upload \`${created.name}\``, { position: 'bottom-right' });
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const remove = async (pid: string) => {
        await fetch(`${API_URL}/components/${pid}`, { method: "DELETE" });
        refresh();
    };

    const startEdit = (c: AIComponent) => {
        const json = (c.json_value ?? {}) as Record<string, unknown>;
        setEditTarget(c);
        setEditName(c.name);
        setEditFile(undefined);
        setEditLlmUrl(typeof json.endpoint_url === "string" ? json.endpoint_url : "");
        setEditSecretKey(typeof json.secret_key === "string" ? json.secret_key : "");
        setEditResourceValue(typeof json.value === "string" ? json.value : "");
        setEditSourceDatasetPid(c.source_dataset_pid ?? "");
        setEditJsonValue((c.json_value as { features?: FeatureDraft[] }) ?? {});
    };

    const saveEdit = async () => {
        if (!editTarget || editName.trim().length < 1) return;
        if (editTarget.component_type === "datashape" && !editSourceDatasetPid) return;
        setEditSaving(true);
        try {
            const payload: Record<string, unknown> = { name: editName.trim() };
            if (editTarget.component_type === "llm") {
                payload.json_value = { endpoint_url: editLlmUrl.trim(), secret_key: editSecretKey };
            }
            if (editTarget.component_type === "resource") {
                payload.json_value = { value: editResourceValue };
            }
            if (editTarget.component_type === "datashape") {
                payload.source_dataset_pid = editSourceDatasetPid;
                const current = (editTarget.json_value ?? {}) as Record<string, unknown>;
                payload.json_value = { ...current, features: editJsonValue.features ?? [] };
            }
            const res = await fetch(`${API_URL}/components/${editTarget.pid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return;
            // Close the edit dialog immediately and stream any replacement
            // file in the background so the UI is not blocked.
            setEditTarget(null);
            if ((editTarget.component_type === "model" || editTarget.component_type === "dataset") && editFile) {
                const formData = new FormData();
                formData.append("file", editFile);
                addFileUploadingPid(editTarget.pid);
                setUploadProgress(prev => ({ ...prev, [editTarget.pid]: 0 }));
                uploadWithProgress(
                    `${API_URL}/components/${editTarget.pid}/data`,
                    formData,
                    (percent) => setUploadProgress(prev => ({ ...prev, [editTarget.pid]: percent })),
                ).then(() => {
                    removeFileUploadingPid(editTarget.pid);
                    refresh();
                    toast.success(`Component \`${editTarget.name}\` updated`, { position: 'bottom-right' });
                }).catch(() => {
                    removeFileUploadingPid(editTarget.pid);
                    toast.error(`Failed to upload \`${editTarget.name}\``, { position: 'bottom-right' });
                });
            } else {
                refresh();
            }
        } finally {
            setEditSaving(false);
        }
    };

    if (loading) return <CircularProgress />;

    const componentMetadata = (c: AIComponent) => {
        const json = (c.json_value ?? {}) as Record<string, unknown>;
        switch (c.component_type) {
            case "model": case "dataset":
                return c.data
                    ? `file: ${c.data}`
                    : "no file";
            case "llm": {
                const secretName = secrets.find(s => s.key === json.secret_key)?.name ?? (json.secret_key ? String(json.secret_key) : null);
                return `${json.endpoint_url || "no endpoint"}${secretName ? ` · key: ${secretName}` : " · no key"}`;
            }
            case "resource":
                return json.value ? `value: ${String(json.value)}` : "no value";
            case "datashape": {
                const features = (json.features as unknown[]) ?? [];
                return c.source_dataset_pid ? `${features.length} features from dataset` : "no source dataset";
            }
            default:
                return c.component_type;
        }
    };

    const componentTypeColor: Record<AIComponentType, { bg: string; fg: string }> = {
        dataset: { bg: "#bbdefb", fg: "#0d47a1" },
        model: { bg: "#f3e5f5", fg: "#7b1fa2" },
        llm: { bg: "#c8e6c9", fg: "#1b5e20" },
        datashape: { bg: "#ffe0b2", fg: "#e65100" },
        resource: { bg: "#b2dfdb", fg: "#004d40" },
    };

    const handleCardDownload = async (c: AIComponent) => {
        if (c.component_type === "datashape") {
            const blob = new Blob([JSON.stringify(c.json_value ?? {}, null, 2)], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${c.name}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            return;
        }
        try {
            const response = await fetch(`${API_URL}/components/${c.pid}/data`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = c.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error('Download failed', { position: 'bottom-right' });
        }
    };

    const canAdd = name.trim().length > 0
        && !((type === "model" || type === "dataset") && !file)
        && !(type === "llm" && (!addLlmUrl.trim() || !addSecretKey))
        && !(type === "resource" && !addResourceValue.trim())
        && !(type === "datashape" && (!sourceDatasetPid || (!addImported && (addDeriving || addDeriveError !== null))));

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 6, mb: 1 }}>
                <Box>
                    <Typography component="h3" variant="h5" gutterBottom sx={{ mb: 0 }}>AI System</Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                        The assessed AI product/system and its components.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog} className="gradient-btn">Add component</Button>
            </Box>

            <Card variant="outlined" className="gradient-card" sx={{ mb: 2 }}>
                <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                        <LinkIcon sx={{ color: "primary.main" }} />
                        <Typography fontWeight={700}>{systemInfo?.name || "AI System"}</Typography>
                        {systemInfo && <Chip size="small" label={`id: ${systemInfo.pid}`} variant="outlined" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                        Components drive what can be assessed in this project.
                    </Typography>
                </CardContent>
            </Card>

            {components.length === 0 ? (
                <Typography color="text.secondary">No components yet. Add one to get started.</Typography>
            ) : (
                <Grid container spacing={2}>
                    {components.map((c) => {
                        const uploaded = Boolean(c.data);
                        const uploading = fileUploadingPids.has(c.pid);
                        const isFileComponent = c.component_type === "model" || c.component_type === "dataset";
                        const progress = uploadProgress[c.pid];
                        return (
                            <Grid key={c.pid} size={{ xs: 12, md: 6, lg: 4 }}>
                                <Card variant="outlined" className="gradient-card" sx={{ height: "100%" }}>
                                    <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1 }}>
                                            <Tooltip title={c.pid} placement="top">
                                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                                    {c.name}
                                                </Typography>
                                            </Tooltip>
                                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                                                {(uploaded || c.component_type === "datashape") && (
                                                    <Tooltip title="Download file" placement="top">
                                                        <IconButton size="small" color="primary" onClick={() => handleCardDownload(c)}>
                                                            <DownloadIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <IconButton size="small" onClick={() => startEdit(c)}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" color="error" onClick={() => remove(c.pid)}><DeleteIcon fontSize="small" /></IconButton>
                                            </Stack>
                                        </Stack>

                                        <Typography variant="body2" color="text.secondary" sx={{ mt: "auto", pt: 2 }}>
                                            {componentMetadata(c)}
                                        </Typography>

                                        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                                            <Chip
                                                label={c.component_type}
                                                size="small"
                                                variant="filled"
                                                sx={{ height: 22, fontWeight: 600, bgcolor: componentTypeColor[c.component_type].bg, color: componentTypeColor[c.component_type].fg }}
                                            />
                                            {isFileComponent && (
                                                <Chip
                                                    label={uploading ? 'Uploading' : uploaded ? 'Uploaded' : 'Not uploaded'}
                                                    size="small"
                                                    color={uploading ? 'warning' : uploaded ? 'success' : 'default'}
                                                    variant={uploaded || uploading ? 'filled' : 'outlined'}
                                                    sx={{ height: 22, fontWeight: 600 }}
                                                />
                                            )}
                                            {uploaded && c.file_size != null && (
                                                <Chip label={formatBytes(c.file_size)} size="small" variant="filled" sx={{ height: 22, fontWeight: 500, bgcolor: "#fff9c4" }} />
                                            )}
                                            {c.component_type === "datashape" && c.source_dataset_pid && (
                                                <Chip
                                                    label={`source: ${datasetComponents.find(d => d.pid === c.source_dataset_pid)?.name ?? c.source_dataset_pid}`}
                                                    size="small"
                                                    variant="filled"
                                                    sx={{ height: 22, fontWeight: 500, bgcolor: "grey.300", color: "text.secondary" }}
                                                />
                                            )}
                                            {isFileComponent && uploading && (
                                                <CircularProgress variant="determinate" value={progress ?? 0} size={20} />
                                            )}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Add dialog */}
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="sm"
                fullWidth
                slotProps={{ paper: { className: "dialog-paper-blue" } }}
            >
                <DialogTitle sx={{ color: "white", fontWeight: 700 }}>Add component</DialogTitle>
                <DialogContent className="dialog-content-white">
                    <Stack spacing={2} sx={{ mt: 4 }}>
                        <Stack direction="row" spacing={2}>
                            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus sx={{ flexGrow: 1, minWidth: 0 }} />
                            <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as AIComponentType)} sx={{ minWidth: 140 }}>
                                {COMPONENT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                            </TextField>
                        </Stack>
                        {(type === "model" || type === "dataset") && (
                            <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => fileInputRef.current?.click()}>
                                {file ? file.name : "Choose file"}
                            </Button>
                        )}
                        {type === "llm" && (
                            <>
                                <TextField label="Endpoint URL" value={addLlmUrl} onChange={(e) => setAddLlmUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
                                <TextField select label="API key (from project secrets)" value={addSecretKey} onChange={(e) => setAddSecretKey(e.target.value)}>
                                    {secrets.map(s => <MenuItem key={s.pid} value={s.key}>{s.name} ({s.masked_value})</MenuItem>)}
                                </TextField>
                            </>
                        )}
                        {type === "resource" && (
                            <TextField label="Resource reference" value={addResourceValue} onChange={(e) => setAddResourceValue(e.target.value)}
                                placeholder="e.g. user/hf-model-name" />
                        )}
                        {type === "datashape" && (
                            <>
                                <Stack direction="row" spacing={1} alignItems="flex-start">
                                    <TextField select label="Source dataset" value={sourceDatasetPid} onChange={(e) => { setAddImported(false); setSourceDatasetPid(e.target.value); }} sx={{ flexGrow: 1 }}>
                                        {datasetComponents.map(d => <MenuItem key={d.pid} value={d.pid}>{d.name}</MenuItem>)}
                                    </TextField>
                                    <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => datashapeFileInputRef.current?.click()} sx={{ whiteSpace: "nowrap", height: 56 }}>
                                        <Stack sx={{ alignItems: "center", lineHeight: 1.1 }}>
                                            <span>Import JSON</span>
                                            <Typography component="span" variant="caption" color="text.secondary">optional</Typography>
                                        </Stack>
                                    </Button>
                                </Stack>
                                <Divider />
                                {addDeriving ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <CircularProgress size={20} />
                                        <Typography color="text.secondary" variant="body2">Deriving data shape...</Typography>
                                    </Stack>
                                ) : addDeriveError ? (
                                    <Typography color="error" variant="body2">{addDeriveError}</Typography>
                                ) : (
                                    <DataShapeFeaturesEditor value={addJsonValue} onChange={setAddJsonValue} />
                                )}
                            </>
                        )}
                        <input ref={fileInputRef} hidden type="file" onChange={(e) => setFile(e.target.files?.[0])} />
                        <input ref={datashapeFileInputRef} hidden type="file" accept=".json,application/json" onChange={handleDatashapeImport} />
                        <Stack direction="row" justifyContent="flex-end" spacing={1}>
                            <Button onClick={() => setOpen(false)}>Cancel</Button>
                            <Button variant="contained" className="gradient-btn" onClick={addComponent} disabled={saving || !canAdd}>
                                {saving ? "Adding..." : "Add"}
                            </Button>
                        </Stack>
                    </Stack>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog
                open={!!editTarget}
                onClose={() => setEditTarget(null)}
                maxWidth="sm"
                fullWidth
                slotProps={{ paper: { className: "dialog-paper-blue" } }}
            >
                <DialogTitle sx={{ color: "white", fontWeight: 700 }}>Edit component</DialogTitle>
                <DialogContent className="dialog-content-white">
                    {editTarget && (
                        <Stack spacing={2} sx={{ mt: 4 }}>
                            <TextField label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                            {(editTarget.component_type === "model" || editTarget.component_type === "dataset") && (
                                <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => editFileInputRef.current?.click()}>
                                    {editFile ? editFile.name : (editTarget.data ? "Replace file" : "Choose file")}
                                </Button>
                            )}
                            {editTarget.component_type === "llm" && (
                                <>
                                    <TextField label="Endpoint URL" value={editLlmUrl} onChange={(e) => setEditLlmUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
                                    <TextField select label="API key (from project secrets)" value={editSecretKey} onChange={(e) => setEditSecretKey(e.target.value)}>
                                        {secrets.map(s => <MenuItem key={s.pid} value={s.key}>{s.name} ({s.masked_value})</MenuItem>)}
                                    </TextField>
                                </>
                            )}
                            {editTarget.component_type === "resource" && (
                                <TextField label="Resource reference" value={editResourceValue} onChange={(e) => setEditResourceValue(e.target.value)}
                                    placeholder="e.g. user/hf-model-name" />
                            )}
                            {editTarget.component_type === "datashape" && (
                                <>
                                    <TextField select label="Source dataset" value={editSourceDatasetPid} onChange={(e) => setEditSourceDatasetPid(e.target.value)}>
                                        {datasetComponents.map(d => <MenuItem key={d.pid} value={d.pid}>{d.name}</MenuItem>)}
                                    </TextField>
                                    <Divider />
                                    <DataShapeFeaturesEditor value={editJsonValue} onChange={setEditJsonValue} />
                                </>
                            )}
                            <input ref={editFileInputRef} hidden type="file" onChange={(e) => setEditFile(e.target.files?.[0])} />
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                <Button onClick={() => setEditTarget(null)}>Cancel</Button>
                                <Button variant="contained" className="gradient-btn" onClick={saveEdit} disabled={editSaving || editName.trim().length < 1 || (editTarget.component_type === "datashape" && !editSourceDatasetPid)}>
                                    {editSaving ? "Saving..." : "Save"}
                                </Button>
                            </Stack>
                        </Stack>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
