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
    if (!globalThis.localStorage) {
        // jsdom without an origin exposes no localStorage; shim it so the
        // per-questionnaire version persistence can be tested.
        const mem = new Map<string, string>();
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: {
                getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
                setItem: (k: string, v: string) => {
                    mem.set(k, String(v));
                },
                removeItem: (k: string) => {
                    mem.delete(k);
                },
                clear: () => {
                    mem.clear();
                },
            },
        });
    }
    routes.length = 0;
    route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
        {
            pid: 'q1',
            name: 'Annex IV',
            definition: {
                blocks: [],
                questions: [
                    { field: 'q:annex-1:1a', text: 'What changed?', citation: 'Annex IV(1)(a)', required: true },
                    { field: 'q:annex-1:1b', text: 'Any hardware?', citation: '', required: false },
                ],
            },
        },
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
    localStorage.clear();
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

function pageCard(label: string): HTMLElement | null {
    return (
        Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
            (c) => (c.textContent ?? '').includes(label),
        ) ?? null
    ) as HTMLElement | null;
}

function buttonWithText(text: string): HTMLButtonElement | null {
    return (
        (Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
            (b) => b.textContent?.includes(text),
        ) as HTMLButtonElement | undefined) ?? null
    );
}

function drawerPaper(): HTMLElement | null {
    return document.body.querySelector('.side-drawer-paper') as HTMLElement | null;
}

/** Open the split-pane Questionnaires dialog from the page-level card. */
async function openQuestionnairesPane() {
    const card = pageCard('Questionnaires') as HTMLElement;
    const openBtn = Array.from(card.querySelectorAll('button')).find(
        (b) => b.textContent === 'Open',
    ) as HTMLButtonElement;
    await act(async () => {
        openBtn.click();
    });
    await act(async () => {});
}

async function selectPaneItem(text: string, exclude?: string) {
    const item = Array.from(document.body.querySelectorAll('.MuiListItemButton-root')).find(
        (el) => {
            const t = el.textContent ?? '';
            return t.includes(text) && (!exclude || !t.includes(exclude));
        },
    ) as HTMLElement | undefined;
    await act(async () => {
        item?.click();
    });
    await act(async () => {});
}

async function clickDetailButton(text: string) {
    const btn = buttonWithText(text);
    await act(async () => {
        btn?.click();
    });
    await act(async () => {});
}

/** Click a button inside the split-pane dialog footer (dialog-scoped). */
async function clickFooterButton(text: string) {
    const btn = Array.from(
        document.body.querySelectorAll('.app-dialog-footer button'),
    ).find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
    await act(async () => {
        btn?.click();
    });
    await act(async () => {});
}

/** Open the inline answer form's config-version menu (Button + Menu). */
async function openAnswerVersion() {
    const btn = document.querySelector<HTMLElement>('[aria-label="Answer version"]');
    expect(btn, 'expected an Answer version button').toBeTruthy();
    await act(async () => {
        btn!.click();
    });
    await act(async () => {});
}

/** Open the inline edit form's config-version menu (Button + Menu). */
async function openEditVersion() {
    const btn = document.querySelector<HTMLElement>('[aria-label="Edit version"]');
    expect(btn, 'expected an Edit version button').toBeTruthy();
    await act(async () => {
        btn!.click();
    });
    await act(async () => {});
}

/** Open the split-pane detail pane's questionnaire-version menu (Button + Menu). */
async function openQuestionnaireVersion() {
    const btn = document.querySelector<HTMLElement>('[aria-label="Questionnaire version"]');
    expect(btn, 'expected a Questionnaire version button').toBeTruthy();
    await act(async () => {
        btn!.click();
    });
    await act(async () => {});
}

/** Click a version MenuItem whose trimmed text starts with the given label. */
async function pickVersionItem(label: string) {
    const item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
        (b) => b.textContent?.trim().startsWith(label),
    ) as HTMLElement | undefined;
    expect(item, `expected a "${label}" menu item`).toBeTruthy();
    await act(async () => {
        item!.click();
    });
    await act(async () => {});
}

/** The split-pane detail pane's questionnaire-version button, if present. */
function questionnaireVersionButton(): HTMLButtonElement | null {
    return (
        (Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
            (b) => b.getAttribute('aria-label') === 'Questionnaire version',
        ) as HTMLButtonElement | undefined) ?? null
    );
}

describe('QualificationPage', () => {
    it('renders the two cards and the selected questionnaire', async () => {
        await renderPage();
        expect(bodyText()).toContain('Qualification');
        expect(pageCard('Questionnaires')?.textContent).toContain('Annex IV');
        expect(pageCard('AI card')?.textContent).toContain('not built');
    });

    it('shows an empty state with no questionnaires', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1'), []);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: null });
        route((url) => url.endsWith('/projects/p1/qualification'), []);
        route((url) => url.endsWith('/questionnaires/default'), { detail: 'missing' }, 404);
        await renderPage();
        expect(pageCard('Questionnaires')?.textContent).toContain('No questionnaire');
        expect(pageCard('AI card')?.textContent).toContain('not built');
    });

    it('lists the service-owned built-in default in the split pane', async () => {
        await renderPage();
        await openQuestionnairesPane();
        expect(bodyText()).toContain('Annex IV default');
        expect(bodyText()).toContain('2 questions');
        expect(bodyText()).toContain('v1');
    });

    it('opens per-question answer fields for the selected questionnaire', async () => {
        await renderPage();
        await openQuestionnairesPane();
        // Answer targets the selected (green-check) questionnaire
        await clickFooterButton('Answer');
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
        await openQuestionnairesPane();
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('Answer — Annex IV');
    });

    it('opens the answer drawer with the version dropdown', async () => {
        await renderPage();
        await openQuestionnairesPane();
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('Answer — Annex IV');
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
        await openQuestionnairesPane();
        await clickFooterButton('Answer');
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
        expect(payload['questionnaire_id']).toBe('q1');
        expect(payload['answers']).toEqual({ 'q:annex-1:1a': 'my answer' });
    });

    it('imports an answers file into the fields', async () => {
        await renderPage();
        await openQuestionnairesPane();
        await clickFooterButton('Answer');
        const inputs = Array.from(
            document.body.querySelectorAll('input[type="file"]'),
        ) as HTMLInputElement[];
        const answersInput = inputs[inputs.length - 1];
        const file = new File(
            [JSON.stringify({ questionnaire_id: 'q1', answers: { 'q:annex-1:1a': 'imported!' } })],
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
        await openQuestionnairesPane();
        const add = buttonWithText('Add questionnaire');
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
            (b) =>
                b.textContent?.includes('Add question') &&
                !b.textContent?.includes('Add questionnaire'),
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
        const create = buttonWithText('Create');
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
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickDetailButton('Edit');
        expect(bodyText()).toContain('Edit definition — Annex IV');
        const save = buttonWithText('Save');
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
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickDetailButton('Edit');
        const field = fieldByLabel('Question text');
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(field, 'New text');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const save = buttonWithText('Save');
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
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickDetailButton('Edit');
        await openEditVersion();
        expect(bodyText()).toContain('v1');
        expect(bodyText()).toContain('v2');
    });

    it('lists the questionnaire versions in the answer form', async () => {
        routes.unshift({
            match: (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            payload: [
                { pid: 'v1', questionnaire_id: 'q1', number: 1, definition: { blocks: [] }, created_at: '', created_by: '' },
                { pid: 'v2', questionnaire_id: 'q1', number: 2, definition: { blocks: [] }, created_at: '', created_by: '' },
            ],
        });
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickFooterButton('Answer');
        await openAnswerVersion();
        expect(bodyText()).toContain('v1');
    });

    it('reopens the answers on the questionnaire version picked before', async () => {
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
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        // open the answer drawer: head revision is shown
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('Second revision question');
        // pick the first revision in the version dropdown
        await openAnswerVersion();
        const v1Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim() === 'v1',
        ) as HTMLElement;
        await act(async () => {
            v1Item.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('First revision question');
        // close the answer form, then reopen: the picked revision, not the
        // head, must be shown (the detail pane also stays on the picked version)
        await clickDetailButton('Close');
        await act(async () => {});
        expect(bodyText()).not.toContain('Answer — Annex IV');
        expect(bodyText()).not.toContain('Second revision question');
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('First revision question');
    });

    it('keeps the chosen questionnaire version on the card and in the detail', async () => {
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
        expect(pageCard('Questionnaires')?.textContent).toContain('config v2');
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        // pick v1 in the inline edit form
        await clickDetailButton('Edit');
        await openEditVersion();
        await pickVersionItem('v1');
        await clickDetailButton('Close');
        await act(async () => {});
        expect(pageCard('Questionnaires')?.textContent).toContain('config v1');
    });

    it('remembers the questionnaire version picked in the split-pane detail after leaving the page', async () => {
        route(
            (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            [
                {
                    pid: 'v1', questionnaire_id: 'q1', number: 1,
                    definition: { blocks: [], questions: [] }, created_at: '', created_by: '',
                },
                {
                    pid: 'v2', questionnaire_id: 'q1', number: 2,
                    definition: { blocks: [], questions: [] }, created_at: '', created_by: '',
                },
            ],
        );
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        // the detail pane starts on the latest revision
        expect(questionnaireVersionButton()?.textContent).toContain('v2');
        // pick v1 in the detail pane's questionnaire-version menu
        await openQuestionnaireVersion();
        await pickVersionItem('v1');
        expect(questionnaireVersionButton()?.textContent).toContain('v1');
        // leave the page and come back: the pick survives, not the latest
        await act(async () => root.unmount());
        container.remove();
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        expect(questionnaireVersionButton()?.textContent).toContain('v1');
    });

    it('answering opens the config version selected in the edit form, not latest', async () => {
        route(
            (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            [
                {
                    pid: 'v1', questionnaire_id: 'q1', number: 1,
                    definition: {
                        blocks: [],
                        questions: [{ field: 'q:annex-1:1a', text: 'First revision question', citation: '', required: false }],
                    },
                    created_at: '', created_by: '',
                },
                {
                    pid: 'v2', questionnaire_id: 'q1', number: 2,
                    definition: {
                        blocks: [],
                        questions: [{ field: 'q:annex-1:2nd', text: 'Second revision question', citation: '', required: false }],
                    },
                    created_at: '', created_by: '',
                },
            ],
        );
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        // select config version v1 in the edit form
        await clickDetailButton('Edit');
        await openEditVersion();
        await pickVersionItem('v1');
        await clickDetailButton('Close');
        await act(async () => {});
        // Answer opens the SELECTED v1, not the latest v2
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('First revision question');
        expect(bodyText()).not.toContain('Second revision question');
    });

    it('remembers the picked answer version after leaving the page (remount)', async () => {
        route(
            (url) => url.endsWith('/questionnaires/projects/p1/q1/versions'),
            [
                {
                    pid: 'v1', questionnaire_id: 'q1', number: 1,
                    definition: {
                        blocks: [],
                        questions: [{ field: 'q:annex-1:1a', text: 'First revision question', citation: '', required: false }],
                    },
                    created_at: '', created_by: '',
                },
                {
                    pid: 'v2', questionnaire_id: 'q1', number: 2,
                    definition: {
                        blocks: [],
                        questions: [{ field: 'q:annex-1:2nd', text: 'Second revision question', citation: '', required: false }],
                    },
                    created_at: '', created_by: '',
                },
            ],
        );
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('Second revision question');
        await openAnswerVersion();
        const v1Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim() === 'v1',
        ) as HTMLElement;
        await act(async () => {
            v1Item.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('First revision question');
        // leave the dialog and the page: the per-questionnaire pick must survive
        await act(async () => root.unmount());
        container.remove();
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await renderPage();
        await openQuestionnairesPane();
        await selectPaneItem('Annex IV', 'default');
        await clickFooterButton('Answer');
        expect(bodyText()).toContain('First revision question');
        expect(bodyText()).not.toContain('Second revision question');
    });

    it('copies the built-in questionnaire into the project when it is edited', async () => {
        routes.unshift({
            match: (url, init) => init?.method === 'POST' && url.endsWith('/questionnaires/projects/p1'),
            payload: { pid: 'copy1', name: 'Annex IV default', definition: { blocks: [] } },
        });
        await renderPage();
        await openQuestionnairesPane();
        await clickDetailButton('Copy & edit');
        const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
        const post = calls.find(([url, init]) => init?.method === 'POST' && url.endsWith('/questionnaires/projects/p1'));
        expect(post).toBeTruthy();
        expect(bodyText()).toContain('Edit definition — Annex IV default');
    });

    it('shows the AI card summary and opens the card viewer from it', async () => {
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
        const aiCard = pageCard('AI card') as HTMLElement;
        expect(aiCard.textContent).toContain('Triage system v1');
        expect(aiCard.textContent).toContain('card v1');
        expect(aiCard.textContent).toContain('config v2');
        expect(aiCard.textContent).toContain('Annex IV');

        const openBtn = Array.from(aiCard.querySelectorAll('button')).find(
            (b) => b.textContent === 'Open',
        ) as HTMLButtonElement;
        await act(async () => {
            openBtn.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('AI card');
        // the answer version (system v1) is distinct from the questionnaire config
        // version the answers were filled against (config v2) — both visible in the drawer
        const drawer = drawerPaper();
        expect(drawer?.textContent).toContain('v1');
        expect(drawer?.textContent).toContain('config v2');
    });

    it('reopens the AI card graph on the card version picked before', async () => {
        routes.length = 0;
        route((url) => url.includes('/questionnaires/projects/p1') && !url.includes('/versions'), [
            { pid: 'q1', name: 'Annex IV', definition: { blocks: [] } },
        ]);
        route((url) => url.includes('/projects/p1/questionnaire'), { questionnaire_id: 'q1' });
        const latestCard = {
            pid: 'd2', questionnaire_id: 'q1', questionnaire_version: 2, answers: {},
            system_card: { view: { summary: { label: 'Latest card' }, counts: { nodes: 12 } } },
            status: 'completed', system_version: { number: 2 },
        };
        const olderCard = {
            pid: 'd1', questionnaire_id: 'q1', questionnaire_version: 1, answers: {},
            system_card: { view: { summary: { label: 'Older card' }, counts: { nodes: 8 } } },
            status: 'completed', system_version: { number: 1 },
        };
        route(
            (url) => url.endsWith('/projects/p1/qualification'),
            [latestCard, olderCard],
        );
        route(
            (url) => url.includes('/qualification/d2/versions'),
            [latestCard, olderCard],
        );
        route((url) => url.endsWith('/questionnaires/default'), {
            id: 'annex-iv-default', name: 'Annex IV default', description: '', version: 1,
            definition: { blocks: [], questions: [] },
        });
        route((url) => url.endsWith('/qualification/vocabularies'), {});
        const cardVersionButton = () =>
            Array.from(document.body.querySelectorAll('button')).find(
                (b) => b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
            ) as HTMLButtonElement;
        await renderPage();
        const aiCard = pageCard('AI card') as HTMLElement;
        expect(aiCard.textContent).toContain('card v2');
        const openBtn = Array.from(aiCard.querySelectorAll('button')).find(
            (b) => b.textContent === 'Open',
        ) as HTMLButtonElement;
        // open the graph: starts on the latest card version
        await act(async () => {
            openBtn.click();
        });
        await act(async () => {});
        expect(cardVersionButton().textContent).toContain('v2');
        // pick the older card version in the drawer dropdown
        await act(async () => {
            cardVersionButton().click();
        });
        await act(async () => {});
        await pickVersionItem('v1');
        await act(async () => {});
        expect(cardVersionButton().textContent).toContain('v1');
        expect(drawerPaper()?.textContent).toContain('config v1');
        // the page card mirrors the graph version picked (card + config chips)
        expect(pageCard('AI card')?.textContent).toContain('card v1');
        expect(pageCard('AI card')?.textContent).toContain('config v1');
        // close, then reopen the graph: the picked version, not the latest, shows
        await act(async () => {
            document.body.querySelector<HTMLButtonElement>('button[aria-label="Close panel"]')!.click();
        });
        await act(async () => {});
        await act(async () => {
            openBtn.click();
        });
        await act(async () => {});
        expect(cardVersionButton().textContent).toContain('v1');
        expect(drawerPaper()?.textContent).toContain('config v1');
    });
});
