export interface Project {
    pid: string;
    name: string;
    plugins: Plugin[];
    datasets: DataObject[];
    models: DataObject[];
}

export interface Plugin {
    pid: string;
    name: string;
    config: object
}

export interface DataObject {
    pid: string;
    name: string;
    data: string;
}

export interface ProjectPluginConfigState {
    config: object;
    schema: object;
    uiSchema: object
}

export interface PluginFeatureFlags {
    can_parse_config_from_dataset: boolean
    extra: object
}

export interface Measurement {
    name: string;
    description?: string | null;
    unit?: string | null;
    score: number;
    time: string;
    error?: string | null;
    feature_pid?: string | null;
}