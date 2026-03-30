import {API_VERSION_PREFIX} from "../config.tsx";
import {Project, PluginFeatureFlags, PluginInputDefinition} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


export const getPlugins = async () => {
    const res = await fetch(`${API_URL}/plugins`);
    return await res.json() as string[];
};

export const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    return await res.json() as Project;
};

export const getPluginFeatureFlags = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/feature_flags`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as PluginFeatureFlags;
};

export const getPluginInputDefinitions = async (plugin_name: string) => {
    if (!plugin_name) throw new Error("Plugin name is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_name}/input_definitions`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as PluginInputDefinition[];
};