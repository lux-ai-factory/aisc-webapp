

interface Project {
    pid: string;
    name: string;
    plugins: Plugin[];
    datasets: DataObject[];
    models: DataObject[];
}

interface Plugin {
    pid: string;
    name: string;
    config: object
}

interface DataObject {
    pid: string;
    name: string;
    data: string;
}

interface ProjectPluginConfigState {
    config: object;
    schema: object;
    uiSchema: object
}

interface PluginFeatureFlags {
    can_parse_config_from_dataset: boolean
    extra: object
}

export type {Project, Plugin, DataObject, ProjectPluginConfigState, PluginFeatureFlags}