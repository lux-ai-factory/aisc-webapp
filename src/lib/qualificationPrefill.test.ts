// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
    applyPrefill,
    askCardAgent,
    componentFlag,
    describeSuggestion,
    prefillQualification,
    setRowsFromCatalogue,
    type CardComponentLink,
    type PrefillSuggestion,
} from './qualification';

afterEach(() => {
    vi.unstubAllGlobals();
});

const proposal = (field: string, value: string): PrefillSuggestion => ({
    field,
    value,
    line: 3,
    matched: 'a question',
});

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
    it('fills the empty fields and leaves the answered ones alone', () => {
        const answers = { system_name: 'mine', purpose: '' };
        const out = applyPrefill(
            answers,
            [proposal('system_name', 'from the file'), proposal('purpose', 'from the file')],
            'empty',
        );
        expect(out).toEqual({ system_name: 'mine', purpose: 'from the file' });
    });

    it('replaces the answers when asked to, and only the proposed fields', () => {
        const out = applyPrefill(
            { system_name: 'mine', untouched: 'kept' },
            [proposal('system_name', 'from the file')],
            'replace',
        );
        expect(out).toEqual({ system_name: 'from the file', untouched: 'kept' });
    });

    it('treats a whitespace-only answer as empty', () => {
        expect(applyPrefill({ a: '   ' }, [proposal('a', 'x')], 'empty').a).toBe('x');
    });
});

describe('the prefill request', () => {
    it('uploads the file as multipart, with the questionnaire when known', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                filename: 'system.txt',
                characters: 120,
                proposals: [],
                unmatched: [],
                note: '',
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const file = new File(['hello'], 'system.txt', { type: 'text/plain' });
        const body = await prefillQualification('p1', file, 'q1');

        expect(body.filename).toBe('system.txt');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/projects/p1/qualification/prefill?questionnaire_id=q1');
        expect((init as RequestInit).method).toBe('POST');
        expect((init as RequestInit).body).toBeInstanceOf(FormData);
        expect((init as RequestInit).headers).toBeUndefined();
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
