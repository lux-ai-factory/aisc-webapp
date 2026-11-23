import { useCallback, useEffect, useState } from "react";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Icon, IconButton,
    Radio, Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import toast from "react-hot-toast";
import { useProject } from "../context/ProjectContext";
import {
    createProjectConfig, getProjectConfigs, getProjectEndpoints, updateProjectConfig,
} from "../api/api";
import { API_VERSION_PREFIX } from "../config";
import { AIComponent } from "../models/models";
import AppDialog from "./AppDialog";
import "../styles/common.css";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
const ASSISTANT_KEY = "ai_assistant";

/** The project-level endpoints the AI assistants and judges use (ADR 0009 D-8).
 *
 * They are plain endpoint components not attached to the assessed system; one may
 * be named as the AI assistant's model by setting the `ai_assistant` project
 * config to its pid, which `services.ai_assistant.resolve_chat` reads first.
 */
export default function AssistantModelsSection() {
    const { projectUUID } = useProject();
    const [endpoints, setEndpoints] = useState<AIComponent[]>([]);
    const [assistantPid, setAssistantPid] = useState<string>("");
    const [settingPid, setSettingPid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [model, setModel] = useState("");
    const [secret, setSecret] = useState("");
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<AIComponent | null>(null);

    const load = useCallback(async () => {
        if (!projectUUID) return;
        setLoading(true);
        try {
            setEndpoints(await getProjectEndpoints(projectUUID));
            const configs = await getProjectConfigs(projectUUID);
            const row = configs.find((c) => c.key === ASSISTANT_KEY);
            setSettingPid(row?.pid ?? null);
            setAssistantPid((row?.json_value?.value as string) ?? "");
        } finally {
            setLoading(false);
        }
    }, [projectUUID]);

    useEffect(() => { void load(); }, [load]);

    const addModel = async () => {
        if (!projectUUID || !name.trim() || !url.trim()) return;
        setSaving(true);
        try {
            const fields: Record<string, unknown> = { url: url.trim() };
            if (model.trim()) fields.model = model.trim();
            if (secret) fields.secret = secret;
            const res = await fetch(`${API_URL}/projects/${projectUUID}/components`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), preset: "llm", fields }),
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { detail?: string } | null;
                toast.error(body?.detail ?? "Could not add the model", { position: "bottom-right" });
                return;
            }
            setOpen(false);
            await load();
        } finally {
            setSaving(false);
        }
    };

    const chooseAssistant = async (pid: string) => {
        if (!projectUUID) return;
        const json_value = { type: "string", value: pid };
        try {
            if (settingPid) {
                await updateProjectConfig(projectUUID, settingPid, { json_value });
            } else {
                const created = await createProjectConfig(projectUUID, {
                    category: "variables", key: ASSISTANT_KEY,
                    name: "AI assistant model", json_value,
                });
                setSettingPid(created.pid);
            }
            setAssistantPid(pid);
            toast.success("AI assistant model updated", { position: "bottom-right" });
        } catch {
            toast.error("Could not update the AI assistant model", { position: "bottom-right" });
        }
    };

    const remove = async () => {
        if (!pendingDelete) return;
        const res = await fetch(`${API_URL}/components/${pendingDelete.pid}`, { method: "DELETE" });
        if (!res.ok) {
            toast.error("Could not delete the model", { position: "bottom-right" });
            return;
        }
        if (assistantPid === pendingDelete.pid) setAssistantPid("");
        setPendingDelete(null);
        await load();
    };

    if (loading) return <CircularProgress />;

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 6, mb: 1 }}>
                <Box>
                    <Typography component="h3" variant="h5" gutterBottom sx={{ mb: 0 }}>
                        AI assistant and judge models
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                        Project-level endpoints the assistants and judges use. The chosen
                        assistant model is used by the risk mapper and the card agent.
                    </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
                    setName(""); setUrl(""); setModel(""); setSecret(""); setOpen(true);
                }} className="gradient-btn">
                    Add model
                </Button>
            </Box>

            {endpoints.length === 0 ? (
                <Typography color="text.secondary">No project-level models yet.</Typography>
            ) : (
                <Stack spacing={1}>
                    {endpoints.map((c) => (
                        <Card key={c.pid} variant="outlined" className="gradient-card">
                            <CardContent sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Radio
                                    checked={assistantPid === c.pid}
                                    onChange={() => void chooseAssistant(c.pid)}
                                    inputProps={{ "aria-label": `Use ${c.name} as the assistant model` }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography fontWeight={600} noWrap>{c.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                        {c.url || "no endpoint"} · {c.adapter || "no adapter"}
                                        {c.has_secret ? " · key set" : " · no key"}
                                    </Typography>
                                </Box>
                                <Chip size="small" label={c.preset === "llm" ? "LLM" : (c.protocol || "endpoint")} />
                                <IconButton size="small" color="error" aria-label={`Delete ${c.name}`} onClick={() => setPendingDelete(c)}>
                                    <Icon fontSize="small">delete</Icon>
                                </IconButton>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}

            <AppDialog
                open={open}
                onClose={() => setOpen(false)}
                maxWidth="sm"
                fullWidth
                title="Add model"
                actions={
                    <>
                        <Button onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="contained" className="gradient-btn" onClick={() => void addModel()} disabled={saving || !name.trim() || !url.trim()}>
                            {saving ? "Adding..." : "Add"}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2}>
                    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                    <TextField label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.openai.com/v1" required />
                    <TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" />
                    <TextField label="API key" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
                </Stack>
            </AppDialog>

            <AppDialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                maxWidth="xs"
                fullWidth
                title="Delete model"
                actions={
                    <>
                        <Button onClick={() => setPendingDelete(null)} variant="outlined">Cancel</Button>
                        <Button variant="contained" color="error" onClick={() => void remove()}>Delete</Button>
                    </>
                }
            >
                <Typography>Delete "{pendingDelete?.name}"? This cannot be undone.</Typography>
            </AppDialog>
        </Box>
    );
}
