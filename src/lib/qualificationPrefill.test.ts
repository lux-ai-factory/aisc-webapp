// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
    applyPrefill,
    askCardAgent,
    componentFlag,
    describeSuggestion,
    emptyBlocks,
    prefillQualification,
    setRowsFromCatalogue,
    type CardComponentLink,
    type PrefillResult,
} from './qualification';

afterEach(() => {
    vi.unstubAllGlobals();
});

/** One reading, as the backend sends it: the shape is the pilot's. */
function reading(over: Partial<PrefillResult> = {}): PrefillResult {
    return {
        filename: 'system.txt',
        characters: 120,
        note: '',
        source: 'document',
        model: null,
        values: {},
        filled: [],
        kept: [],
        proposed: [],
        profile: {},
        profileFilled: [],
        tags: {},
        tagsFilled: [],
        risks: null,
        risksKept: false,
        risksProposed: 0,
        picks: {},
        picksProposed: 0,
        unmatched: [],
        unplaced: {},
        ...over,
    };
}

function link(over: Partial<CardComponentLink> = {}): CardComponentLink {
    return {
        component_key: 'c1',
        name: 'Risk model',
        component_type: 'model',
        role: 'in-house',
        engine_component_pid: 'e1',
        snapshot: {},
        changed: false,
        missing: false,
        captured_at: '2026-01-01T00:00:00Z',
        ...over,
    };
}

describe('applying a prefill', () => {
    const noBlocks = emptyBlocks();

    it('takes the answers the backend merged, and leaves the rest alone', () => {
        const { answers } = applyPrefill(
            { system_name: 'mine', untouched: 'kept' },
            noBlocks,
            reading({
                values: { system_name: 'mine', purpose: 'from the file' },
                proposed: ['system_name', 'purpose'],
                kept: ['system_name'],
                filled: ['purpose'],
            }),
        );
        expect(answers).toEqual({ system_name: 'mine', untouched: 'kept', purpose: 'from the file' });
    });

    it('puts a dropped suggestion back the way it was', () => {
        const { answers } = applyPrefill(
            { system_name: 'mine' },
            noBlocks,
            reading({
                values: { system_name: 'from the file', purpose: 'from the file' },
                proposed: ['system_name', 'purpose'],
                filled: ['system_name', 'purpose'],
            }),
            { taken: { system_name: false } },
        );
        expect(answers).toEqual({ system_name: 'mine', purpose: 'from the file' });
    });

    it('drops a field the person never answered when its suggestion is dropped', () => {
        const { answers } = applyPrefill(
            {},
            noBlocks,
            reading({ values: { purpose: 'from the file' }, proposed: ['purpose'], filled: ['purpose'] }),
            { taken: { purpose: false } },
        );
        expect(answers).toEqual({});
    });

    it('fills the profile block, the tag sets and the risk rows', () => {
        const { blocks } = applyPrefill(
            {},
            noBlocks,
            reading({
                profile: { description: 'Scores loans.', targetUseCase: 'creditworthiness' },
                profileFilled: ['description', 'targetUseCase'],
                tags: { targetSystem: ['NarrowAI'] },
                tagsFilled: ['targetSystem'],
                risks: [{
                    risk: 'a borderline applicant is refused', affected: 'user',
                    impactAreas: ['Right'], control: '', followUpControl: '',
                }],
                risksProposed: 1,
            }),
        );
        expect(blocks.profile.description).toBe('Scores loans.');
        expect(blocks.profile.targetUseCase).toBe('creditworthiness');
        expect(blocks.tags.targetSystem).toEqual(['NarrowAI']);
        // the row is kept as read, incomplete: the person finishes it
        expect(blocks.risks).toHaveLength(1);
        expect(blocks.risks[0].risk).toBe('a borderline applicant is refused');
        expect(blocks.risks[0].impactAreas).toEqual(['Right']);
        expect(blocks.risks[0].control).toBe('');
    });

    it('leaves the blocks alone when the person says so', () => {
        const before = emptyBlocks();
        const { blocks } = applyPrefill(
            {},
            before,
            reading({ profile: { description: 'Scores loans.' }, profileFilled: ['description'] }),
            { withBlocks: false },
        );
        expect(blocks).toEqual(before);
    });

    it('keeps the blocks the person already had', () => {
        const mine = emptyBlocks();
        mine.tags.sector = ['Health'];
        const { blocks } = applyPrefill(
            {},
            mine,
            reading({ profile: { description: 'Scores loans.' }, profileFilled: ['description'] }),
        );
        expect(blocks.tags.sector).toEqual(['Health']);
        expect(blocks.profile.description).toBe('Scores loans.');
    });
});

describe('the prefill request', () => {
    it('uploads the file as multipart, with the questionnaire, the mode and the form', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reading() });
        vi.stubGlobal('fetch', fetchMock);

        const file = new File(['hello'], 'system.txt', { type: 'text/plain' });
        const body = await prefillQualification('p1', file, {
            questionnaireId: 'q1',
            mode: 'replace',
            current: { system_name: 'mine' },
        });

        expect(body.filename).toBe('system.txt');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/projects/p1/qualification/prefill?questionnaire_id=q1');
        expect((init as RequestInit).method).toBe('POST');
        const sent = (init as RequestInit).body as FormData;
        expect(sent).toBeInstanceOf(FormData);
        expect(sent.get('mode')).toBe('replace');
        expect(sent.get('current')).toBe(JSON.stringify({ system_name: 'mine' }));
        expect((init as RequestInit).headers).toBeUndefined();
    });

    it('defaults to the careful mode', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => reading() });
        vi.stubGlobal('fetch', fetchMock);
        await prefillQualification('p1', new File(['x'], 'a.txt'));
        const sent = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
        expect(sent.get('mode')).toBe('empty');
        expect(sent.get('current')).toBe('{}');
    });

    it('surfaces the backend saying the file cannot be read', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 415,
                json: async () => ({ detail: 'system.exe is not readable' }),
            }),
        );
        const file = new File(['x'], 'system.exe');
        await expect(prefillQualification('p1', file)).rejects.toThrow('is not readable');
    });
});

describe('the card agent', () => {
    it('sends the message and reads the proposals back', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                text: 'I would rename it.',
                proposals: [
                    { node_id: 'n1', property: 'label', value: 'Loan scoring', quote: 'rename', reason: '' },
                ],
                dropped: [],
                card: { nodes: [] },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const turn = await askCardAgent('p1', 'q1', 'rename the model');

        expect(turn.proposals[0].value).toBe('Loan scoring');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/projects/p1/qualification/q1/agent');
        expect((init as RequestInit).body).toBe(JSON.stringify({ message: 'rename the model' }));
    });

    it('says so when no model is configured', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                json: async () => ({ detail: 'no model is configured for the card agent' }),
            }),
        );
        await expect(askCardAgent('p1', 'q1', 'hi')).rejects.toThrow('no model is configured');
    });

    it('does not guess at a refusal it cannot read', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 503,
                json: async () => {
                    throw new Error('not json');
                },
            }),
        );
        await expect(askCardAgent('p1', 'q1', 'hi')).rejects.toThrow(
            'no model is configured for the card agent',
        );
    });
});

describe('how a card component stands against the engine', () => {
    it('says nothing when it still matches', () => {
        expect(componentFlag(link())).toBeNull();
    });

    it('flags a component the engine changed since', () => {
        expect(componentFlag(link({ changed: true }))).toEqual({
            label: 'changed in the engine since',
            tone: 'warning',
        });
    });

    it('flags a component the engine does not have, over "changed"', () => {
        expect(componentFlag(link({ missing: true, changed: true }))).toEqual({
            label: 'not in the engine',
            tone: 'info',
        });
    });
});

describe('what a mapper run says', () => {
    it('counts what it linked and what it let go', () => {
        expect(
            describeSuggestion({
                attempts: 1,
                created: [
                    { pid: 'm1', risk_pid: 'r1', objective_id: 'O1', quote: 'q', rationale: '', source: 'ai' },
                ],
                dropped: [],
            }),
        ).toBe('Linked 1 in 1 attempt.');
    });

    it('reports a run that found nothing', () => {
        expect(describeSuggestion({ attempts: 3, created: [], dropped: [] })).toBe(
            'Nothing to link (3 attempts).',
        );
    });

    it('reports what it left unlinked', () => {
        expect(
            describeSuggestion({
                attempts: 3,
                created: [],
                dropped: [{ risk: 'r1', objective_id: null, reason: 'no valid proposal within 3 attempt(s)' }],
            }),
        ).toBe('Linked 0, left 1 unlinked in 3 attempts.');
    });
});

describe('a set built from the catalogue', () => {
    it('copies each objective\'s own fields and leaves the free text blank', () => {
        const rows = setRowsFromCatalogue([
            {
                id: 'O1',
                macro_requirement: 'REQ1 Human Agency and Oversight',
                legal_basis: 'Art. 14',
                sub_requirement_label: 'Oversight',
                text: 'Keep a human in the loop',
                assessment_mode: 'manual',
            },
        ]);
        expect(rows).toEqual([
            {
                objective_id: 'O1',
                macro_requirement: 'REQ1 Human Agency and Oversight',
                legal_basis: 'Art. 14',
                sub_requirement_label: 'Oversight',
                text: 'Keep a human in the loop',
                assessment_mode: 'manual',
                target: '',
                standards_grounding: '',
                grounding_tier_flag: '',
                notes: '',
            },
        ]);
    });
});
