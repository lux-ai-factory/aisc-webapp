import { API_VERSION_PREFIX } from '../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

export type EvidenceStatus = 'not covered' | 'no evidence' | 'evidence' | 'attention';
export type EvidenceKind = 'test' | 'control';

export interface EvidenceVersion {
    pid: string;
    number: number;
}

export interface EvidenceRisk {
    id: string;
    label: string;
    impact: number | null;
    likelihood: number | null;
}

export interface EvidenceObjective {
    id: string;
    title: string;
    dimension: string;
    expects: string;
    priority: boolean;
    stale: string | null;
    linked: boolean;
    risks: EvidenceRisk[];
    evidence: EvidenceStatus;
}

export interface EvidenceRuns {
    executed: number;
    failed: number;
    running: number;
    latest_failed: boolean;
}

export interface EvidenceSubmission {
    answered: number;
    questions: number;
    readiness: number | null;
}

export interface EvidenceTest {
    key: string;
    label: string;
    dimensions: string[];
    stale: string | null;
    runs: EvidenceRuns;
}

export interface EvidenceControl {
    key: string;
    label: string;
    dimensions: string[];
    stale: string | null;
    submission: EvidenceSubmission | null;
}

export interface EvidenceLink {
    objective_id: string;
    kind: EvidenceKind;
    key: string;
    note: string;
    created_at: string;
    created_by: string;
}

export interface EvidenceReview {
    reviewed_by: string;
    reviewed_by_name: string;
    reviewed_at: string;
}

export interface EvidenceCoverage {
    linked: number;
    objectives: number;
    gaps: number;
}

export interface EvidenceMap {
    version: EvidenceVersion | null;
    versions: EvidenceVersion[];
    objectives: EvidenceObjective[];
    tests: EvidenceTest[];
    controls: EvidenceControl[];
    links: EvidenceLink[];
    coverage: EvidenceCoverage;
    review: EvidenceReview | null;
    can_edit: boolean;
    can_review: boolean;
    read_only: boolean;
    carried_from: number | null;
}

export interface EvidenceLinkInput {
    objective_id: string;
    kind: EvidenceKind;
    key: string;
    note?: string | null;
}

function refusal(body: unknown, status: number): string {
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e) => {
                const entry = e as { loc?: unknown[]; msg?: string };
                return `${entry.loc?.slice(-1)[0] ?? ''}: ${entry.msg ?? ''}`;
            })
            .join('; ');
    }
    return `Refused (HTTP ${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, init);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(refusal(body, res.status));
    return body as T;
}

/** The versioned evidence map for one AI-card version (the latest when none is given). */
export async function getEvidenceMap(projectPid: string, versionPid?: string): Promise<EvidenceMap> {
    const query = versionPid ? `?version=${encodeURIComponent(versionPid)}` : '';
    return request<EvidenceMap>(`/projects/${projectPid}/evidence${query}`);
}

/** Replace the latest version's links and return the rebuilt map. */
export async function putEvidenceLinks(
    projectPid: string,
    versionPid: string,
    links: EvidenceLinkInput[],
): Promise<EvidenceMap> {
    return request<EvidenceMap>(`/projects/${projectPid}/evidence/links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            version: versionPid,
            links: links.map((l) => ({
                objective_id: l.objective_id,
                kind: l.kind,
                key: l.key,
                note: l.note ?? null,
            })),
        }),
    });
}

/** Mark the latest version's map reviewed; returns the rebuilt map. */
export async function reviewEvidenceMap(projectPid: string, versionPid: string): Promise<EvidenceMap> {
    return request<EvidenceMap>(`/projects/${projectPid}/evidence/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: versionPid }),
    });
}
