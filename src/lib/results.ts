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
    helpers: ToolHelper[];
    connections: ToolConnection[];
    dashboard_url: string | null;
}

export interface GreyedTool {
    plugin_name: string;
    label: string;
}

export interface ProjectResults {
    version: ResultsVersion | null;
    target: string | null;
    dashboards_url: string | null;
    tools: ToolResult[];
    greyed: GreyedTool[];
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
