import { API_VERSION_PREFIX } from '../config';
import { Catalogue } from './catalogue';

export interface ChecklistTemplate {
    catalogue_id: string;
    title: string;
    source: string;
    control_topic: string;
    country_ids: string[];
    regulation_ids: string[];
    question_count: number;
    tags: string[];
}

export interface InstalledChecklist {
    pid: string;
    template: ChecklistTemplate | null;
    question_count: number;
    /** latest submission summary (absent = not installed-yet-answered) */
    submission_count?: number;
    latest_version?: number;
    latest_status?: string;
    latest_readiness?: number | null;
}

export interface ChecklistQuestion {
    order: number;
    text: string;
    article: string;
    category: string;
}

export interface ChecklistDetail extends InstalledChecklist {
    questions: ChecklistQuestion[];
}

export interface ChecklistSubmission {
    pid: string;
    checklist_pid: string;
    label: string;
    status: string;
    version: number;
    coverage: Record<string, number | string>;
    readiness: number | null;
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

export function getCatalogue(): Promise<Catalogue> {
    return request<Catalogue>('/catalogue');
}

export function listLibrary(pid: string): Promise<InstalledChecklist[]> {
    return request<InstalledChecklist[]>(`/projects/${pid}/controls`);
}

export function getChecklist(pid: string, checklistPid: string): Promise<ChecklistDetail> {
    return request<ChecklistDetail>(`/projects/${pid}/controls/${checklistPid}`);
}

export function uninstallChecklist(pid: string, checklistPid: string): Promise<void> {
    return request<void>(`/projects/${pid}/controls/${checklistPid}`, { method: 'DELETE' });
}

export interface ChecklistQuestionIn {
    text: string;
    article?: string;
    category?: string;
}

/** Add the project's own checklist (name + free-text questions). */
export function createChecklist(
    pid: string,
    data: { name: string; control_topic?: string; questions: ChecklistQuestionIn[] },
): Promise<ChecklistDetail> {
    return request<ChecklistDetail>(`/projects/${pid}/controls`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function reinstallChecklist(pid: string, catalogueId: string): Promise<unknown> {
    return request<unknown>(
        `/projects/${pid}/catalogue/installs?catalogue_id=${encodeURIComponent(catalogueId)}&kind=control`,
        { method: 'POST' },
    );
}

export function listSubmissions(pid: string, checklistPid: string): Promise<ChecklistSubmission[]> {
    return request<ChecklistSubmission[]>(`/projects/${pid}/controls/${checklistPid}/submissions`);
}

export interface ChecklistSubmissionDetail extends ChecklistSubmission {
    answers: { question_order: number; answer: string; score: number | null }[];
}

export function getSubmission(pid: string, submissionPid: string): Promise<ChecklistSubmissionDetail> {
    return request<ChecklistSubmissionDetail>(`/projects/${pid}/controls/submissions/${submissionPid}`);
}

export interface SubmissionAnswerIn {
    question_order: number;
    answer: string;
    /** 1-5 readiness score; null/absent = unscored */
    score?: number | null;
}

export function createSubmission(
    pid: string,
    checklistPid: string,
    label?: string,
): Promise<ChecklistSubmission> {
    return request<ChecklistSubmission>(`/projects/${pid}/controls/${checklistPid}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ label: label ?? '' }),
    });
}

export function saveSubmissionAnswers(
    pid: string,
    submissionPid: string,
    answers: SubmissionAnswerIn[],
): Promise<ChecklistSubmission> {
    return request<ChecklistSubmission>(
        `/projects/${pid}/controls/submissions/${submissionPid}/answers`,
        { method: 'POST', body: JSON.stringify(answers) },
    );
}

export function closeSubmission(
    pid: string,
    submissionPid: string,
): Promise<ChecklistSubmission> {
    return request<ChecklistSubmission>(
        `/projects/${pid}/controls/submissions/${submissionPid}/close`,
        { method: 'POST' },
    );
}

/** Reopen a closed submission as the next version (chain kept, version+1). */
export function reopenSubmission(
    pid: string,
    submissionPid: string,
): Promise<ChecklistSubmission> {
    return request<ChecklistSubmission>(
        `/projects/${pid}/controls/submissions/${submissionPid}/reopen`,
        { method: 'POST' },
    );
}

/** Chip labels for an installed checklist card. */
export type ChipColor = 'default' | 'primary' | 'success' | 'warning' | 'error';

export function checklistChipColor(chip: string): ChipColor {
    const ready = /^(\d+)% ready$/.exec(chip);
    if (ready) {
        const pct = Number(ready[1]);
        if (pct >= 80) return 'success';
        if (pct >= 50) return 'warning';
        return 'error';
    }
    const status = chip.toLowerCase();
    if (status === 'closed') return 'success';
    if (status === 'draft') return 'warning';
    if (/^\d+ submissions?$/.test(chip)) return 'primary';
    return 'default';
}

export function checklistChips(checklist: InstalledChecklist): string[] {
    const chips: string[] = [];
    const t = checklist.template;
    if (t) {
        if (t.source) chips.push(t.source);
        if (t.control_topic) chips.push(t.control_topic);
        for (const r of t.regulation_ids.slice(0, 3)) chips.push(r);
    }
    chips.push(`${checklist.question_count} questions`);
    if ((checklist.submission_count ?? 0) > 0) {
        chips.push(`${checklist.submission_count} submission${checklist.submission_count === 1 ? '' : 's'}`);
        if (checklist.latest_version) chips.push(`v${checklist.latest_version}`);
        if (checklist.latest_status) chips.push(checklist.latest_status);
    }
    if (checklist.latest_readiness != null) {
        chips.push(`${checklist.latest_readiness}% ready`);
    }
    return chips;
}
