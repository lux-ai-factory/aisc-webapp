// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import QualificationPrefill from './QualificationPrefill';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const result = {
    filename: 'system.txt',
    characters: 240,
    proposals: [
        { field: 'system_name', value: 'Credit scoring assistant', line: 3, matched: 'What is the name of the system?' },
        { field: 'provider', value: 'ACME', line: 5, matched: 'Who provides the system?' },
    ],
    unmatched: ['purpose'],
    note: '',
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
    answers: Record<string, string>,
    onApply: (answers: Record<string, string>) => void = () => {},
) {
    await act(async () => {
        root.render(
            <QualificationPrefill
                open
                pid="p1"
                questionnaireId="q1"
                answers={answers}
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

describe('QualificationPrefill', () => {
    it('uploads the document and shows every suggestion for review', async () => {
        await render({});
        await chooseFile();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('/projects/p1/qualification/prefill?questionnaire_id=q1');
        expect((init as RequestInit).body).toBeInstanceOf(FormData);

        const text = document.body.textContent ?? '';
        expect(text).toContain('system.txt');
        expect(text).toContain('240 characters');
        expect(text).toContain('2 suggestions');
        expect(text).toContain('Credit scoring assistant');
        expect(text).toContain('from “What is the name of the system?”');
        expect(text).toContain('Nothing found for: purpose');
    });

    it('fills only the empty fields by default', async () => {
        let applied: Record<string, string> = {};
        await render({ system_name: 'what I typed' }, (answers) => {
            applied = answers;
        });
        await chooseFile();
        await act(async () => {
            button('Fill the form').click();
        });
        expect(applied).toEqual({ system_name: 'what I typed', provider: 'ACME' });
    });

    it('replaces the answers when the person says so', async () => {
        let applied: Record<string, string> = {};
        await render({ system_name: 'what I typed' }, (answers) => {
            applied = answers;
        });
        await chooseFile();
        const replace = Array.from(document.querySelectorAll('input[type="radio"]'))[1] as HTMLInputElement;
        await act(async () => {
            replace.click();
        });
        await act(async () => {
            button('Fill the form').click();
        });
        expect(applied).toEqual({ system_name: 'Credit scoring assistant', provider: 'ACME' });
    });

    it('keeps only the suggestions the person ticks', async () => {
        let applied: Record<string, string> = {};
        await render({}, (answers) => {
            applied = answers;
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
        expect(applied).toEqual({ provider: 'ACME' });
    });

    it('shows the refusal when the document cannot be read', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 415,
            json: async () => ({ detail: 'system.exe is not readable' }),
        });
        await render({});
        await chooseFile();
        expect(document.body.textContent).toContain('system.exe is not readable');
    });

    it('says when the questionnaire has nothing to fill', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                filename: 'system.txt',
                characters: 10,
                proposals: [],
                unmatched: [],
                note: 'this questionnaire has no answerable questions to pre-fill',
            }),
        });
        await render({});
        await chooseFile();
        expect(document.body.textContent).toContain('no answerable questions');
        expect((button('Fill the form') as HTMLButtonElement).disabled).toBe(true);
    });
});
