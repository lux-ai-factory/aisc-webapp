import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import PluginConfigForm from "../components/plugin/PluginConfigForm.tsx";
import {useEffect, useRef, useState} from "react";
import {DataObject, ProjectPluginConfigState} from "../models/models.tsx";
import toast from 'react-hot-toast';
import {getPluginFeatureFlags, getProject} from "../api/api.tsx";
import {InputLabel, MenuItem, Select, SelectChangeEvent, Typography, Box, Button, Icon} from "@mui/material";
import InfoBanner from "../components/InfoBanner.tsx";
import ConfigHistory from "../components/plugin/ConfigHistory.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


const postPluginConfig = async (plugin_pid: string, formData: object) => {
    if (!plugin_pid) throw new Error("Plugin name is required");

    const data = {
        config: formData,
    }
    const response = await fetch(`${API_URL}/plugins/${plugin_pid}/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        toast.error('Failed to save plugin config', {position: "bottom-right"});
        throw new Error('Failed to save plugin config');
    }
    toast.success('Plugin config saved', {position: "bottom-right"});
    return await response.json();
};

const parseConfigStateFromDataset = async (plugin_pid: string, dataset_uuid: string) => {
    if (!plugin_pid) throw new Error("Plugin PID is required");
    if (!dataset_uuid) throw new Error('Invalid dataset uuid');

    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/parse_dataset/${dataset_uuid}/config/state`);
    if (!res.ok) {
        toast.error('Failed to parse config from dataset', {position: "bottom-right"});
        throw new Error('Failed to submit form');
    }

    toast.success('Config parsed from dataset', {position: "bottom-right"});
    return await res.json() as ProjectPluginConfigState;
};

const getProjectPluginConfigState = async (plugin_pid: string) => {
    if (!plugin_pid) throw new Error("Plugin PID is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/config/state`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as ProjectPluginConfigState;
};


function PluginConfig() {
    const {plugin_name} = useParams();
    const {projectUUID} = useProject();
    const queryClient = useQueryClient();

    const [configState, setConfigState] = useState<ProjectPluginConfigState | null>(null);

    const {data: project, isPending: isProjectPending} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID!!),
        enabled: !!projectUUID
    })

    // Find plugin PID from name
    const plugin = project?.plugins.find(p => p.name === plugin_name);
    const plugin_pid = plugin?.pid;

    const {data: projectPluginConfigState, isPending: isProjectPluginConfigStatePending, error} = useQuery({
        queryKey: ['projectPluginConfig', projectUUID, plugin_pid],
        queryFn: () => getProjectPluginConfigState(plugin_pid!!),
        enabled: !!projectUUID && !!plugin_pid
    })

    const {data: featureFlags} = useQuery({
        queryKey: ['featureFlags', plugin_pid],
        queryFn: () => getPluginFeatureFlags(plugin_pid!!),
        enabled: !!plugin_pid
    })

    useEffect(() => {
        if (projectPluginConfigState) setConfigState(projectPluginConfigState);
    }, [projectPluginConfigState]);

    const isPending = isProjectPending || isProjectPluginConfigStatePending;

    const formRef = useRef<any>(null);

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleDatasetChange = async (e: SelectChangeEvent<any>) => {
        const dataset_uuid = e.target.value as string;
        if (!dataset_uuid || !plugin_pid) return;
        const configState = await parseConfigStateFromDataset(plugin_pid, dataset_uuid);
        setConfigState(configState);
    };


    const onSubmit = async (data: object) => {
        await postPluginConfig(plugin_pid ?? "", data);

        // Refresh config history
        await queryClient.invalidateQueries({ queryKey: ['pluginConfigHistory', plugin_pid] });

        // Refresh project so LeftBar updates instantly
        await queryClient.invalidateQueries({ queryKey: ['project', projectUUID] });
    };


    return (

        <Box>
            <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3}}>
                <Typography component="h2" variant="h4">
                    Config for plugin: {plugin?.display_name || plugin_name}
                </Typography>

                <Box sx={{display: "flex", gap: 1.5}}>
                    <Button
                        variant="outlined"
                        startIcon={<Icon>file_download</Icon>}
                        sx={{borderRadius: "10px", textTransform: "none", fontSize: "0.9rem", fontWeight: 600}}
                        onClick={() => formRef.current?.exportJson()}
                    >
                        Export
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<Icon>file_upload</Icon>}
                        sx={{borderRadius: "10px", textTransform: "none", fontSize: "0.9rem", fontWeight: 600}}
                        onClick={() => formRef.current?.importClick()}
                    >
                        Import
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Icon>save</Icon>}
                        sx={{
                            borderRadius: "10px",
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            textTransform: "none",
                            gap: 1,
                            background: "linear-gradient(135deg, #4A8CFF, #00e676)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            "&:hover": {
                                background: "linear-gradient(135deg, #5A9CFF, #00e676)",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.25)"
                            }
                        }}
                        onClick={() => formRef.current?.submit()}
                    >
                        Save Configuration
                    </Button>
                </Box>
            </Box>

            <ConfigHistory
                pluginPID={plugin_pid ?? ""}
                plugin_config_id={projectPluginConfigState?.plugin_config_id}
            />

            {featureFlags?.can_parse_config_from_dataset &&
                <>
                    <InfoBanner message={"Select a dataset to derive the plugin config from."}/>
                    <InputLabel id="dataset-select-label">Dataset</InputLabel>
                    <Select
                        labelId="dataset-select-label"
                        fullWidth
                        onChange={(e) => handleDatasetChange(e)}
                    >
                        {project?.datasets.map((dataset: DataObject) => (
                            <MenuItem value={dataset.pid}>{dataset.name}</MenuItem>
                        ))}
                    </Select>
                </>
            }

            {configState && plugin_pid &&
                <PluginConfigForm
                    ref={formRef}
                    key={plugin_pid + projectUUID}
                    pluginPID={plugin_pid}
                    formSchema={configState.formSchema}
                    uiSchema={configState.uiSchema}
                    config={configState.config}
                    onFormUpdate={(state) => setConfigState(state)}
                    onSubmit={onSubmit}
                />
            }
        </Box>
    )
}

export default PluginConfig
