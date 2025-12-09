import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {useParams} from "react-router-dom";
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import {useEffect, useState} from "react";


const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


const postPluginConfig = async (plugin_name: string, uuid: string, formData: object) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    if (!uuid) throw new Error('Invalid uuid');
    const data = {
        name: plugin_name,
        project_uuid: uuid,
        config: formData,
    }
    const response = await fetch(`${API_URL}/app/plugins/${plugin_name}`, {
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

const getPluginConfig = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");
    const res = await fetch(`${API_URL}/app/plugins/${plugin_name}/config`);
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
    const [formData, setFormData] = useState(null);
    const { plugin_name } = useParams();

    const {data: pluginConfig, isPending, error} = useQuery({
        queryKey: ['pluginConfig'],
        queryFn: () => getPluginConfig(plugin_name ?? ""),
    })

    console.log(pluginConfig);

    const { projectUUID } = useProject();

    const {data: projectPluginConfig} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProjectPluginConfig(projectUUID  ?? "", plugin_name ?? "")
    })

    useEffect(() => {
        if (projectPluginConfig) {
            setFormData(projectPluginConfig);
        }
    }, [projectPluginConfig]);

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    return (
        <div>
            <h2>Config for plugin: {plugin_name}</h2>

            <Form
                schema={pluginConfig}
                validator={validator}
                formData={formData}
                onChange={(e) => setFormData(e.formData)}
                onSubmit={({ formData }) => postPluginConfig(plugin_name ?? "", projectUUID  ?? "", formData)}
            />
        </div>
    )
}

export default PluginConfig