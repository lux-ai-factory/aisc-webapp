import { API_VERSION_PREFIX } from '../config';

export interface DashboardEvaluation {
    pid: string;
    status: string;
    created_at?: string;
}

export interface DashboardQualification {
    pid: string;
    status: string;
}

export interface DashboardChecklist {
    pid: string;
    question_count: number;
}

export interface DashboardCardVersion {
    pid: string;
    number: number;
    name: string;
}

export interface DashboardStats {
    questionnaires: number;
    qualifications: number;
    completedQualifications: number;
    checklists: number;
    checklistQuestions: number;
    evaluations: number;
    evaluationsDone: number;
    keyObjectives: number;
    latestCardVersion: number | null;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
}

/** Aggregate the project overview from existing endpoints (no new backend). */
export async function getDashboardStats(pid: string): Promise<DashboardStats> {
    const [questionnaires, qualifications, checklists, evaluations, latest, matrix] =
        await Promise.all([
            get<{ pid: string }[]>(`/questionnaires/projects/${pid}`),
            get<DashboardQualification[]>(`/projects/${pid}/qualification`),
            get<DashboardChecklist[]>(`/projects/${pid}/controls`),
            get<DashboardEvaluation[]>(`/projects/${pid}/evaluations`),
            get<DashboardCardVersion | null>(`/projects/${pid}/system-versions/latest`),
            get<{ priorities: { key: boolean }[] }>(
                `/projects/${pid}/control-objectives/matrix`,
            ),
        ]);
    return {
        questionnaires: questionnaires.length,
        qualifications: qualifications.length,
        completedQualifications: qualifications.filter((q) => q.status === 'completed').length,
        checklists: checklists.length,
        checklistQuestions: checklists.reduce((n, c) => n + (c.question_count || 0), 0),
        evaluations: evaluations.length,
        evaluationsDone: evaluations.filter((e) => e.status === 'Done').length,
        keyObjectives: matrix.priorities.filter((p) => p.key).length,
        latestCardVersion: latest ? latest.number : null,
    };
}
