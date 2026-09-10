export type AIComponentType = 'dataset' | 'model' | 'llm' | 'rest' | 'datashape';

export interface AIComponent {
    pid: string;
    name: string;
    description: string;
    component_type: AIComponentType;
    data: string;
    file_size: number | null;
    endpoint_url?: string;
    secret_pid?: string | null;
    source_dataset_pid?: string | null;
    json_value?: Record<string, unknown>;
}

export interface AISystem {
    pid: string;
    name: string;
    description: string;
    components: AIComponent[];
}

export interface Project {
    pid: string;
    name: string;
    plugins: Plugin[];
    components: AIComponent[];
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

export interface Package {
    package_name: string;
    version: string;
    source: string;
}

export interface Plugin {
    pid: string;
    name: string;
    config: object
    display_icon: string;
    plugin_config?: PluginConfig | null;
    package_name: string;
    version: string;
    display_name: string;
    plugin_pid: string;
    enabled: boolean;
    status: string;
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
    project_config_definitions?: ProjectConfigDefinition[];
    project_config_selections?: ProjectConfigSelection[];
    project_settings?: ProjectConfig[];
}

export type SettingCategory = 'secrets' | 'datashape' | 'variables' | 'api_endpoint';
export type EndpointType = 'openai_compatible' | 'rest';
export type SettingValueType = 'string' | 'number' | 'boolean' | 'json';

export interface ProjectConfigDefinition {
    key: string;
    name: string;
    category: SettingCategory;
    value_type?: SettingValueType | null;
    required: boolean;
}

export interface ProjectConfig {
    pid: string;
    category: SettingCategory;
    key: string;
    name: string;
    masked_value: string;
    json_value: Record<string, unknown>;
    endpoint_type?: EndpointType | null;
    url?: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectConfigSelection {
    plugin_config_key: string;
    project_config_pid: string;
}

export interface ValidationReport {
    errors: string[];
    warnings: string[];
}

export interface PluginConfig {
    id: number;
    config: object;
    created_at: string;
}

export interface PluginFeatureFlags {
    can_parse_config_from_dataset: boolean;
    show_dimensions_visualisation: boolean;
    extra: object;
}

export interface PluginInputDefinition {
    name: string;
    label: string;
    input_type: string;
    required: boolean;
}

export interface PluginInputValue {
    pid: string;
    name: string;
    input_type: string;
    datashape_pid?: string;
}

export interface Measurement {
    name: string;
    description?: string | null;
    unit?: string | null;
    score: number;
    direction?: string | null;
    time: string;
    error?: string | null;
    dimensions?: Record<string, string | number | boolean>;
    created_at: string;
}

export interface MetricVisualization {
    chart_type: string;
    metrics: string[];
    title?: string | null;
    description?: string | null;
    filter_dimensions?: Record<string, (string | number | boolean)[]> | null;
    metric_label_dimension?: string | null;
    group_by_dimensions?: string[] | null;
}

export interface ZippedFile {
    file_name: string;
    file_size: number;
}

export interface ArtifactPreview {
  type: string;
  data: string | string[][] | ZippedFile[] | undefined;
}

export interface Artifact {
  preview: ArtifactPreview;
  name: string;
  data: string;
}

// Stats types

export interface EvaluationStatusBreakdown {
    status: string;
    count: number;
}

export interface ProjectStatsOverview {
    total_evaluations: number;
    evaluations_by_status: EvaluationStatusBreakdown[];
    success_rate: number;
    avg_evaluation_duration_seconds: number | null;
    std_evaluation_duration_seconds: number | null;
    last_evaluation_date: string | null;
    total_measurements: number;
    avg_score: number | null;
    avg_uncertainty: number | null;
    error_rate: number;
    unique_metrics_used: number;
    feature_coverage: number;
    total_datasets: number;
    total_models: number;
    datasets_evaluated: number;
    models_evaluated: number;
    active_plugins: number;
    total_artifacts: number;
    num_configs: number;
}

export interface MetricScoreSummary {
    metric_pid: string;
    metric_name: string;
    plugin_name: string;
    avg_score: number;
    min_score: number;
    max_score: number;
    std_score: number;
    measurement_count: number;
}

export interface PluginUsageSummary {
    plugin_name: string;
    usage_count: number;
    artifact_count: number;
    avg_duration_seconds: number | null;
    successful_runs: number;
    failed_runs: number;
}

export interface PluginRunDuration {
    plugin_name: string;
    run_index: number;
    duration_seconds: number;
}
