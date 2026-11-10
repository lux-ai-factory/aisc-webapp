// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import QualificationPage from './QualificationPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
        fileUploadingPids: new Set<string>(),
        addFileUploadingPid: () => {},
        removeFileUploadingPid: () => {},
    }),
}));

const routes: { match: (url: string, init?: RequestInit) => boolean; payload: unknown; status?: number }[] = [];

function route(match: (url: string, init?: RequestInit) => boolean, payload: unknown, status = 200) {
    routes.push({ match, payload, status });
}

function jsonResponse(payload: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    routes.length = 0;
    route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
        { pid: 'q1', name: 'Annex IV', definition: { blocks: [{ id: 'b1' }] } },
    ]);
    route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: 'q1' });
    route((url) => url.endsWith('/projects/p1/qualification'), [
        { pid: 'd1', questionnaire_id: 'q1', answers: { a: 1 }, system_card: null, status: 'draft', system_version: null },
    ]);
    route((url) => url.endsWith('/questionnaires/default'), {
        id: 'annex-iv-default',
        name: 'Annex IV default',
        description: '',
        version: 1,
        definition: {
            blocks: [],
            questions: [
                { field: 'q:annex-1:1a', text: 'What changed?', citation: 'Annex IV(1)(a)', required: true },
                { field: 'q:annex-1:1b', text: 'Any hardware?', citation: '', required: false },
            ],
        },
    });
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const hit = routes.find((r) => r.match(url, init));
            if (!hit) throw new Error(`unexpected fetch: ${url}`);
            return Promise.resolve(jsonResponse(hit.payload, hit.status));
        }),
    );
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

async function renderPage() {
    await act(async () => {
        root.render(<QualificationPage />);
    });
    await act(async () => {});
}

function bodyText(): string {
    return document.body.textContent ?? '';
}

function fieldByLabel(label: string): HTMLInputElement | HTMLTextAreaElement {
    const labelEl = Array.from(document.body.querySelectorAll('label')).find(
        (l) => l.textContent === label,
    ) as HTMLLabelElement | undefined;
    if (!labelEl?.htmlFor) throw new Error(`no field with label ${label}`);
    const input = document.getElementById(labelEl.htmlFor) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
    if (!input) throw new Error(`no input for label ${label}`);
    return input;
}

describe('QualificationPage', () => {
    it('renders questionnaires and drafts', async () => {
        await renderPage();
        expect(bodyText()).toContain('Qualification');
        expect(bodyText()).toContain('Annex IV');
    });

    it('shows an empty state with no questionnaires', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1'), []);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: null });
        route((url) => url.endsWith('/projects/p1/qualification'), []);
        route((url) => url.endsWith('/questionnaires/default'), { detail: 'missing' }, 404);
        await renderPage();
        expect(bodyText()).toContain('No questionnaires yet');
    });

    it('renders the service-owned built-in default', async () => {
        await renderPage();
        expect(bodyText()).toContain('Annex IV default');
        expect(bodyText()).toContain('built-in');
        expect(bodyText()).toContain('2 questions');
    });

    it('opens per-question answer fields for the built-in default', async () => {
        await renderPage();
        const card = document.body.querySelector('.gradient-card') as HTMLElement;
        expect(card).toBeTruthy();
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        const text = bodyText();
        expect(text).toContain('What changed?');
        expect(text).toContain('Any hardware?');
        expect(text).toContain('Annex IV(1)(a)');
        expect(text).toContain('(optional)');
        expect(
            document.body.querySelectorAll('[aria-label="q:annex-1:1a"]').length,
        ).toBeGreaterThan(0);
    });

    it('completes a draft when Complete is clicked', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                if (url.includes('/complete')) {
                    return Promise.resolve(
                        jsonResponse({ pid: 'd1', status: 'completed', system_version: { number: 1 } }),
                    );
                }
                const hit = routes.find((r) => r.match(url, init));
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const card = document.body.querySelector('.gradient-card') as HTMLElement;
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('Answer — Annex IV default');
    });

    it('opens the answer drawer with the version dropdown', async () => {
        await renderPage();
        const card = document.body.querySelector('.gradient-card') as HTMLElement;
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('Answer — Annex IV default');
    });

    it('exports the current answers as a JSON file', async () => {
        const blobs: Blob[] = [];
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn((blob: Blob) => {
                blobs.push(blob);
                return 'blob:answers';
            }),
            revokeObjectURL: vi.fn(),
        });
        await renderPage();
        const card = document.body.querySelector('.gradient-card') as HTMLElement;
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        const field = document.body.querySelector(
            '[aria-label="q:annex-1:1a"]',
        ) as HTMLTextAreaElement;
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                'value',
            )!.set!;
            setter.call(field, 'my answer');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const exportButton = document.body.querySelector<HTMLButtonElement>(
            'button[aria-label="Export answers"]',
        );
        expect(exportButton).toBeTruthy();
        await act(async () => {
            exportButton!.click();
        });
        expect(blobs.length).toBe(1);
        const payload = JSON.parse(await blobs[0].text()) as Record<string, unknown>;
        expect(payload['questionnaire_id']).toBe('annex-iv-default');
        expect(payload['answers']).toEqual({ 'q:annex-1:1a': 'my answer' });
    });

    it('imports an answers file into the fields', async () => {
        await renderPage();
        const card = document.body.querySelector('.gradient-card') as HTMLElement;
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        const inputs = Array.from(
            document.body.querySelectorAll('input[type="file"]'),
        ) as HTMLInputElement[];
        const answersInput = inputs[inputs.length - 1];
        const file = new File(
            [JSON.stringify({ questionnaire_id: 'annex-iv-default', answers: { 'q:annex-1:1a': 'imported!' } })],
            'answers.json',
            { type: 'application/json' },
        );
        await act(async () => {
            Object.defineProperty(answersInput, 'files', { value: [file], configurable: true });
            answersInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await act(async () => {});
        const field = document.body.querySelector(
            '[aria-label="q:annex-1:1a"]',
        ) as HTMLTextAreaElement;
        expect(field.value).toContain('imported!');
    });

    it('builds a questionnaire from blocks and questions, not JSON', async () => {
        const posts: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if (init?.method === 'POST' && url.includes('/questionnaires/projects/p1')) {
                    posts.push(JSON.parse(String(init.body)));
                    return Promise.resolve(
                        jsonResponse({ pid: 'q2', name: 'Mine', definition: {} }),
                    );
                }
                const hit = routes.find((r) => r.match(url, init));
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const add = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add') && !b.textContent?.includes('Add question'),
        );
        expect(add).toBeTruthy();
        await act(async () => {
            add!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('New questionnaire');
        expect(bodyText()).toContain('Sections (blocks)');

        // toggle the risks section on
        const risksChip = Array.from(document.body.querySelectorAll('.MuiChip-root')).find(
            (c) => (c.textContent ?? '') === 'Risks',
        ) as HTMLElement;
        await act(async () => {
            risksChip.click();
        });
        await act(async () => {});

        // add a question
        const addQuestion = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add question'),
        );
        expect(addQuestion).toBeTruthy();
        await act(async () => {
            addQuestion!.click();
        });
        await act(async () => {});

        // type the question text -> auto-slug field key
        const nameInput = fieldByLabel('Name');
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(nameInput, 'Mine');
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {});

        const questionInput = fieldByLabel('Question text');
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(questionInput, 'Does the system self-learn?');
            questionInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {});

        // save
        const create = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Create',
        );
        await act(async () => {
            create!.click();
        });
        await act(async () => {});
        expect(posts.length).toBe(1);
        const payload = posts[0] as {
            name: string;
            definition: { blocks: string[]; questions: Array<{ field: string; text: string; required: boolean }> };
        };
        expect(payload.name).toBe('Mine');
        expect(payload.definition.blocks).toContain('risks');
        expect(payload.definition.questions).toHaveLength(1);
        expect(payload.definition.questions[0].field).toBe('does-the-system-self-learn');
        expect(payload.definition.questions[0].required).toBe(false);
    });

    it('edits a questionnaire definition and saves it with a PUT', async () => {
        routes.unshift({
            match: (url, init) => init?.method === 'PUT' && url.endsWith('/questionnaires/projects/p1/q1'),
            payload: { pid: 'q1', name: 'Annex IV', definition: { blocks: [] } },
        });
        await renderPage();
        const edit = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        expect(edit).toBeTruthy();
        await act(async () => {
            edit!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('Edit definition — Annex IV');
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save',
        );
        expect(save).toBeTruthy();
        await act(async () => {
            save!.click();
        });
        await act(async () => {});
        const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
        const put = calls.find(([url, init]) => init?.method === 'PUT' && url.endsWith('/questionnaires/projects/p1/q1'));
        expect(put).toBeTruthy();
    });

    it('edits a question text in the builder and saves the new definition', async () => {
        routes.unshift({
            match: (url, init) => !init?.method && url.includes('/questionnaires/projects/p1') && !url.includes('/versions'),
            payload: [
                {
                    pid: 'q1',
                    name: 'Annex IV',
                    definition: {
                        blocks: [],
                        questions: [{ field: 'q:annex-1:1a', text: 'Old text', citation: '', required: false }],
                    },
                },
            ],
        });
        routes.unshift({
            match: (url, init) => init?.method === 'PUT' && url.endsWith('/questionnaires/projects/p1/q1'),
            payload: { pid: 'q1', name: 'Annex IV', definition: {} },
        });
        await renderPage();
        const edit = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        expect(edit).toBeTruthy();
        await act(async () => {
            edit!.click();
        });
        await act(async () => {});
        const field = fieldByLabel('Question text');
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(field, 'New text');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save',
        );
        await act(async () => {
            save!.click();
        });
        await act(async () => {});
        const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
        const put = calls.find(([url, init]) => init?.method === 'PUT' && url.endsWith('/questionnaires/projects/p1/q1'));
        expect(put).toBeTruthy();
        expect(String(put![1]?.body)).toContain('New text');
    });

    it('lists the questionnaire versions in the edit drawer dropdown', async () => {
        routes.unshift({
            match: (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            payload: [
                { pid: 'v1', questionnaire_id: 'q1', number: 1, definition: { blocks: [] }, created_at: '', created_by: '' },
                { pid: 'v2', questionnaire_id: 'q1', number: 2, definition: { blocks: [] }, created_at: '', created_by: '' },
            ],
        });
        await renderPage();
        const edit = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        await act(async () => {
            edit!.click();
        });
        await act(async () => {});
        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('v2'),
        );
        expect(trigger).toBeTruthy();
        await act(async () => {
            trigger!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('v1');
        expect(bodyText()).toContain('v2');
    });

    it('lists the questionnaire versions in the answer drawer', async () => {
        routes.unshift({
            match: (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            payload: [
                { pid: 'v1', questionnaire_id: 'q1', number: 1, definition: { blocks: [] }, created_at: '', created_by: '' },
                { pid: 'v2', questionnaire_id: 'q1', number: 2, definition: { blocks: [] }, created_at: '', created_by: '' },
            ],
        });
        await renderPage();
        const editButton = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        const card = editButton?.closest('.MuiCard-root') as HTMLElement | null;
        expect(card).toBeTruthy();
        await act(async () => {
            card!.click();
        });
        await act(async () => {});
        const trigger = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('v2'),
        );
        expect(trigger).toBeTruthy();
        await act(async () => {
            trigger!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('v1');
    });

    it('reopens the answer drawer on the questionnaire version picked before', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
            {
                pid: 'q1',
                name: 'Annex IV',
                definition: {
                    blocks: [],
                    questions: [
                        { field: 'q:annex-1:2nd', text: 'Second revision question', citation: '', required: false },
                    ],
                },
                version: 2,
            },
        ]);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: 'q1' });
        route((url) => url.endsWith('/projects/p1/qualification'), []);
        route((url) => url.endsWith('/questionnaires/default'), { detail: 'missing' }, 404);
        routes.push({
            match: (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            payload: [
                {
                    pid: 'v1',
                    questionnaire_id: 'q1',
                    number: 1,
                    definition: {
                        blocks: [],
                        questions: [
                            { field: 'q:annex-1:1st', text: 'First revision question', citation: '', required: false },
                        ],
                    },
                    created_at: '',
                    created_by: '',
                },
                {
                    pid: 'v2',
                    questionnaire_id: 'q1',
                    number: 2,
                    definition: {
                        blocks: [],
                        questions: [
                            { field: 'q:annex-1:2nd', text: 'Second revision question', citation: '', required: false },
                        ],
                    },
                    created_at: '',
                    created_by: '',
                },
            ],
        });
        await renderPage();
        const openCard = () =>
            Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
                (c) => c.textContent?.includes('Annex IV'),
            ) as HTMLElement;
        // open the answer drawer: head revision is shown
        await act(async () => {
            openCard().click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('Second revision question');
        // pick the first revision in the version dropdown
        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
        );
        await act(async () => {
            trigger!.click();
        });
        await act(async () => {});
        const v1Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim() === 'v1',
        )!;
        const label = Array.from(v1Item.querySelectorAll('*')).find(
            (el) => el.textContent?.trim() === 'v1',
        ) as HTMLElement;
        await act(async () => {
            label.closest('div')!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('First revision question');
        // close, then reopen by clicking the card again: the picked revision,
        // not the head, must be shown
        await act(async () => {
            document.body.querySelector<HTMLButtonElement>('button[aria-label="Close panel"]')!.click();
        });
        await act(async () => {});
        expect(bodyText()).not.toContain('First revision question');
        await act(async () => {
            openCard().click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('First revision question');
    });

    it('keeps the chosen questionnaire version on the card and drawer dropdown', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
            { pid: 'q1', name: 'Annex IV', definition: { blocks: [{ id: 'b1' }] }, version: 2 },
        ]);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: 'q1' });
        route((url) => url.endsWith('/projects/p1/qualification'), []);
        route((url) => url.endsWith('/questionnaires/default'), {
            id: 'annex-iv-default', name: 'Annex IV default', description: '', version: 1,
            definition: { blocks: [], questions: [] },
        });
        routes.push({
            match: (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            payload: [
                { pid: 'v1', questionnaire_id: 'q1', number: 1, definition: { blocks: [{ id: 'a' }] }, created_at: '', created_by: '' },
                { pid: 'v2', questionnaire_id: 'q1', number: 2, definition: { blocks: [{ id: 'b' }] }, created_at: '', created_by: '' },
            ],
        });
        await renderPage();
        const card = Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
            (c) => c.textContent?.includes('Annex IV') && !c.textContent?.includes('default'),
        );
        expect(card?.textContent).toContain('config v2');
        // pick v1 in the edit drawer dropdown
        const edit = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        await act(async () => { edit!.click(); });
        await act(async () => {});
        const trigger = Array.from(document.body.querySelectorAll('button')).find((b) =>
            b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
        );
        await act(async () => { trigger!.click(); });
        await act(async () => {});
        const v1Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim() === 'v1',
        )!;
        const label = Array.from(v1Item.querySelectorAll('*')).find(
            (el) => el.textContent?.trim() === 'v1',
        ) as HTMLElement;
        await act(async () => { label.closest('div')!.click(); });
        await act(async () => {});
        expect(card?.textContent).toContain('config v1');
        // closing and reopening the drawer must keep v1 selected
        await act(async () => {
            document.body.querySelector<HTMLButtonElement>('button[aria-label="Close panel"]')!.click();
        });
        await act(async () => {});
        expect(card?.textContent).toContain('config v1');
        const edit2 = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV"]');
        await act(async () => { edit2!.click(); });
        await act(async () => {});
        expect(
            Array.from(document.body.querySelectorAll('button')).find((b) =>
                b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
            )?.textContent,
        ).toContain('v1');
    });

    it('copies the built-in questionnaire into the project when it is edited', async () => {
        routes.unshift({
            match: (url, init) => init?.method === 'POST' && url.endsWith('/questionnaires/projects/p1'),
            payload: { pid: 'copy1', name: 'Annex IV default', definition: { blocks: [] } },
        });
        await renderPage();
        const edit = document.body.querySelector<HTMLButtonElement>('button[aria-label="Edit Annex IV default"]');
        expect(edit).toBeTruthy();
        await act(async () => {
            edit!.click();
        });
        await act(async () => {});
        const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
        const post = calls.find(([url, init]) => init?.method === 'POST' && url.endsWith('/questionnaires/projects/p1'));
        expect(post).toBeTruthy();
        expect(bodyText()).toContain('Edit definition — Annex IV default');
    });

    it('shows generated AI cards and opens the card viewer from one', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
            { pid: 'q1', name: 'Annex IV', definition: { blocks: [] } },
        ]);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: 'q1' });
        const card = {
            pid: 'd2',
            questionnaire_id: 'q1',
            questionnaire_version: 2,
            answers: { 'q:annex-1:1a': 'answer' },
            system_card: {
                view: {
                    summary: { label: 'Triage system v1' },
                    counts: { nodes: 12 },
                },
            },
            status: 'completed',
            system_version: { number: 1 },
        };
        route(
            (url) => url.endsWith('/projects/p1/qualification'),
            [card],
        );
        route(
            (url) => url.includes('/qualification/d2/versions'),
            [card],
        );
        route((url) => url.endsWith('/questionnaires/default'), {
            id: 'annex-iv-default',
            name: 'Annex IV default',
            description: '',
            version: 1,
            definition: { blocks: [], questions: [] },
        });
        route((url) => url.endsWith('/qualification/vocabularies'), {});
        await renderPage();
        expect(bodyText()).toContain('AI cards');
        expect(bodyText()).toContain('Annex IV');
        expect(bodyText()).toContain('v1');
        expect(bodyText()).toContain('12 nodes');

        const cardElement = Array.from(document.body.querySelectorAll('.gradient-card')).find(
            (c) => c.textContent?.includes('Annex IV') && c.textContent?.includes('config v2'),
        ) as HTMLElement;
        expect(cardElement).toBeTruthy();
        await act(async () => {
            cardElement.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('AI card');
        expect(bodyText()).toContain('AI card graph');
        // the answer version (system v1) is distinct from the questionnaire config
        // version the answers were filled against (config v2) — both visible in the drawer
        const drawer = document.querySelector('.side-drawer-paper') as HTMLElement | null;
        expect(drawer?.textContent).toContain('v1');
        expect(drawer?.textContent).toContain('config v2');
    });
});
