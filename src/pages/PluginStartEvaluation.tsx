import { useQuery } from '@tanstack/react-query';
import { API_VERSION_PREFIX } from "../config.tsx";
import { useProject } from "../context/ProjectContext.tsx";
import {Button, Typography, Box, Tooltip, Alert, Stack} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { Plugin, PluginInputValue } from "../models/models.tsx";
import toast from "react-hot-toast";
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { getProject } from "../api/api.tsx";
import { useNavigate } from "react-router-dom";
import PluginEvaluationForm from "../components/plugin/PluginEvaluationForm.tsx";
import './PluginStartEvaluation.css';
import '../styles/common.css';


const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type PluginSelection = PluginInputValue;

type SelectedPluginsState = {
    [pluginName: string]: PluginSelection[];
}

const createEvaluation = async (project_uuid: string, selectedPlugins: SelectedPluginsState) => {
    if (!project_uuid) throw new Error('Invalid uuid');

    const plugins_to_run = Object.entries(selectedPlugins).map(([name, inputs]) => ({
        name,
        inputs: inputs.filter(input => input.input_type !== 'datashape'),
    }));

    const data = {
        project_pid: project_uuid,
        plugins_to_run
    };

    const response = await fetch(`${API_URL}/evaluations/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData.detail));
        }
        toast.error('Failed to create evaluation', { position: "bottom-right" });
        throw new Error('Failed to create evaluation');
    }
    toast.success('Evaluation created', { position: "bottom-right" });
    sessionStorage.removeItem(STORAGE_KEY);
    return await response.json();
};

const STORAGE_KEY = 'start-eval-state';

function loadState(): { selectedPlugins: SelectedPluginsState; selectionCache: SelectedPluginsState } {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return { selectedPlugins: {}, selectionCache: {} };
}

function saveState(selectedPlugins: SelectedPluginsState, selectionCache: SelectedPluginsState) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedPlugins, selectionCache }));
    } catch {}
}

export default function PluginStartEvaluation() {
    const { projectUUID } = useProject();
    const [selectedPlugins, setSelectedPlugins] = useState<SelectedPluginsState>(loadState().selectedPlugins);
    const [selectionCache, setSelectionCache] = useState<SelectedPluginsState>(loadState().selectionCache);
    const [activePlugin, setActivePlugin] = useState<string | null>(null);
    const [validPlugins, setValidPlugins] = useState<Record<string, boolean>>({});
    const [dispatchError, setDispatchError] = useState<{ message: string; missing: Array<Record<string, string>>; invalid: Array<Record<string, string>>; ambiguous: Array<Record<string, string>> } | null>(null);
    const navigate = useNavigate();

    const { data: project, isPending, error } = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? ""),
        enabled: !!projectUUID
    });

    const handleTogglePlugin = (pluginName: string) => {
        if (activePlugin === pluginName && selectedPlugins[pluginName]) {
            setActivePlugin(null);
            setSelectionCache(prev => ({
                ...prev,
                [pluginName]: selectedPlugins[pluginName] ?? prev[pluginName] ?? []
            }));
            setSelectedPlugins(prev => {
                const newState = { ...prev };
                delete newState[pluginName];
                return newState;
            });
        } else {
            setActivePlugin(pluginName);
            if (!selectedPlugins[pluginName]) {
                setSelectedPlugins(prev => ({ ...prev, [pluginName]: selectionCache[pluginName] ?? [] }));
            }
        }
    };

    const handleUpdateSetting = (pluginName: string, item: PluginInputValue | null, inputName: string) => {
        setSelectedPlugins(prev => ({
            ...prev,
            [pluginName]: item
                ? [...(prev[pluginName]?.filter(i => i.name !== inputName) || []), item]
                : (prev[pluginName]?.filter(i => i.name !== inputName) || [])
        }));
    };

    const handleUnselectPlugin = (pluginName: string) => {
        setSelectionCache(prev => ({
            ...prev,
            [pluginName]: selectedPlugins[pluginName] ?? prev[pluginName] ?? []
        }));
        setSelectedPlugins(prev => {
            const next = {...prev};
            delete next[pluginName];
            return next;
        });
        setValidPlugins(prev => ({...prev, [pluginName]: false}));
        if (activePlugin === pluginName) {
            setActivePlugin(null);
        }
    };

    const handleOnClick = async () => {
        if (!projectUUID) return;
        const validEntries = Object.entries(selectedPlugins).filter(([name]) => validPlugins[name]);
        if (validEntries.length === 0) return;
        setDispatchError(null);
        try {
            await createEvaluation(projectUUID, Object.fromEntries(validEntries));
        } catch (error) {
            try {
                const detail = JSON.parse(error instanceof Error ? error.message : '');
                if (detail && typeof detail === 'object') {
                    setDispatchError({ message: detail.message ?? 'Required project settings are missing or invalid', missing: detail.missing ?? [], invalid: detail.invalid ?? [], ambiguous: detail.ambiguous ?? [] });
                    return;
                }
            } catch { /* display the generic error below */ }
            toast.error(error instanceof Error ? error.message : 'Failed to create evaluation', { position: 'bottom-right' });
        }
    };

    useEffect(() => {
        saveState(selectedPlugins, selectionCache);
    }, [selectedPlugins, selectionCache]);

    useEffect(() => {
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;

            const clickedInsideCard = Boolean(target.closest('[data-plugin-card]'));
            const clickedDropdownSurface = Boolean(
                target.closest('.MuiPopover-root, .MuiMenu-root, .MuiMenu-paper, [role="listbox"], [role="option"]')
            );

            if (!clickedInsideCard && !clickedDropdownSurface) {
                setActivePlugin(null);
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, []);

    if (isPending) return <span>Loading...</span>;
    if (error) return <span>Oops! Something went wrong.</span>;

    return (
        <Box>
            <Box sx={{display: "flex", justifyContent: "space-between", alignItems: 'center', marginBottom: 2}}>
                <Typography component="h2" variant="h4" gutterBottom>
                    Start an Evaluation
                </Typography>

                <Tooltip title="Create Evaluation">
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        onClick={handleOnClick}
                        disabled={Object.values(validPlugins).filter(Boolean).length === 0}
                        sx={{
                            minWidth: {xs: '44px', md: 'auto'},
                            px: {xs: 1.5, md: 3},
                        }}
                    >
                        <PlayCircleIcon />
                        <Box component="span" sx={{display: {xs: 'none', md: 'inline'}}}>
                            Create Evaluation
                        </Box>
                    </Button>
                </Tooltip>
            </Box>

            {dispatchError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography fontWeight={700}>{dispatchError.message}</Typography>
                    <Stack spacing={0.25} sx={{ mt: 1 }}>
                        {[...dispatchError.missing, ...dispatchError.invalid, ...dispatchError.ambiguous].map((item, index) => (
                            <Typography key={`${item.plugin}-${item.setting}-${index}`} variant="body2">
                                {item.plugin}: {item.setting}{item.reason ? ` - ${item.reason}` : ''}
                            </Typography>
                        ))}
                    </Stack>
                    <Button size="small" sx={{ mt: 1 }} onClick={() => navigate(`/projects/${project?.name}/settings`)}>
                        Go to Project Settings
                    </Button>
                </Alert>
            )}

            <Grid
                container
                spacing={2}
                className="start-eval-grid"
            >
                {project?.plugins.filter(p => p.enabled).map((projectPlugin: Plugin) => (
                    <Grid key={projectPlugin.pid} size={{xs: 12, sm: 12, md: 6, lg: 4}}>
                        <PluginEvaluationForm
                            className="start-eval-card"
                            plugin={projectPlugin}
                                isConfigured={!!selectedPlugins[projectPlugin.name]}
                                isActive={activePlugin === projectPlugin.name}
                                selections={selectedPlugins[projectPlugin.name] || []}
                                onToggle={() => handleTogglePlugin(projectPlugin.name)}
                                onUnselect={() => handleUnselectPlugin(projectPlugin.name)}
                                onSelectionChange={(item, inputName) =>
                                    handleUpdateSetting(projectPlugin.name, item, inputName)
                                }
                                onValidationChange={(valid) => setValidPlugins(prev => ({ ...prev, [projectPlugin.name]: valid }))}
                            />
                        </Grid>
                    ))}
                </Grid>
        </Box>
    );
}
