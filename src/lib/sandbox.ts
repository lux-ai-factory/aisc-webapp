import { API_VERSION_PREFIX } from '../config';

export interface SandboxRun {
    pid: string;
    status: string;
    created_at?: string;
    task?: string | null;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

/** All runs of a project, newest first (the middle of the Sandbox). */
export async function listAllRuns(pid: string): Promise<SandboxRun[]> {
    const runs = await request<SandboxRun[]>(`/projects/${pid}/evaluations`);
    return sortRunsNewest(runs);
}

export function sortRunsNewest(runs: SandboxRun[]): SandboxRun[] {
    return [...runs].sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
    });
}

export function runStatusColor(status: string): 'success' | 'error' | 'info' | 'default' {
    if (status === 'Done') return 'success';
    if (status === 'Failed') return 'error';
    if (status === 'Processing' || status === 'Pending') return 'info';
    return 'default';
}
