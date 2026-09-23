import { useCallback, useEffect, useRef, useState } from "react";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
    DialogContent, DialogTitle, Divider, IconButton, List, ListItem, ListItemText,
    MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkIcon from "@mui/icons-material/Link";
import { useProject } from "../context/ProjectContext";
import { getProjectConfigs } from "../api/api";
import { API_VERSION_PREFIX } from "../config";
import { AIComponent, AIComponentType, ProjectConfig } from "../models/models";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

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
    const { projectUUID } = useProject();
    const [systemInfo, setSystemInfo] = useState<{ pid: string; name: string } | null>(null);
    const [components, setComponents] = useState<AIComponent[]>([]);
    const [secrets, setSecrets] = useState<ProjectConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    // add-dialog state
    const [name, setName] = useState("");
    const [type, setType] = useState<AIComponentType>("model");
    const [file, setFile] = useState<File | undefined>();
    const [addLlmUrl, setAddLlmUrl] = useState("");
    const [addSecretKey, setAddSecretKey] = useState("");
    const [addResourceValue, setAddResourceValue] = useState("");
    const [sourceDatasetPid, setSourceDatasetPid] = useState("");
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const refresh = useCallback(async () => {
        if (!projectUUID) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects/${projectUUID}/aisystem`);
            if (res.ok) {
                const data = await res.json();
                setSystemInfo({ pid: data.pid, name: data.name });
                setComponents(data.components ?? []);
            }
            const settings = await getProjectConfigs(projectUUID);
            setSecrets(settings.filter(s => s.category === "secrets"));
        } finally {
            setLoading(false);
        }
    }, [projectUUID]);

    useEffect(() => { refresh(); }, [refresh]);

    const openDialog = async () => {
        setName("");
        setType("model");
        setFile(undefined);
        setAddLlmUrl("");
        setAddSecretKey("");
        setAddResourceValue("");
        setSourceDatasetPid("");
        if (projectUUID) {
            try {
                const settings = await getProjectConfigs(projectUUID);
                setSecrets(settings.filter(s => s.category === "secrets"));
            } catch { /* keep current secrets on failure */ }
        }
        setOpen(true);
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
            if (type === "datashape") { payload.source_dataset_pid = sourceDatasetPid; }
            const res = await fetch(`${API_URL}/projects/${projectUUID}/components`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return;
            const created = await res.json();
            if ((type === "model" || type === "dataset") && file) {
                const formData = new FormData();
                formData.append("file", file);
                await fetch(`${API_URL}/components/${created.pid}/data`, { method: "PUT", body: formData });
            }
            setOpen(false);
            refresh();
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
                payload.json_value = editJsonValue;
            }
            const res = await fetch(`${API_URL}/components/${editTarget.pid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return;
            if ((editTarget.component_type === "model" || editTarget.component_type === "dataset") && editFile) {
                const formData = new FormData();
                formData.append("file", editFile);
                await fetch(`${API_URL}/components/${editTarget.pid}/data`, { method: "PUT", body: formData });
            }
            setEditTarget(null);
            refresh();
        } finally {
            setEditSaving(false);
        }
    };

    if (loading) return <CircularProgress />;

    const summary = (c: AIComponent) => {
        const json = (c.json_value ?? {}) as Record<string, unknown>;
        switch (c.component_type) {
            case "model": case "dataset":
                return c.data ? "file uploaded" : "no file";
            case "llm":
                return `${json.endpoint_url || "no endpoint"} · key: ${json.secret_key ? (json.secret_key as string) : "none"}`;
            case "resource":
                return json.value ? String(json.value) : "no value";
            case "datashape": {
                const features = (json.features as unknown[]) ?? [];
                return c.source_dataset_pid ? `${features.length} features from dataset` : "no source dataset";
            }
            default:
                return c.component_type;
        }
    };

    const canAdd = name.trim().length > 0
        && !((type === "model" || type === "dataset") && !file)
        && !(type === "llm" && (!addLlmUrl.trim() || !addSecretKey))
        && !(type === "resource" && !addResourceValue.trim())
        && !(type === "datashape" && !sourceDatasetPid);

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
                <List>
                    {components.map((c) => (
                        <ListItem key={c.pid} secondaryAction={
                            <Stack direction="row" spacing={0.5}>
                                <IconButton edge="end" size="small" onClick={() => startEdit(c)}><EditIcon fontSize="small" /></IconButton>
                                <IconButton edge="end" size="small" onClick={() => remove(c.pid)}><DeleteIcon fontSize="small" /></IconButton>
                            </Stack>
                        }>
                            <ListItemText
                                primary={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="body1">{c.name}</Typography><Chip size="small" label={c.component_type} /></Stack>}
                                secondary={summary(c)}
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            {/* Add dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add component</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as AIComponentType)}>
                            {COMPONENT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                        </TextField>
                        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                        {(type === "model" || type === "dataset") && (
                            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
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
                            <TextField select label="Source dataset" value={sourceDatasetPid} onChange={(e) => setSourceDatasetPid(e.target.value)}>
                                {datasetComponents.map(d => <MenuItem key={d.pid} value={d.pid}>{d.name}</MenuItem>)}
                            </TextField>
                        )}
                        <input ref={fileInputRef} hidden type="file" onChange={(e) => setFile(e.target.files?.[0])} />
                        <Stack direction="row" justifyContent="flex-end" spacing={1}>
                            <Button onClick={() => setOpen(false)}>Cancel</Button>
                            <Button variant="contained" onClick={addComponent} disabled={saving || !canAdd}>
                                {saving ? "Adding..." : "Add"}
                            </Button>
                        </Stack>
                    </Stack>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="md" fullWidth>
                <DialogTitle>Edit component</DialogTitle>
                <DialogContent>
                    {editTarget && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                            {(editTarget.component_type === "model" || editTarget.component_type === "dataset") && (
                                <Button variant="outlined" onClick={() => editFileInputRef.current?.click()}>
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
                                <Button variant="contained" onClick={saveEdit} disabled={editSaving || editName.trim().length < 1 || (editTarget.component_type === "datashape" && !editSourceDatasetPid)}>
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
