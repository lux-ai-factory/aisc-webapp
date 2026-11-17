import { API_VERSION_PREFIX } from '../config';

/** One AI-card version the results can be scoped to. */
export interface ResultsVersion {
    pid: string;
    number: number;
}

export interface ToolHelper {
    role: string;
    model: string;
}

export interface ToolConnection {
    name: string;
    protocol_name: string;
}

/** One tool's scoped run summary (the pilot's results tile). */
export interface ToolResult {
    plugin_name: string;
    label: string;
    executed: number;
    failed: number;
    running: number;
    last_run: string | null;
    /** every run of this tool in scope was on a locally served model */
    local: boolean;
    local_runs: number;
    /** observations recorded for this tool's runs (an all-local evaluation's are left out) */
    observations: number;
    helpers: ToolHelper[];
    connections: ToolConnection[];
    dashboard_url: string | null;
}

export interface GreyedTool {
    plugin_name: string;
    label: string;
}

/** One metric over the scoped runs: the visualizer's own aggregate, chart-shaped. */
export interface ChartMetric {
    metric: string;
    unit: string;
    count: number;
    min_score: number | null;
    max_score: number | null;
    avg_score: number | null;
}

export interface ChartScope {
    version: number | null;
    target: string | null;
    evaluations: number;
    local_models_left_out: number;
}

/** The dashboard link: what it is about, and whether it is authenticated. */
export interface DashboardLink {
    url: string | null;
    authenticated: boolean;
    bridge_configured: boolean;
    scope: { project?: string; version?: string | null; target?: string | null; tool?: string | null };
}

export interface ProjectResults {
    version: ResultsVersion | null;
    target: string | null;
    dashboards_url: string | null;
    dashboard: DashboardLink;
    tools: ToolResult[];
    greyed: GreyedTool[];
    charts: ChartMetric[];
    chart_scope: ChartScope;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

/** The scoped run summary for one AI-card version (latest when no pid is given). */
export async function getProjectResults(
    pid: string,
    opts: { version?: string; target?: string } = {},
): Promise<ProjectResults> {
    const query = new URLSearchParams();
    if (opts.version) query.set('version', opts.version);
    if (opts.target) query.set('target', opts.target);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_URL}/projects/${pid}/results${suffix}`);
    if (!res.ok) throw new Error(`request failed: ${res.status} /projects/${pid}/results`);
    return (await res.json()) as ProjectResults;
}

/** What the dashboard did when a project was published to it (ANA-01). */
export interface DashboardRegistration {
    registered: boolean;
    bridge_configured: boolean;
}

/** Tell the dashboard about this project: it makes the datasets and the dashboard. */
export async function publishToDashboard(pid: string): Promise<DashboardRegistration> {
    const res = await fetch(`${API_URL}/projects/${pid}/results/dashboard`, { method: 'POST' });
    if (!res.ok) throw new Error(`request failed: ${res.status} /projects/${pid}/results/dashboard`);
    return (await res.json()) as DashboardRegistration;
}

/** The project is going: ask the dashboard to drop its objects. */
export async function withdrawFromDashboard(pid: string): Promise<{ removed: boolean }> {
    const res = await fetch(`${API_URL}/projects/${pid}/results/dashboard`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`request failed: ${res.status} /projects/${pid}/results/dashboard`);
    return (await res.json()) as { removed: boolean };
}

/** "≈ 0.82 mean of 3" — one chart row's numbers, as a person reads them. */
export function chartSummary(chart: ChartMetric): string {
    const mean = chart.avg_score === null ? '—' : chart.avg_score.toFixed(2);
    const range =
        chart.min_score === null || chart.max_score === null
            ? ''
            : ` · ${chart.min_score.toFixed(2)}–${chart.max_score.toFixed(2)}`;
    return `${mean} mean of ${chart.count}${range}`;
}

/** "Judge gpt-4o-mini, Attacker llama-3" — the helper models a tile's runs used. */
export function helperModelsLine(helpers: ToolHelper[]): string {
    if (!helpers.length) return '';
    return helpers
        .map((h) => `${h.role.charAt(0).toUpperCase()}${h.role.slice(1)} ${h.model}`)
        .join(', ');
}

/** "Reached through openai (judge-endpoint)" — how a tile's runs reached the target. */
export function connectionsLine(connections: ToolConnection[]): string {
    if (!connections.length) return '';
    const seen = new Set<string>();
    const through: string[] = [];
    for (const c of connections) {
        const text = `${c.protocol_name} (${c.name})`;
        if (!seen.has(text)) {
            seen.add(text);
            through.push(text);
        }
    }
    return through.join(', ');
}
