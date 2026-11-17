import { API_VERSION_PREFIX } from '../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

export interface Connection {
    pid: string;
    name: string;
    component_type: string;
    adapter: string;
    adapter_version: string;
    helper_role: string;
    endpoint: string;
    key_set: boolean;
}

export interface ConnectionList {
    adapters: string[];
    connections: Connection[];
}

export interface ConnectionUpdate {
    adapter: string;
    adapter_version?: string;
    helper_role?: string;
}

/** The project's connections (components) with their adapter and key presence. */
export async function getConnections(projectPid: string): Promise<ConnectionList> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections`);
    if (!res.ok) throw new Error(`Failed to fetch connections (${res.status})`);
    return (await res.json()) as ConnectionList;
}

/** Choose a connection's adapter, contract version and helper role. */
export async function updateConnection(
    projectPid: string,
    componentPid: string,
    data: ConnectionUpdate,
): Promise<Connection> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/connections/${componentPid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            adapter: data.adapter,
            adapter_version: data.adapter_version ?? '',
            helper_role: data.helper_role ?? '',
        }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { detail?: string } | null)?.detail ?? `Refused (HTTP ${res.status})`);
    }
    return (await res.json()) as Connection;
}
