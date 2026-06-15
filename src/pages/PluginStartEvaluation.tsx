import { useQuery } from '@tanstack/react-query';
import { API_VERSION_PREFIX } from "../config.tsx";
import { useProject } from "../context/ProjectContext.tsx";
import {Button, Typography, Box, Icon, Tooltip} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { Plugin, PluginInputValue } from "../models/models.tsx";
import toast from "react-hot-toast";
import { getProject } from "../api/api.tsx";
import PluginEvaluationForm from "../components/plugin/PluginEvaluationForm.tsx";


const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type SelectedPluginsState = {
    [pluginName: string]: PluginInputValue[];
}

const createEvaluation = async (project_uuid: string, selectedPlugins: SelectedPluginsState) => {
    if (!project_uuid) throw new Error('Invalid uuid');

    const plugins_to_run = Object.entries(selectedPlugins).map(([name, inputs]) => ({name, inputs}));

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
            const errorMessage = errorData.detail;
            toast.error('Failed to create evaluation\n' + errorMessage, { position: "bottom-right" });
            return;
        }
        toast.error('Failed to create evaluation', { position: "bottom-right" });
        throw new Error('Failed to create evaluation');
    }
    toast.success('Evaluation created', { position: "bottom-right" });
    return await response.json();
};

export default function PluginStartEvaluation() {
    const { projectUUID } = useProject();
    const [selectedPlugins, setSelectedPlugins] = useState<SelectedPluginsState>({});
    const [selectionCache, setSelectionCache] = useState<SelectedPluginsState>({});
    const [activePlugin, setActivePlugin] = useState<string | null>(null);
    const [validPlugins, setValidPlugins] = useState<Record<string, boolean>>({});

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
        await createEvaluation(projectUUID, Object.fromEntries(validEntries));
    };

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
            <Box sx={{display: "flex", justifyContent: "space-between", marginBottom: 5}}>
                <Typography component="h2" variant="h4" gutterBottom>
                    Start an Evaluation
                </Typography>

                <Tooltip title="Create Evaluation">
                    <Button
                        variant="contained"
                        onClick={handleOnClick}
                        disabled={Object.values(validPlugins).filter(Boolean).length === 0}
                        sx={{
                            borderRadius: "10px",
                            fontSize: "0.95rem",
                            fontWeight: 600,
                            textTransform: "none",
                            gap: 1,
                            minWidth: {xs: '44px', md: 'auto'},
                            px: {xs: 1.5, md: 3},
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
                        startIcon={<Icon sx={{fontSize: '1.25rem'}}>play_circle_filled</Icon>}
                    >
                        <Box component="span" sx={{display: {xs: 'none', md: 'inline'}}}>
                            Create Evaluation
                        </Box>
                    </Button>
                </Tooltip>
            </Box>

            <Grid
                container
                spacing={2}
                sx={{
                    '&:hover .start-eval-card': {
                        opacity: 0.74,
                        filter: 'saturate(0.88)',
                    },
                    '& .start-eval-card:hover': {
                        opacity: 1,
                        filter: 'saturate(1.18)',
                        transform: 'translateY(-3px) scale(1.01)',
                    },
                }}
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
