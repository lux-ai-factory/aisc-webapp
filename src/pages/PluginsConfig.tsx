import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import PluginConfigForm from "../components/PluginConfigForm";
import {useEffect, useState} from "react";
import {DataObject, PluginFeatureFlags, Project, ProjectPluginConfigState} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json() as Project;
};

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
        throw new Error('Failed to submit form');
    }
    return await response.json();
};

const parseConfigStateFromDataset = async (plugin_name: string, dataset_uuid: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    if (!dataset_uuid) throw new Error('Invalid dataset uuid');

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/parse_dataset/${dataset_uuid}/config/state`);
    if (!res.ok) throw new Error('Failed to submit form');

    return await res.json() as ProjectPluginConfigState;
};

const getProjectPluginConfigState = async (project_uuid: string, plugin_name: string) => {
    if (!project_uuid) throw new Error('Invalid project UUID');
    if (!plugin_name) throw new Error("Plugin name is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/project/${project_uuid}/config/state`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as ProjectPluginConfigState;
};

const getPluginFeatureFlags = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/feature_flags`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as PluginFeatureFlags;
};


function PluginConfig() {
    const {plugin_name} = useParams();
    const {projectUUID} = useProject();

    // Local state for dataset override (as before)
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

    const handleDatasetChange = async (dataset_uuid: string) => {
        if (!dataset_uuid) return;
        try {
            const configState = await parseConfigStateFromDataset(plugin_name ?? "", dataset_uuid);
            if (configState) setConfigState(configState);
        } catch (err) {
            console.error("Error during dataset change: ", err);
        }
    };


    return (
        <div className="container py-5">
            <h2>Config for plugin: {plugin_name}</h2>

            {featureFlags?.can_parse_config_from_dataset &&
                <>
                    <label htmlFor="Dataset">Set config from dataset:</label>
                    <select name="Dataset"
                        onChange={(e) => handleDatasetChange(e.target.value)}>
                        <option>Select Dataset</option>
                        {project?.datasets.map((dataset: DataObject) => (
                            <option value={dataset.pid}>{dataset.name}</option>
                        ))}
                    </select>
                </>
            }

            {configState &&
                <PluginConfigForm
                    key={plugin_name ?? "" + projectUUID ?? ""}
                    pluginName={plugin_name ?? ""}
                    schema={configState.schema}
                    uiSchema={configState.uiSchema}
                    config={configState.config}
                    onFormUpdate={(state) => setConfigState(state)}
                    onSubmit={(data) => postPluginConfig(plugin_name ?? "", projectUUID ?? "", data)}
                />
            }
        </div>
    )
}

export default PluginConfig