import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    checklistChips,
    getCatalogue,
    getChecklist,
    getProjectDimensions,
    InstalledChecklist,
    listLibrary,
    listSubmissions,
    reinstallChecklist,
    uninstallChecklist,
} from './checklists';

function mockFetchOnce(payload: unknown, status = 200) {
    const fn = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const installed: InstalledChecklist = {
    pid: 'cl1',
    template: {
        catalogue_id: 'risk-management-checklist',
        title: 'Risk Management',
        source: 'AESIA',
        control_topic: 'Risk Management',
        country_ids: [],
        regulation_ids: ['ai-act'],
        question_count: 42,
        tags: [],
    },
    question_count: 42,
};

describe('checklists api', () => {
    it('lists the installed library', async () => {
        const fetch = mockFetchOnce([installed]);
        const out = await listLibrary('p1');
        expect(out).toEqual([installed]);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/controls'),
            expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
        );
    });

    it('reads one checklist with questions', async () => {
        const fetch = mockFetchOnce({ ...installed, questions: [] });
        await getChecklist('p1', 'cl1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/controls/cl1'),
            expect.anything(),
        );
    });

    it('uninstalls with DELETE', async () => {
        const fetch = mockFetchOnce(undefined, 204);
        await uninstallChecklist('p1', 'cl1');
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/controls/cl1');
        expect(init.method).toBe('DELETE');
    });

    it('reinstalls from the catalogue for updates', async () => {
        const fetch = mockFetchOnce({ status: 'already-installed' });
        await reinstallChecklist('p1', 'risk-management-checklist');
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/catalogue/installs');
        expect(url).toContain('catalogue_id=risk-management-checklist');
        expect(url).toContain('kind=control');
        expect(init.method).toBe('POST');
    });

    it('lists submissions and reads the catalogue', async () => {
        const fetch = mockFetchOnce([]);
        await listSubmissions('p1', 'cl1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/controls/cl1/submissions'),
            expect.anything(),
        );
        await getCatalogue();
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/catalogue'),
            expect.anything(),
        );
    });

    it('reads the project\'s dimensions for the catalogue filter', async () => {
        const fetch = mockFetchOnce({
            objectives: ['O1'],
            dimensions: ['human-agency-oversight'],
        });
        const out = await getProjectDimensions('p1');
        expect(out.dimensions).toEqual(['human-agency-oversight']);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/control-objectives/dimensions'),
            expect.anything(),
        );
    });

    it('throws on HTTP errors', async () => {
        mockFetchOnce({ detail: 'nope' }, 404);
        await expect(listLibrary('p1')).rejects.toThrow('404');
    });
});

describe('checklistChips', () => {
    it('surfaces source, topic, regulations and question count', () => {
        expect(checklistChips(installed)).toEqual(['AESIA', 'Risk Management', 'ai-act', '42 questions']);
    });

    it('degrades without a template', () => {
        expect(checklistChips({ pid: 'x', template: null, question_count: 0 })).toEqual(['0 questions']);
    });
});
