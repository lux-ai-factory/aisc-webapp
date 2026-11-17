// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import QualificationPrefill from './QualificationPrefill';
import {
    emptyBlocks,
    type PrefillResult,
    type QualificationBlocks,
} from '../lib/qualification';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const result: PrefillResult = {
    filename: 'system.txt',
    characters: 240,
    note: '',
    source: 'document',
    model: null,
    values: { system_name: 'Credit scoring assistant', provider: 'ACME' },
    filled: ['system_name', 'provider'],
    kept: [],
    proposed: ['system_name', 'provider'],
    profile: { description: 'Scores loans.' },
    profileFilled: ['description'],
    tags: { targetSystem: ['NarrowAI'] },
    tagsFilled: ['targetSystem'],
    risks: null,
    risksKept: false,
    risksProposed: 0,
    picks: { systemType: 'NarrowAI' },
    picksProposed: 1,
    unmatched: ['purpose'],
    unplaced: { company: 'ACME' },
};

beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal('fetch', fetchMock);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

async function render(
    answers: Record<string, string> = {},
    blocks: QualificationBlocks = emptyBlocks(),
    onApply: (answers: Record<string, string>, blocks: QualificationBlocks) => void = () => {},
) {
    await act(async () => {
        root.render(
            <QualificationPrefill
                open
                pid="p1"
                questionnaireId="q1"
                answers={answers}
                blocks={blocks}
                onClose={() => {}}
                onApply={onApply}
            />,
        );
    });
    await act(async () => {});
}

async function chooseFile() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Who provides the system?\nACME'], 'system.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {});
}

function button(label: string): HTMLButtonElement {
    return Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').includes(label),
    ) as HTMLButtonElement;
}

function radio(value: number): HTMLInputElement {
    return document.querySelectorAll('input[type="radio"]')[value] as HTMLInputElement;
}

function formData(init: RequestInit): FormData {
    return init.body as FormData;
}

describe('QualificationPrefill', () => {
    it('uploads the document and shows every suggestion for review', async () => {
        await render();
        await chooseFile();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('/projects/p1/qualification/prefill?questionnaire_id=q1');
        const sent = formData(init as RequestInit);
        expect(sent).toBeInstanceOf(FormData);
        expect(sent.get('mode')).toBe('empty');
        expect(sent.get('current')).toBe('{}');

        const text = document.body.textContent ?? '';
        expect(text).toContain('system.txt');
        expect(text).toContain('240 characters');
        expect(text).toContain('2 answers');
        expect(text).toContain('Credit scoring assistant');
        expect(text).toContain('Nothing found for: purpose');
        expect(text).toContain('which this form has no field for');
        expect(text).toContain('company');
    });

    it('sends the form as it stands, so the backend can keep what is typed', async () => {
        await render({ system_name: 'what I typed' });
        await chooseFile();
        const sent = formData(fetchMock.mock.calls[0][1] as RequestInit);
        expect(sent.get('current')).toBe(JSON.stringify({ system_name: 'what I typed' }));
    });

    it('reads the document again when the mode changes, sending the new mode', async () => {
        await render({ system_name: 'what I typed' });
        await chooseFile();
        await act(async () => {
            radio(1).click();
        });
        await act(async () => {});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(formData(fetchMock.mock.calls[1][1] as RequestInit).get('mode')).toBe('replace');
    });

    it('applies the merged answers and the blocks', async () => {
        let applied: { answers: Record<string, string>; blocks: QualificationBlocks } | null = null;
        await render({ system_name: 'what I typed' }, emptyBlocks(), (answers, blocks) => {
            applied = { answers, blocks };
        });
        await chooseFile();
        await act(async () => {
            button('Fill the form').click();
        });
        expect(applied).not.toBeNull();
        expect(applied!.answers).toEqual({
            system_name: 'Credit scoring assistant',
            provider: 'ACME',
        });
        expect(applied!.blocks.profile.description).toBe('Scores loans.');
        expect(applied!.blocks.tags.targetSystem).toEqual(['NarrowAI']);
    });

    it('keeps only the suggestions the person ticks', async () => {
        let applied: { answers: Record<string, string>; blocks: QualificationBlocks } | null = null;
        await render({}, emptyBlocks(), (answers, blocks) => {
            applied = { answers, blocks };
        });
        await chooseFile();
        const first = document.querySelector(
            'input[aria-label="keep system_name"]',
        ) as HTMLInputElement;
        await act(async () => {
            first.click();
        });
        await act(async () => {
            button('Fill the form').click();
        });
        expect(applied!.answers).toEqual({ provider: 'ACME' });
    });

    it('leaves the blocks behind when the person unticks them', async () => {
        let applied: { answers: Record<string, string>; blocks: QualificationBlocks } | null = null;
        await render({}, emptyBlocks(), (answers, blocks) => {
            applied = { answers, blocks };
        });
        await chooseFile();
        const keepBlocks = document.querySelector(
            'input[aria-label="keep the blocks"]',
        ) as HTMLInputElement;
        await act(async () => {
            keepBlocks.click();
        });
        await act(async () => {
            button('Fill the form').click();
        });
        expect(applied!.blocks).toEqual(emptyBlocks());
    });

    it('shows the refusal when the document cannot be read', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 415,
            json: async () => ({ detail: 'system.exe is not readable' }),
        });
        await render();
        await chooseFile();
        expect(document.body.textContent).toContain('system.exe is not readable');
        expect((button('Fill the form') as HTMLButtonElement).disabled).toBe(true);
    });

    it('says when the questionnaire has nothing to fill', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () =>
                ({
                    ...result,
                    values: {},
                    filled: [],
                    proposed: [],
                    profile: {},
                    profileFilled: [],
                    tags: {},
                    tagsFilled: [],
                    unmatched: [],
                    unplaced: {},
                    picks: {},
                    picksProposed: 0,
                    note: 'this questionnaire has no answerable questions to pre-fill',
                }) as PrefillResult,
        });
        await render();
        await chooseFile();
        expect(document.body.textContent).toContain('no answerable questions');
        expect((button('Fill the form') as HTMLButtonElement).disabled).toBe(true);
    });
});
