import { API_VERSION_PREFIX } from '../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

/** A model a test uses as a tool, bound to the roles it serves. */
export interface Helper {
    name: string;
    label: string;
    endpoint_url: string;
    roles: string[];
    has_key: boolean;
}

export interface HelperList {
    can_manage: boolean;
    roles: string[];
    helpers: Helper[];
}

export interface HelperDraft {
    label?: string;
    endpoint_url: string;
    roles: string[];
    key?: string;
}

async function refusal(res: Response, fallback: string): Promise<Error> {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    return new Error(body?.detail ?? `${fallback} (HTTP ${res.status})`);
}

export async function getHelpers(projectPid: string): Promise<HelperList> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/helpers`);
    if (!res.ok) throw await refusal(res, 'Failed to read the helper models');
    return (await res.json()) as HelperList;
}

export async function saveHelper(
    projectPid: string,
    name: string,
    draft: HelperDraft,
): Promise<Helper> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/helpers/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
    });
    if (!res.ok) throw await refusal(res, 'Refused');
    return (await res.json()) as Helper;
}

export async function removeHelper(projectPid: string, name: string): Promise<void> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/helpers/${name}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw await refusal(res, 'Refused');
}

/** One small call to the helper with its stored key; the status only. */
export async function testHelper(
    projectPid: string,
    name: string,
    model: string,
): Promise<{ ok: boolean; status: string; detail: string; latency_ms: number }> {
    const res = await fetch(`${API_URL}/projects/${projectPid}/helpers/${name}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
    });
    if (!res.ok) throw await refusal(res, 'The helper could not be called');
    return (await res.json()) as {
        ok: boolean;
        status: string;
        detail: string;
        latency_ms: number;
    };
}
