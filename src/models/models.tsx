export interface Project {
    pid: string;
    name: string;
    plugins: Plugin[];
    datasets: DataObject[];
    models: DataObject[];
}

export interface Evaluation {
    pid: string;
    project: Project
    status: string;
    dataset: DataObject;
    model: DataObject;
    evaluation_plugins: Plugin[];
    task: string;
}

export interface Plugin {
    pid: string;
    name: string;
    config: object
    display_icon: string;
    plugin_config?: PluginConfig | null;
}

export interface TaskProgress {
    progress: number;
    extra: object
}

export interface DataObject {
    pid: string;
    name: string;
    data: string;
}

export interface ProjectPluginConfigState {
    plugin_config_id?: number | null;
    config?: object | null;
    formSchema: object;
    uiSchema: object
}

export interface PluginConfig {
    id: number;
    config: object;
    created_at: string;
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
