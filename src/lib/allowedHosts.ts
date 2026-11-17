import { API_VERSION_PREFIX } from '../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

/** An internal host this project's connections may call. */
export interface AllowedHost {
    host: string;
    note: string;
    updated_at: string | null;
    updated_by: string;
    /** Why the entry can no longer take effect — it names loopback, a cloud metadata
     * address or one of the deployment's own services; null while it still may. */
    denied: string | null;
}

export interface AllowedHostList {
    /** Hosts the deployment allows for every project; not removable from here. */
    floor: string[];
    entries: AllowedHost[];
    can_manage: boolean;
    rule: string;
}

async function refusal(res: Response, fallback: string): Promise<Error> {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    return new Error(body?.detail ?? `${fallback} (HTTP ${res.status})`);
}

const json = { 'Content-Type': 'application/json' };

/** The internal hosts this project may call, plus the deployment's own floor. */
export async function getAllowedHosts(projectPid: string): Promise<AllowedHostList> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/allowed-hosts`);
    if (!res.ok) throw await refusal(res, 'Failed to read the allowed internal hosts');
    return (await res.json()) as AllowedHostList;
}

/** Allow an internal host (or host:port): the next call to it goes out. */
export async function allowHost(
    projectPid: string,
    host: string,
    note: string,
): Promise<AllowedHost> {
    const res = await fetch(
        `${API_URL}/projects/${projectPid}/allowed-hosts/${encodeURIComponent(host)}`,
        { method: 'PUT', headers: json, body: JSON.stringify({ note: note || null }) },
    );
    if (!res.ok) throw await refusal(res, 'Refused');
    return (await res.json()) as AllowedHost;
}

/** Withdraw an entry: the next call to that host is refused again. */
export async function removeAllowedHost(projectPid: string, host: string): Promise<void> {
    const res = await fetch(
        `${API_URL}/projects/${projectPid}/allowed-hosts/${encodeURIComponent(host)}`,
        { method: 'DELETE' },
    );
    if (!res.ok) throw await refusal(res, 'Refused');
}
