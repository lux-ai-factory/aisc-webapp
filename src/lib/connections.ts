import { API_VERSION_PREFIX } from '../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

export interface Adapter {
    kind: string;
    label: string;
}

export interface ConnectionTarget {
    key: string;
    name: string;
    component_type: string;
}

/** A component of the project's system, as a target a connection may link to. */
export interface ProjectComponent {
    key: string;
    name: string;
    component_type: string;
}

/** One connection: the endpoint a test reaches and the protocol that reaches it. */
export interface Connection {
    name: string;
    label: string;
    kind: string;
    protocol: string;
    base_url: string;
    model: string;
    supports_tools: boolean;
    supports_logprobs: boolean;
    protocol_version: string;
    path: string;
    method: string;
    body_template: unknown;
    response_path: string;
    headers: Record<string, unknown>;
    secret_header: string;
    timeout_s: number;
    settings: Record<string, unknown>;
    target: ConnectionTarget | null;
    has_secret: boolean;
    secret_headers: string[];
    last_test_at: string | null;
    last_test_ok: boolean;
}

export interface ConnectionList {
    adapters: Adapter[];
    connections: Connection[];
}

/** The save body. A field left out keeps its stored value; `secret` of `''` clears
 * the stored key, and a `secret_headers` entry of `''` removes that header. */
export interface ConnectionDraft {
    label?: string;
    kind: string;
    base_url: string;
    timeout_s?: number;
    target?: string | null;
    model?: string;
    supports_tools?: boolean;
    supports_logprobs?: boolean;
    protocol_version?: string;
    path?: string;
    method?: string;
    body_template?: unknown;
    response_path?: string | null;
    refusal?: Record<string, unknown> | null;
    headers?: Record<string, unknown>;
    secret_header?: string | null;
    settings?: Record<string, unknown>;
    secret?: string;
    secret_headers?: Record<string, string>;
}

/** What a test gets from the system: the answer, or the system's refusal. */
export interface TryResult {
    ok: boolean;
    answer?: unknown;
    refused?: boolean;
    refusal_reason?: string | null;
    error?: string | null;
    detail?: string;
    capabilities?: Record<string, boolean>;
    latency_ms: number;
}

export interface AgentCard {
    url: string;
    name: string;
    description: string;
    url_named_by_card: string;
    protocol_version: string;
    capabilities: Record<string, unknown>;
}

/** What one run used: the adapter/version and the helper per role, snapshotted. */
export interface RunBinding {
    role: string;
    kind: string;
    adapter_version: string;
    base_url: string;
    model: string;
    connection: string | null;
    helper: string | null;
}

async function refusal(res: Response, fallback: string): Promise<Error> {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    return new Error(body?.detail ?? `${fallback} (HTTP ${res.status})`);
}

const json = { 'Content-Type': 'application/json' };

export async function getConnections(projectPid: string): Promise<ConnectionList> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections`);
    if (!res.ok) throw await refusal(res, 'Failed to read the connections');
    return (await res.json()) as ConnectionList;
}

export async function saveConnection(
    projectPid: string,
    name: string,
    draft: ConnectionDraft,
): Promise<Connection> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${name}`, {
        method: 'PUT',
        headers: json,
        body: JSON.stringify(draft),
    });
    if (!res.ok) throw await refusal(res, 'Refused');
    return (await res.json()) as Connection;
}

export async function removeConnection(projectPid: string, name: string): Promise<void> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${name}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw await refusal(res, 'Refused');
}

export async function linkConnectionTarget(
    projectPid: string,
    name: string,
    key: string,
): Promise<Connection> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${name}/target`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ key }),
    });
    if (!res.ok) throw await refusal(res, 'Refused');
    return (await res.json()) as Connection;
}

/** One call through the connection's adapter, as a test would make it. */
export async function tryConnection(
    projectPid: string,
    name: string,
    input: unknown = 'ping',
): Promise<TryResult> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${name}/test`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ input }),
    });
    if (!res.ok) throw await refusal(res, 'The connection could not be tried');
    return (await res.json()) as TryResult;
}

/** Read an A2A agent's card. */
export async function discoverAgentCard(projectPid: string, name: string): Promise<AgentCard> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${name}/discover`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({}),
    });
    if (!res.ok) throw await refusal(res, 'The agent card could not be read');
    return (await res.json()) as AgentCard;
}

/** The components of the project's system, as targets a connection may link to. */
export async function listComponents(projectPid: string): Promise<ProjectComponent[]> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/aisystem`);
    if (!res.ok) return [];
    const body = (await res.json()) as {
        components?: { pid: string; name: string; component_type: string }[];
    };
    return (body.components ?? []).map((c) => ({
        key: c.pid,
        name: c.name,
        component_type: c.component_type,
    }));
}

export async function getRunBindings(
    projectPid: string,
    pluginPid: string,
): Promise<RunBinding[]> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/runs/${pluginPid}/bindings`);
    if (!res.ok) throw await refusal(res, 'Failed to read the run bindings');
    return ((await res.json()) as { bindings: RunBinding[] }).bindings;
}

export async function bindRun(
    projectPid: string,
    pluginPid: string,
    binding: { role?: string; connection?: string; helper?: string },
): Promise<RunBinding> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/runs/${pluginPid}/bindings`, {
        method: 'PUT',
        headers: json,
        body: JSON.stringify({ role: binding.role ?? '', ...binding }),
    });
    if (!res.ok) throw await refusal(res, 'Refused');
    return (await res.json()) as RunBinding;
}
