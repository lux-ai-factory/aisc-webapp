import {API_VERSION_PREFIX} from "../config.tsx";
import {Project, PluginFeatureFlags, PluginInputDefinition, Package,
ProjectStatsOverview,
    MetricScoreSummary,
    PluginUsageSummary,
    PluginRunDuration,} from "../models/models.tsx";
import { ProjectSetting, ValidationReport } from "../models/models.tsx";

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

export const getPluginSettingDefinitions = async (plugin_pid: string) => {
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/setting_definitions`);
    if (!res.ok) throw new Error('Failed to fetch plugin setting definitions');
    return await res.json();
};

export const getProjectSettings = async (projectPid: string): Promise<ProjectSetting[]> => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}`);
    if (!res.ok) throw new Error('Failed to fetch project settings');
    return await res.json();
};

export const createProjectSetting = async (projectPid: string, data: object): Promise<ProjectSetting> => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to create project setting');
    return await res.json();
};

export const updateProjectSetting = async (projectPid: string, settingPid: string, data: object): Promise<ProjectSetting> => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}/${settingPid}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Failed to update project setting');
    return await res.json();
};

export const deleteProjectSetting = async (projectPid: string, settingPid: string) => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}/${settingPid}`, {method: 'DELETE'});
    if (!res.ok) throw new Error('Failed to delete project setting');
};

export const deriveFeaturesFromDataset = async (projectPid: string, data: object): Promise<ProjectSetting> => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}/derive-features`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    if (!res.ok) throw new Error('Failed to derive datashape');
    return await res.json();
};

export const validateDatasetAgainstDatashape = async (projectPid: string, settingPid: string, datasetPid: string): Promise<ValidationReport> => {
    const res = await fetch(`${API_URL}/project/settings/${projectPid}/${settingPid}/validate`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({dataset_pid: datasetPid})});
    if (!res.ok) throw new Error('Failed to validate dataset');
    return await res.json();
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

// Measurements Aggregation API

export const getEvaluationDimensionKeys = async (
    evaluationPid: string, 
    evaluationPluginPid?: string,
    metricName?: string
): Promise<{ keys: string[] }> => {
    const res = await fetch(`${API_URL}/evaluations/${evaluationPid}/measurements/dimension-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            evaluation_plugin_pid: evaluationPluginPid,
            metric_name: metricName
        }),
    });
    if (!res.ok) throw new Error('Failed to fetch dimension keys');
    return await res.json();
};

export const getEvaluationDimensionValues = async (
    evaluationPid: string, 
    key: string,
    evaluationPluginPid?: string,
    metricName?: string
): Promise<{ key: string, values: any[] }> => {
    const res = await fetch(`${API_URL}/evaluations/${evaluationPid}/measurements/dimension-values/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            evaluation_plugin_pid: evaluationPluginPid,
            metric_name: metricName
        }),
    });
    if (!res.ok) throw new Error('Failed to fetch dimension values');
    return await res.json();
};

export const getEvaluationMetricNames = async (
    evaluationPid: string,
    evaluationPluginPid?: string
): Promise<{ names: string[] }> => {
    const res = await fetch(`${API_URL}/evaluations/${evaluationPid}/measurements/metric-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            evaluation_plugin_pid: evaluationPluginPid
        }),
    });
    if (!res.ok) throw new Error('Failed to fetch metric names');
    return await res.json();
}

export const aggregateEvaluationMeasurements = async (evaluationPid: string, aggregationRequest: {
    evaluation_plugin_pid?: string,
    plugin_name?: string,
    metric_name?: string,
    group_by?: string[],
    filters?: Record<string, any>,
    aggregations?: string[]
}): Promise<{ results: any[] }> => {
    const res = await fetch(`${API_URL}/evaluations/${evaluationPid}/measurements/aggregate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(aggregationRequest),
    });
    if (!res.ok) throw new Error('Failed to aggregate measurements');
    return await res.json();
};
