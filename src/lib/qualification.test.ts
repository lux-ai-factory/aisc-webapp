import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    addProjectQuestionnaire,
    answerableQuestions,
    completeQualification,
    describeSetDiff,
    editQualificationCard,
    getObjectiveSetDiff,
    getDefaultQuestionnaire,
    hasAnswers,
    listProjectQuestionnaires,
    listQualificationVersions,
    listQuestionnaireVersions,
    parseQuestionnaireImport,
    qualificationVersionEntries,
    questionnaireVersionEntries,
    saveDraftQualification,
    selectQuestionnaire,
} from './qualification';

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

describe('qualification api', () => {
    it('lists project questionnaires', async () => {
        const fetch = mockFetchOnce([{ pid: 'q1' }]);
        const out = await listProjectQuestionnaires('p1');
        expect(out).toEqual([{ pid: 'q1' }]);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/questionnaires/projects/p1'),
            expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
        );
    });

    it('saves a draft with POST and no version bump', async () => {
        const fetch = mockFetchOnce({ pid: 'd1', status: 'draft' });
        await saveDraftQualification('p1', { questionnaire_id: 'q1', name: 'S', answers: { a: 1 } });
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/qualification'),
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('completes a draft with POST .../complete', async () => {
        const fetch = mockFetchOnce({ pid: 'd1', status: 'completed' });
        await completeQualification('p1', 'd1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/qualification/d1/complete'),
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('edits a card with PUT .../card', async () => {
        const fetch = mockFetchOnce({ pid: 'd2' });
        await editQualificationCard('p1', 'd1', { card: 'edited' });
        const [, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body as string)).toEqual({ system_card: { card: 'edited' } });
    });

    it('selects a questionnaire with PUT .../questionnaire', async () => {
        const fetch = mockFetchOnce({ questionnaire_id: 'q1' });
        await selectQuestionnaire('p1', 'q1');
        const [, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body as string)).toEqual({ questionnaire_id: 'q1' });
    });

    it('adds a questionnaire with POST', async () => {
        const fetch = mockFetchOnce({ pid: 'q9' });
        await addProjectQuestionnaire('p1', { name: 'N', definition: { blocks: [] } });
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/questionnaires/projects/p1'),
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('reads version chains', async () => {
        const fetch = mockFetchOnce([{ number: 1 }]);
        await listQuestionnaireVersions('p1', 'q1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/questionnaires/projects/p1/q1/versions'),
            expect.anything(),
        );
        await listQualificationVersions('p1', 'd1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/qualification/d1/versions'),
            expect.anything(),
        );
    });

    it('throws on HTTP errors', async () => {
        mockFetchOnce({ detail: 'nope' }, 404);
        await expect(listProjectQuestionnaires('p1')).rejects.toThrow('404');
    });

    it('reads the service-owned default', async () => {
        const fetch = mockFetchOnce({
            id: 'annex-iv-default', name: 'Annex IV default', description: '',
            version: 1, definition: {},
        });
        const out = await getDefaultQuestionnaire();
        expect(out?.id).toBe('annex-iv-default');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/questionnaires/default'),
            expect.anything(),
        );
    });

    it('returns null when no default is configured', async () => {
        mockFetchOnce({ detail: 'missing' }, 404);
        await expect(getDefaultQuestionnaire()).resolves.toBeNull();
    });

    it('extracts per-question fields from service definitions', async () => {
        const fields = answerableQuestions({
            questions: [
                { field: 'q:annex-1:1a', text: 'What changed?', citation: 'Annex IV(1)(a)', required: true },
                { field: 'q:annex-1:1b', text: 'Any hardware?', citation: '', required: false },
            ],
        });
        expect(fields).toEqual([
            { field: 'q:annex-1:1a', text: 'What changed?', citation: 'Annex IV(1)(a)', required: true },
            { field: 'q:annex-1:1b', text: 'Any hardware?', citation: '', required: false },
        ]);
    });

    it('returns null for opaque backend definitions', async () => {
        expect(answerableQuestions({ blocks: [{ id: 'b1' }] })).toBeNull();
        expect(answerableQuestions({ questions: [{ text: 'no field' }] })).toBeNull();
        expect(answerableQuestions({})).toBeNull();
    });
});

describe('qualification helpers', () => {
    it('does not count a blank draft as having answers', () => {
        expect(hasAnswers({})).toBe(false);
        expect(hasAnswers({ 'q:a:1': '   ' })).toBe(false);
        expect(
            hasAnswers({ __blocks: { risks: [{ affected: '', termNotApplicable: false }] } }),
        ).toBe(false);
        expect(hasAnswers({ __blocks: { profile: { description: '' } } })).toBe(false);
    });

    it('counts a real answer, tag or ticked flag', () => {
        expect(hasAnswers({ 'q:a:1': 'text' })).toBe(true);
        expect(hasAnswers({ __blocks: { tags: { sector: ['Health'] } } })).toBe(true);
        expect(hasAnswers({ __blocks: { risks: [{ termNotApplicable: true }] } })).toBe(true);
    });

    it('builds questionnaire gutter entries', () => {
        expect(
            questionnaireVersionEntries([
                { pid: 'a', questionnaire_id: 'q', number: 1, definition: {}, created_at: '', created_by: '' },
                { pid: 'b', questionnaire_id: 'q', number: 2, definition: {}, created_at: '', created_by: '' },
            ]),
        ).toEqual([
            { id: '1', label: 'v1' },
            { id: '2', label: 'v2' },
        ]);
    });

    it('labels drafts in qualification chains', () => {
        expect(
            qualificationVersionEntries([
                { pid: 'd', questionnaire_id: 'q', answers: {}, system_card: null, status: 'draft', system_version: null },
                {
                    pid: 'c', questionnaire_id: 'q', answers: {}, system_card: {}, status: 'completed',
                    system_version: {
                        pid: 'v', project_id: 'p', number: 1, name: 'S', version: '',
                        provider: '', description: '', created_at: '', created_by: '',
                    },
                },
            ]),
        ).toEqual([
            { id: 'd', label: 'draft' },
            { id: 'c', label: 'v1' },
        ]);
    });

    it('parses questionnaire imports', () => {
        expect(parseQuestionnaireImport('{"name":"A","definition":{"blocks":[]}}')).toEqual({
            name: 'A',
            definition: { blocks: [] },
        });
        expect(parseQuestionnaireImport('{"blocks":[]}')).toEqual({
            name: 'Imported questionnaire',
            definition: { blocks: [] },
        });
        expect(() => parseQuestionnaireImport('not json')).toThrow();
    });
});

describe('the objective set history', () => {
    const diff = {
        from_version: 1,
        to_version: null,
        added: ['CX-3'],
        removed: ['CX-2'],
        changed: [{ objective_id: 'CX-1', fields: [{ field: 'text', before: 'a', after: 'b' }] }],
        unchanged: ['CX-9'],
    };

    it('asks for the draft against the published version by default', async () => {
        const fetch = mockFetchOnce(diff);
        await getObjectiveSetDiff('p1', 's1');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/objective-sets/s1/diff'),
            expect.anything(),
        );
        // no version numbers: the backend picks the published version and the draft
        const url = String(fetch.mock.calls[0][0]);
        expect(url).not.toContain('from_version');
    });

    it('names the versions when two published ones are compared', async () => {
        const fetch = mockFetchOnce(diff);
        await getObjectiveSetDiff('p1', 's1', { fromVersion: 1, toVersion: 2 });
        const url = String(fetch.mock.calls[0][0]);
        expect(url).toContain('from_version=1');
        expect(url).toContain('to_version=2');
    });

    it('describes the change as a line a person reads', () => {
        expect(describeSetDiff(diff)).toBe('+CX-3 · −CX-2 · CX-1: text');
        expect(
            describeSetDiff({
                from_version: 1, to_version: null,
                added: [], removed: [], changed: [], unchanged: ['CX-1'],
            }),
        ).toBe('no change');
    });
});
