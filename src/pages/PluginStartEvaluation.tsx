import { useQuery } from '@tanstack/react-query';
import { API_VERSION_PREFIX } from "../config.tsx";
import { useProject } from "../context/ProjectContext.tsx";
import {Button, FormGroup, Typography, Box, Icon} from "@mui/material";
import { useState } from "react";
import { Plugin, PluginInputValue } from "../models/models.tsx";
import toast from "react-hot-toast";
import { getProject } from "../api/api.tsx";
import PluginEvaluationForm from "../components/plugin/PluginEvaluationForm.tsx";
import PluginEvaluationsTasks from "./PluginEvaluationsTasks.tsx";


const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type SelectedPluginsState = {
    [pluginName: string]: PluginInputValue[];
}

const createEvaluation = async (project_uuid: string, selectedPlugins: SelectedPluginsState) => {
    if (!project_uuid) throw new Error('Invalid uuid');

    // Transform state to the format expected by the backend
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

    const { data: project, isPending, error } = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? ""),
        enabled: !!projectUUID
    });

    if (isPending) return <span>Loading...</span>;
    if (error) return <span>Oops! Something went wrong.</span>;

    const handleTogglePlugin = (pluginName: string) => {
        setSelectedPlugins(prev => {
            const newState = { ...prev };
            if (newState[pluginName]) {
                delete newState[pluginName];
            } else {
                newState[pluginName] = [];
            }
            return newState;
        });
    };

    const handleUpdateSetting = (pluginName: string, item: PluginInputValue | null, inputName: string) => {
        setSelectedPlugins(prev => ({
            ...prev,
            [pluginName]: item
                ? [...(prev[pluginName]?.filter(i => i.name !== inputName) || []), item]
                : (prev[pluginName]?.filter(i => i.name !== inputName) || [])
        }));
    };

    const handleOnClick = async () => {
        if (!projectUUID) return;
        await createEvaluation(projectUUID, selectedPlugins);
    };

    return (
        <Box sx={{ display: "flex", gap: 4 }}>
            <Box sx={{ flex: 1 }}>
                <Typography component="h2" variant="h4" gutterBottom>
                    Start an Evaluation
                </Typography>

                <FormGroup>
                    {project?.plugins.map((projectPlugin: Plugin) => (
                        <PluginEvaluationForm
                            key={projectPlugin.pid}
                            plugin={projectPlugin}
                            isSelected={!!selectedPlugins[projectPlugin.name]}
                            selections={selectedPlugins[projectPlugin.name] || []}
                            onToggle={() => handleTogglePlugin(projectPlugin.name)}
                            onSelectionChange={(item, inputName) =>
                                handleUpdateSetting(projectPlugin.name, item, inputName)
                            }
                        />
                    ))}
                </FormGroup>

                <Button
                    variant="contained"
                    onClick={handleOnClick}
                    disabled={Object.keys(selectedPlugins).length === 0}
                    sx={{ mt: 2 }}
                >
                    <Icon>play_arrow</Icon>
                    Create Evaluation
                </Button>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    borderLeft: "2px solid rgba(255,255,255,0.1)",
                    paddingLeft: 3,
                }}
            >
                <PluginEvaluationsTasks />
            </Box>
        </Box>
    );
}