import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOverview } from './overview';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function stubAll(overrides: Record<string, unknown> = {}) {
    const defaults: Record<string, unknown> = {
        qualifications: [
            {
                pid: 'd1', questionnaire_id: 'q1', answers: {}, status: 'completed',
                system_card: { format: 'airo-min' },
                system_version: { pid: 'v1', project_id: 'p1', number: 2, name: 'S', version: '', provider: '', description: '', created_at: '', created_by: '' },
            },
        ],
        questionnaires: [{ pid: 'q1' }],
        coverage: { objectives: [{}, {}, {}], key_objectives: 2, key_covered: 1 },
        library: [{ pid: 'cl1', question_count: 10 }],
        submissions: { cl1: [{ pid: 's1' }] },
        project: {
            plugins: [{ name: 'a', display_name: 'A', enabled: true, config: { x: 1 } }],
            components: [{ component_type: 'model' }, { component_type: 'dataset' }],
        },
        ...overrides,
    };
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1/qualification')) {
                return Promise.resolve({ ok: true, json: async () => defaults['qualifications'] });
            }
            if (url.includes('/questionnaires/projects/p1')) {
                return Promise.resolve({ ok: true, json: async () => defaults['questionnaires'] });
            }
            if (url.includes('/assessment-coverage')) {
                return Promise.resolve({ ok: true, json: async () => defaults['coverage'] });
            }
            if (url.endsWith('/projects/p1/controls')) {
                return Promise.resolve({ ok: true, json: async () => defaults['library'] });
            }
            if (url.includes('/controls/') && url.includes('/submissions')) {
                const subs = defaults['submissions'] as Record<string, unknown[]>;
                const cl = Object.keys(subs).find((k) => url.includes(`/${k}/`)) ?? '';
                return Promise.resolve({ ok: true, json: async () => subs[cl] ?? [] });
            }
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({ ok: true, json: async () => defaults['project'] });
            }
            throw new Error(`unexpected fetch: ${url}`);
        }),
    );
}

describe('getOverview', () => {
    it('aggregates qualification, coverage, ratios and sandbox readiness', async () => {
        stubAll();
        const out = await getOverview('p1');
        expect(out).toEqual({
            qualificationDone: true,
            latestCardVersion: 2,
            aiCard: { format: 'airo-min' },
            questionnaires: 1,
            objectives: { total: 3, key: 2, keyCovered: 1 },
            checklists: { installed: 1, configured: 1, questions: 10 },
            plugins: { enabled: 1, configured: 1 },
            sandboxReady: true,
            sandboxDetail: '1 model(s), 1 dataset(s)',
        });
    });

    it('reports missing pieces honestly', async () => {
        stubAll({
            qualifications: [],
            library: [],
            project: { plugins: [], components: [] },
        });
        const out = await getOverview('p1');
        expect(out.qualificationDone).toBe(false);
        expect(out.latestCardVersion).toBeNull();
        expect(out.aiCard).toBeNull();
        expect(out.sandboxReady).toBe(false);
        expect(out.sandboxDetail).toBe('add a model and a dataset');
        expect(out.checklists).toEqual({ installed: 0, configured: 0, questions: 0 });
    });

    it('throws on HTTP errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
        );
        await expect(getOverview('p1')).rejects.toThrow('404');
    });
});
