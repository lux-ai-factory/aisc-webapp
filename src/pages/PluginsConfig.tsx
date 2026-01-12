import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import Form from '@rjsf/react-bootstrap';
import validator from '@rjsf/validator-ajv8';

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
        throw new Error('Failed to submit form');
    }
    return response.json();
};

const getPluginConfigSchema = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/config_schema`);
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
};

const getPluginConfigUiSchema = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/config_ui_schema`);
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
};

const getProjectPluginConfig = async (uuid: string, plugin_name: string) =>  {
    if (!uuid) throw new Error('Invalid uuid');
    if (!plugin_name) throw new Error("Plugin name is required");
    const res = await fetch(`${API_URL}/projects/${uuid}/plugins/${plugin_name}/config`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};


function PluginConfig() {
    const { plugin_name } = useParams();
    const { projectUUID } = useProject();

    const {data: pluginConfigSchema} = useQuery({
        queryKey: ['pluginConfigSchema'],
        queryFn: () => getPluginConfigSchema(plugin_name ?? ""),
    })

    const {data: pluginConfigUiSchema} = useQuery({
        queryKey: ['pluginConfigUiSchema'],
        queryFn: () => getPluginConfigUiSchema(plugin_name ?? ""),
    })

    const {data: projectPluginConfig, isPending, error} = useQuery({
        queryKey: ['projectPluginConfig'],
        queryFn: () => getProjectPluginConfig(projectUUID  ?? "", plugin_name ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    console.log(pluginConfigSchema)
    console.log(pluginConfigUiSchema)
    console.log(projectPluginConfig)

    return (
        <div className="container py-5">
            <h2>Config for plugin: {plugin_name}</h2>
            <Form
                schema={pluginConfigSchema}
                uiSchema={pluginConfigUiSchema}
                validator={validator}
                formData={projectPluginConfig}
                onSubmit={({ formData }) => postPluginConfig(plugin_name ?? "", projectUUID  ?? "", formData)}
            />
        </div>
    )
}

export default PluginConfig