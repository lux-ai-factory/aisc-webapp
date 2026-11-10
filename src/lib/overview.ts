import { API_VERSION_PREFIX } from '../config';
import { Qualification } from './qualification';
import { InstalledChecklist, ChecklistSubmission } from './checklists';

export interface OverviewPlugin {
    name: string;
    display_name: string;
    enabled: boolean;
    config: Record<string, unknown> | null;
}

export interface OverviewComponent {
    component_type: string | null;
}

export interface OverviewData {
    qualificationDone: boolean;
    latestCardVersion: number | null;
    aiCard: Record<string, unknown> | null;
    questionnaires: number;
    objectives: { total: number; key: number; keyCovered: number };
    checklists: { installed: number; configured: number; questions: number };
    plugins: { enabled: number; configured: number };
    sandboxReady: boolean;
    sandboxDetail: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
}

/** Project state for the Overview page (W7), from existing endpoints. */
export async function getOverview(pid: string): Promise<OverviewData> {
    const [qualifications, questionnaires, coverage, library, project] = await Promise.all([
        get<Qualification[]>(`/projects/${pid}/qualification`),
        get<{ pid: string }[]>(`/questionnaires/projects/${pid}`),
        get<{ objectives: unknown[]; key_objectives: number; key_covered: number }>(
            `/projects/${pid}/assessment-coverage`,
        ),
        get<InstalledChecklist[]>(`/projects/${pid}/controls`),
        get<{ plugins: OverviewPlugin[]; components: OverviewComponent[] }>(
            `/projects/${pid}`,
        ),
    ]);
    const submissions = await Promise.all(
        library.map((cl) =>
            get<ChecklistSubmission[]>(`/projects/${pid}/controls/${cl.pid}/submissions`).catch(
                () => [] as ChecklistSubmission[],
            ),
        ),
    );

    const completed = qualifications.filter((q) => q.status === 'completed');
    const withCard = completed.filter((q) => q.system_card);
    const latest = withCard.sort(
        (a, b) => (b.system_version?.number ?? 0) - (a.system_version?.number ?? 0),
    )[0];

    const enabledPlugins = project.plugins.filter((p) => p.enabled);
    const models = project.components.filter((c) => c.component_type !== 'dataset');
    const datasets = project.components.filter((c) => c.component_type === 'dataset');
    const sandboxReady = models.length > 0 && datasets.length > 0;

    return {
        qualificationDone: completed.length > 0,
        latestCardVersion: latest?.system_version?.number ?? null,
        aiCard: (latest?.system_card as Record<string, unknown> | null) ?? null,
        questionnaires: questionnaires.length,
        objectives: {
            total: coverage.objectives.length,
            key: coverage.key_objectives,
            keyCovered: coverage.key_covered,
        },
        checklists: {
            installed: library.length,
            configured: submissions.filter((s) => s.length > 0).length,
            questions: library.reduce((n, c) => n + (c.question_count || 0), 0),
        },
        plugins: {
            enabled: enabledPlugins.length,
            configured: enabledPlugins.filter((p) => p.config !== null).length,
        },
        sandboxReady,
        sandboxDetail: sandboxReady
            ? `${models.length} model(s), ${datasets.length} dataset(s)`
            : models.length === 0 && datasets.length === 0
              ? 'add a model and a dataset'
              : models.length === 0
                ? 'add a model'
                : 'add a dataset',
    };
}
