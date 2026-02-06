import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import PluginConfigForm from "../components/plugin/PluginConfigForm.tsx";
import {useEffect, useState} from "react";
import {DataObject, ProjectPluginConfigState} from "../models/models.tsx";
import toast from 'react-hot-toast';
import {getPluginFeatureFlags, getProject} from "../api/api.tsx";
import {InputLabel, MenuItem, Select, SelectChangeEvent, Typography} from "@mui/material";
import InfoBanner from "../components/InfoBanner.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


const postPluginConfig = async (plugin_name: string, uuid: string, formData: object) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    if (!uuid) throw new Error('Invalid uuid');

    const data = {
        name: plugin_name,
        project_uuid: uuid,
        config: formData,
    }
    const response = await fetch(`${API_URL}/plugins`, {
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

const parseConfigStateFromDataset = async (plugin_name: string, dataset_uuid: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    if (!dataset_uuid) throw new Error('Invalid dataset uuid');

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/parse_dataset/${dataset_uuid}/config/state`);
    if (!res.ok) {
        toast.error('Failed to parse config from dataset', {position: "bottom-right"});
        throw new Error('Failed to submit form');
    }

    toast.success('Config parsed from dataset', {position: "bottom-right"});
    return await res.json() as ProjectPluginConfigState;
};

const getProjectPluginConfigState = async (project_uuid: string, plugin_name: string) => {
    if (!project_uuid) throw new Error('Invalid project UUID');
    if (!plugin_name) throw new Error("Plugin name is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/project/${project_uuid}/config/state`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as ProjectPluginConfigState;
};


function PluginConfig() {
    const {plugin_name} = useParams();
    const {projectUUID} = useProject();

    const [configState, setConfigState] = useState<ProjectPluginConfigState | null>(null);

    const {data: project, isPending: isProjectPending} = useQuery({
        queryKey: ['project'],
        queryFn: () => getProject(projectUUID!!),
        enabled: !!projectUUID
    })

    const {data: projectPluginConfigState, isPending: isProjectPluginConfigStatePending, error} = useQuery({
        queryKey: ['projectPluginConfig'],
        queryFn: () => getProjectPluginConfigState(projectUUID!!, plugin_name!!),
        enabled: !!projectUUID && !!plugin_name
    })

    const {data: featureFlags} = useQuery({
        queryKey: ['featureFlags'],
        queryFn: () => getPluginFeatureFlags(plugin_name!!),
        enabled: !!plugin_name
    })

    useEffect(() => {
        if (projectPluginConfigState) setConfigState(projectPluginConfigState);
    }, [projectPluginConfigState]);

    const isPending = isProjectPending || isProjectPluginConfigStatePending;

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleDatasetChange = async (e: SelectChangeEvent<any>) => {
        const dataset_uuid = e.target.value as string;
        if (!dataset_uuid) return;
        const configState = await parseConfigStateFromDataset(plugin_name ?? "", dataset_uuid);
        setConfigState(configState);
    };


    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Config for plugin: {plugin_name}
            </Typography>

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

            {configState &&
                <PluginConfigForm
                    key={plugin_name ?? "" + projectUUID ?? ""}
                    pluginName={plugin_name ?? ""}
                    formSchema={configState.formSchema}
                    uiSchema={configState.uiSchema}
                    config={configState.config}
                    onFormUpdate={(state) => setConfigState(state)}
                    onSubmit={(data) => postPluginConfig(plugin_name ?? "", projectUUID ?? "", data)}
                />
            }
        </>
    )
}

export default PluginConfig
