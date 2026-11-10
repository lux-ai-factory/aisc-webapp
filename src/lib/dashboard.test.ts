import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboardStats } from './dashboard';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getDashboardStats', () => {
    it('aggregates counts from existing endpoints', async () => {
        const seen: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                seen.push(url);
                if (url.includes('/questionnaires/projects/p1')) {
                    return Promise.resolve({ ok: true, json: async () => [{ pid: 'q1' }] });
                }
                if (url.endsWith('/projects/p1/qualification')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => [
                            { pid: 'd1', status: 'draft' },
                            { pid: 'd2', status: 'completed' },
                        ],
                    });
                }
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => [{ pid: 'cl1', question_count: 40 }],
                    });
                }
                if (url.endsWith('/projects/p1/evaluations')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => [
                            { pid: 'e1', status: 'Done' },
                            { pid: 'e2', status: 'Running' },
                        ],
                    });
                }
                if (url.includes('/system-versions/latest')) {
                    return Promise.resolve({ ok: true, json: async () => ({ number: 3 }) });
                }
                if (url.includes('/control-objectives/matrix')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({ priorities: [{ key: true }, { key: false }] }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        const stats = await getDashboardStats('p1');
        expect(stats).toEqual({
            questionnaires: 1,
            qualifications: 2,
            completedQualifications: 1,
            checklists: 1,
            checklistQuestions: 40,
            evaluations: 2,
            evaluationsDone: 1,
            keyObjectives: 1,
            latestCardVersion: 3,
        });
        expect(seen.length).toBe(6);
    });

    it('tolerates a missing card version', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/system-versions/latest')) {
                    return Promise.resolve({ ok: true, json: async () => null });
                }
                if (url.includes('/control-objectives/matrix')) {
                    return Promise.resolve({ ok: true, json: async () => ({ priorities: [] }) });
                }
                return Promise.resolve({ ok: true, json: async () => [] });
            }),
        );
        const stats = await getDashboardStats('p1');
        expect(stats.latestCardVersion).toBeNull();
        expect(stats.qualifications).toBe(0);
    });

    it('throws on HTTP errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
        );
        await expect(getDashboardStats('p1')).rejects.toThrow('404');
    });
});
