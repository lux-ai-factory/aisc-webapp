import {API_VERSION_PREFIX} from "../config.tsx";
import {Project, PluginFeatureFlags, PluginInputDefinition, Package} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


export const getPlugins = async () => {
    const res = await fetch(`${API_URL}/plugins`);
    return await res.json() as Package[];
};

export const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    return await res.json() as Project;
};

export const getPluginFeatureFlags = async (plugin_pid: string) => {
    if (!plugin_pid) throw new Error("Plugin PID is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/feature_flags`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as PluginFeatureFlags;
};

export const getPluginInputDefinitions = async (plugin_pid: string) => {
    if (!plugin_pid) throw new Error("Plugin PID is required");

    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/input_definitions`);
    if (!res.ok) throw new Error('Network response was not ok');

    return await res.json() as PluginInputDefinition[];
};