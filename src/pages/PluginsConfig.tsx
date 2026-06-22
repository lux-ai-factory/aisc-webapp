import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import PluginConfigForm from "../components/plugin/PluginConfigForm.tsx";
import {useLayoutEffect, useRef, useState} from "react";
import {DataObject, ProjectPluginConfigState} from "../models/models.tsx";
import toast from 'react-hot-toast';
import {getPluginFeatureFlags, getProject} from "../api/api.tsx";
import {InputLabel, MenuItem, Select, SelectChangeEvent, Typography, Box, Button, Icon, Tooltip} from "@mui/material";
import InfoBanner from "../components/InfoBanner.tsx";
import ConfigHistory from "../components/plugin/ConfigHistory.tsx";
import './PluginsConfig.css';
import '../styles/common.css';

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

    const [configOverride, setConfigOverride] = useState<ProjectPluginConfigState | null>(null);
    const [selectedDataset, setSelectedDataset] = useState('');
    const lastDatasetPluginPid = useRef<string | undefined>();

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
        queryFn: async () => {
            const state = await getProjectPluginConfigState(plugin_pid!!);
            return { ...state, config: {} };
        },
        enabled: !!projectUUID && !!plugin_pid,
    })

    const {data: featureFlags} = useQuery({
        queryKey: ['featureFlags', plugin_pid],
        queryFn: () => getPluginFeatureFlags(plugin_pid!!),
        enabled: !!plugin_pid
    })

    const configState = configOverride ?? projectPluginConfigState;

    useLayoutEffect(() => {
        if (lastDatasetPluginPid.current && lastDatasetPluginPid.current !== plugin_pid) {
            setSelectedDataset('');
            setConfigOverride(null);
        }
        lastDatasetPluginPid.current = plugin_pid;
    }, [plugin_pid]);

    const isPending = isProjectPending || isProjectPluginConfigStatePending;

    const formRef = useRef<any>(null);

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleDatasetChange = async (e: SelectChangeEvent<any>) => {
        const dataset_uuid = e.target.value as string;
        if (!dataset_uuid || !plugin_pid) return;
        setSelectedDataset(dataset_uuid);
        const parsed = await parseConfigStateFromDataset(plugin_pid, dataset_uuid);
        setConfigOverride(parsed);
    };

    const handleRestore = async () => {
        if (!plugin_pid) return;
        const state = await getProjectPluginConfigState(plugin_pid!!);
        setConfigOverride(state);
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
                <Box>
                    <Typography component="h2" variant="h4" sx={{lineHeight: 1.2}}>
                        {plugin?.display_name || plugin_name}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" sx={{fontWeight: 500, mt: 0.25}}>
                        Configuration
                    </Typography>
                </Box>

                <Box sx={{display: "flex", gap: 1.5}}>
                    <Tooltip title="Export">
                        <Button
                            variant="outlined"
                            sx={{borderRadius: "10px", textTransform: "none", fontSize: "0.9rem", fontWeight: 600, minWidth: {xs: '44px', md: 'auto'}, px: {xs: 1.5, md: 2}}}
                            onClick={() => formRef.current?.exportJson()}
                        >
                            <Icon sx={{fontSize: '1.25rem'}}>file_download</Icon>
                            <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, ml: 0.5}}>
                                Export
                            </Box>
                        </Button>
                    </Tooltip>
                    <Tooltip title="Import">
                        <Button
                            variant="outlined"
                            sx={{borderRadius: "10px", textTransform: "none", fontSize: "0.9rem", fontWeight: 600, minWidth: {xs: '44px', md: 'auto'}, px: {xs: 1.5, md: 2}}}
                            onClick={() => formRef.current?.importClick()}
                        >
                            <Icon sx={{fontSize: '1.25rem'}}>file_upload</Icon>
                            <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, ml: 0.5}}>
                                Import
                            </Box>
                        </Button>
                    </Tooltip>
                    <Tooltip title="Save Configuration">
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            sx={{
                                minWidth: {xs: '44px', md: 'auto'},
                                px: {xs: 1.5, md: 2},
                            }}
                            onClick={() => formRef.current?.submit()}
                        >
                            <Icon sx={{fontSize: '1.25rem'}}>save</Icon>
                            <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, ml: 0.5}}>
                                Save
                            </Box>
                        </Button>
                    </Tooltip>
                </Box>
            </Box>

            <ConfigHistory
                pluginPID={plugin_pid ?? ""}
                plugin_config_id={configState?.plugin_config_id}
                onRestore={handleRestore}
            />

            {featureFlags?.can_parse_config_from_dataset &&
                <>
                    <InfoBanner message={"Select a dataset to derive the plugin config from."}/>
                    <InputLabel id="dataset-select-label">Dataset</InputLabel>
                    <Select
                        labelId="dataset-select-label"
                        fullWidth
                        className="plugin-config-select"
                        sx={{
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                            },
                        }}
                        MenuProps={{
                            PaperProps: {
                                className: 'plugin-config-menu',
                            },
                        }}
                        value={selectedDataset}
                        onChange={(e) => handleDatasetChange(e)}
                    >
                        {project?.datasets.map((dataset: DataObject) => (
                            <MenuItem key={dataset.pid} value={dataset.pid}>{dataset.name}</MenuItem>
                        ))}
                    </Select>
                </>
            }

            {configState && plugin_pid &&
                <PluginConfigForm
                    ref={formRef}
                    key={plugin_pid + projectUUID}
                    pluginPID={plugin_pid}
                    pluginDisplayName={plugin?.display_name}
                    formSchema={configState.formSchema}
                    uiSchema={configState.uiSchema}
                    config={configState.config ?? {}}
                    onFormUpdate={(state) => setConfigOverride(state)}
                    onSubmit={onSubmit}
                />
            }
        </Box>
    )
}

export default PluginConfig
