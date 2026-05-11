import {API_VERSION_PREFIX} from "../config.tsx";
import {Project, PluginFeatureFlags, PluginInputDefinition, Package,
ProjectStatsOverview,
    MetricScoreSummary,
    PluginUsageSummary,
    PluginRunDuration,} from "../models/models.tsx";

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

// Stats API

export const getProjectStatsOverview = async (projectPid: string): Promise<ProjectStatsOverview> => {
    const res = await fetch(`${API_URL}/stats/projects/${projectPid}/overview`);
    if (!res.ok) throw new Error('Failed to fetch project stats overview');
    return await res.json();
};

export const getProjectMetricBreakdown = async (projectPid: string): Promise<{ metrics: MetricScoreSummary[] }> => {
    const res = await fetch(`${API_URL}/stats/projects/${projectPid}/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metric breakdown');
    return await res.json();
};

export const getProjectPluginUsage = async (projectPid: string): Promise<{ plugins: PluginUsageSummary[] }> => {
    const res = await fetch(`${API_URL}/stats/projects/${projectPid}/plugins`);
    if (!res.ok) throw new Error('Failed to fetch plugin usage');
    return await res.json();
};

export const getProjectPluginDurations = async (projectPid: string): Promise<{ runs: PluginRunDuration[] }> => {
    const res = await fetch(`${API_URL}/stats/projects/${projectPid}/plugin-durations`);
    if (!res.ok) throw new Error('Failed to fetch plugin durations');
    return await res.json();
};

