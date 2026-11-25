// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ControlObjectivesPage from './ControlObjectivesPage';

const toasts: string[] = [];
vi.mock('react-hot-toast', () => ({
    default: {
        error: (message: string) => {
            toasts.push(message);
        },
        success: () => {},
    },
}));

beforeEach(() => {
    toasts.length = 0;
});

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
    route((url) => url.includes('/control-objectives/matrix'), {
        priorities: [
            { objective_id: 'O1', score: 20, top_rating: 25, rank: 1, key: true, key_default: false, risk_ids: [], reasons: ['mitigates 1 risk rated 20 (Critical): score 20'] },
        ],
    });
    route((url) => url.includes('/control-objectives/catalogue'), [
        { id: 'O1', macro_requirement: 'REQ1 Human Agency and Oversight', legal_basis: 'Art 14', sub_requirement_label: '', text: 'Human oversight objective', assessment_mode: 'Control' },
    ]);
    route((url) => url.includes('/control-objectives/risks'), []);
    route((url) => url.includes('/control-objectives/mappings'), []);
    route((url) => url.includes('/control-objectives/profile'), { objectives: ['O1'], key_objectives: ['O1'] });
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
        root.render(<ControlObjectivesPage />);
    });
    await act(async () => {});
}

function bodyText(): string {
    return document.body.textContent ?? '';
}

describe('ControlObjectivesPage', () => {
    it('renders the objectives matrix with scores', async () => {
        await renderPage();
        expect(bodyText()).toContain('Control objectives');
        expect(bodyText()).toContain('O1');
        expect(bodyText()).toContain('score 20');
        expect(bodyText()).toContain('rank 1');
    });

    it('opens the catalogue detail for an objective', async () => {
        await renderPage();
        const card = Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
            (el) => el.textContent?.includes('O1') && el.textContent?.includes('Human oversight objective'),
        );
        expect(card).toBeTruthy();
        await act(async () => {
            (card as HTMLElement).click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('REQ1 Human Agency and Oversight');
        expect(bodyText()).toContain('Human oversight objective');
    });

    it('shows an empty state with no key objectives', async () => {
        routes.length = 0;
        route((url) => url.includes('/control-objectives/matrix'), { priorities: [] });
        route((url) => url.includes('/control-objectives/catalogue'), []);
        route((url) => url.includes('/control-objectives/risks'), []);
        route((url) => url.includes('/control-objectives/mappings'), []);
        route((url) => url.includes('/control-objectives/profile'), { objectives: [], key_objectives: [] });
        await renderPage();
        expect(bodyText()).toContain('No objectives selected yet');
    });

    it('adds a custom objective through the dialog', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const hit = routes.find((r) => r.match(url, init));
                if (url.includes('/control-objectives/catalogue') && (init?.method ?? 'GET') !== 'GET') {
                    return Promise.resolve(jsonResponse({ id: 'CX-1', custom: true }));
                }
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        );
        expect(explore).toBeTruthy();
        await act(async () => {
            explore!.click();
        });
        await act(async () => {});
        const add = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add a control objective'),
        );
        expect(add).toBeTruthy();
        await act(async () => {
            add!.click();
        });
        await act(async () => {});
        const setValue = (label: string, value: string) => {
            const field = Array.from(document.body.querySelectorAll('input')).find(
                (i) => i.labels?.[0]?.textContent?.includes(label),
            ) as HTMLInputElement;
            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(field, value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setValue('ID', 'CX-1');
        setValue('Macro requirement', 'REQX Custom');
        const textArea = Array.from(document.body.querySelectorAll('textarea')).find(
            (ta) =>
                Array.from(ta.labels ?? []).some((l) => l.textContent?.includes('Text')),
        ) as HTMLTextAreaElement;
        const textSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        textSetter.call(textArea, 'Custom text');
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save objective',
        );
        await act(async () => {
            save!.click();
        });
        await act(async () => {});
        expect(calls.some((c) => c.startsWith('POST') && c.includes('/control-objectives/catalogue'))).toBe(true);
    });

    it('auto-suggests the next objective ID (On+1) when adding', async () => {
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        )!;
        await act(async () => {
            explore.click();
        });
        await act(async () => {});
        const add = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add a control objective'),
        )!;
        await act(async () => {
            add.click();
        });
        await act(async () => {});
        // the catalogue has O1, so the suggested ID is O2
        const idField = Array.from(document.body.querySelectorAll('input')).find(
            (i) => i.labels?.[0]?.textContent?.includes('ID'),
        ) as HTMLInputElement;
        expect(idField.value).toBe('O2');
    });

    it('blocks saving an objective whose ID already exists', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const hit = routes.find((r) => r.match(url, init));
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        )!;
        await act(async () => {
            explore.click();
        });
        await act(async () => {});
        const add = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add a control objective'),
        )!;
        await act(async () => {
            add.click();
        });
        await act(async () => {});
        const setValue = (label: string, value: string) => {
            const field = Array.from(document.body.querySelectorAll('input')).find(
                (i) => i.labels?.[0]?.textContent?.includes(label),
            ) as HTMLInputElement;
            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            )!.set!;
            setter.call(field, value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
        };
        // use the already-existing O1: the save must be blocked locally
        setValue('ID', 'O1');
        setValue('Macro requirement', 'REQX');
        const textArea = Array.from(document.body.querySelectorAll('textarea')).find(
            (ta) => Array.from(ta.labels ?? []).some((l) => l.textContent?.includes('Text')),
        ) as HTMLTextAreaElement;
        const textSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        textSetter.call(textArea, 'Duplicate text');
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        await act(async () => {});
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save objective',
        )!;
        await act(async () => {
            save.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain("already exists");
        expect(calls.some((c) => c.startsWith('POST') && c.includes('/control-objectives/catalogue'))).toBe(false);
    });

    it('imports objectives from a JSON file', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const hit = routes.find((r) => r.match(url, init));
                if (url.includes('/control-objectives/catalogue') && init?.method === 'POST') {
                    return Promise.resolve(jsonResponse({ id: 'CX-9', custom: true }));
                }
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        );
        await act(async () => {
            explore!.click();
        });
        await act(async () => {});
        const add = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Add a control objective'),
        );
        await act(async () => {
            add!.click();
        });
        await act(async () => {});
        const inputs = Array.from(
            document.body.querySelectorAll('input[type="file"]'),
        ) as HTMLInputElement[];
        expect(inputs.length).toBeGreaterThan(0);
        const file = new File(
            [JSON.stringify([{ objective_id: 'CX-9', macro_requirement: 'REQX', text: 'Imported', assessment_mode: 'Test' }])],
            'objectives.json',
            { type: 'application/json' },
        );
        await act(async () => {
            Object.defineProperty(inputs[0], 'files', { value: [file], configurable: true });
            inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        });
        await act(async () => {});
        expect(calls.some((c) => c.startsWith('POST') && c.includes('/control-objectives/catalogue'))).toBe(true);
    });

    it('cannot disable an objective that a risk maps to, from the catalogue', async () => {
        routes.length = 0;
        route((url) => url.includes('/control-objectives/matrix'), {
            priorities: [
                { objective_id: 'O1', score: 20, top_rating: 25, rank: 1, key: true, key_default: false, risk_ids: ['r1'], reasons: [] },
            ],
            risks: [
                { pid: 'r1', position: 1, name: 'poison', impact: 5, likelihood: 5, rating: 25, comment: '' },
            ],
            mappings: [
                { pid: 'm1', risk_pid: 'r1', objective_id: 'O1', quote: '', rationale: '', source: 'person' },
            ],
        });
        route((url) => url.includes('/control-objectives/catalogue'), [
            { id: 'O1', macro_requirement: 'REQ1 Human Agency and Oversight', legal_basis: 'Art 14', sub_requirement_label: '', text: 'Human oversight objective', assessment_mode: 'Control' },
        ]);
        route((url) => url.includes('/control-objectives/risks'), [
            { pid: 'r1', position: 1, name: 'poison', impact: 5, likelihood: 5, rating: 25, comment: '' },
        ]);
        route((url) => url.includes('/control-objectives/mappings'), [
            { pid: 'm1', risk_pid: 'r1', objective_id: 'O1', quote: '', rationale: '', source: 'person' },
        ]);
        route((url) => url.includes('/control-objectives/profile'), { objectives: ['O1'], key_objectives: ['O1'] });
        const puts: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if ((init?.method ?? 'GET') === 'PUT' && url.includes('/control-objectives/profile')) {
                    puts.push(JSON.parse(String(init?.body)));
                    return Promise.resolve(jsonResponse({ objectives: [], key_objectives: [] }));
                }
                const hit = routes.find((r) => r.match(url, init));
                if (!hit) throw new Error(`unexpected fetch: ${url}`);
                return Promise.resolve(jsonResponse(hit.payload, hit.status));
            }),
        );
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        );
        await act(async () => {
            explore!.click();
        });
        await act(async () => {});
        expect(bodyText()).toContain('used by 1 risk');

        const card = Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
            (el) => el.textContent?.includes('used by 1 risk'),
        ) as HTMLElement;
        expect(card).toBeTruthy();
        await act(async () => {
            card.click();
        });
        await act(async () => {});
        expect(toasts.some((t) => t.includes('used by at least one risk'))).toBe(true);
        expect(puts).toHaveLength(0);
    });
});


async function renderKeyCatalogue(initialEnabled = ['O1', 'O2']) {
    const matrixRoute = routes.find((r) => r.match('/control-objectives/matrix'))!;
    const matrix = matrixRoute.payload as { priorities: Array<Record<string, unknown>> };
    matrix.priorities.push({ ...matrix.priorities[0], objective_id: 'O2', key: false });
    const catalogue = routes.find((r) => r.match('/control-objectives/catalogue'))!.payload as Array<Record<string, unknown>>;
    catalogue.push({ ...catalogue[0], id: 'O2', text: 'Human review objective' });
    let profile = { name: 'My profile', objectives: initialEnabled, key_objectives: ['O1'] };
    const saves: Array<{ body: typeof profile; finish: (status?: number) => void }> = [];
    const original = fetch;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url.includes('/control-objectives/profile')) {
            if (init?.method === 'PUT') {
                const body = JSON.parse(String(init.body)) as typeof profile;
                return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
                    saves.push({ body, finish: (status = 200) => {
                        if (status === 200) profile = body;
                        resolve(jsonResponse(body, status));
                    } });
                });
            }
            return Promise.resolve(jsonResponse(profile));
        }
        return original(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);
    await renderPage();
    const explore = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Explore catalogue'))!;
    await act(async () => explore.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const toggle = (index: number) => dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index];
    const initialReads = fetchMock.mock.calls.filter(([url]) => /\/(matrix|catalogue)$/.test(url)).length;
    return { saves, toggle, dialog, fetchMock, initialReads };
}

describe('key objective saves', () => {
    it('updates just the selected toggle without refetching or replacing the dialog', async () => {
        const { saves, toggle, dialog, fetchMock, initialReads } = await renderKeyCatalogue();
        const first = toggle(0);
        const second = toggle(1);
        const search = dialog.querySelector<HTMLInputElement>('input[placeholder="Search catalogue..."]')!;
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
            setter.call(search, 'Human');
            search.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const scroll = dialog.querySelector<HTMLElement>('.MuiDialogContent-root')!;
        scroll.scrollTop = 80;
        await act(async () => first.click());
        expect(first.checked).toBe(false);
        expect(first.disabled).toBe(true);
        expect(second.disabled).toBe(false);
        expect(saves[0].body).toMatchObject({ name: 'My profile', objectives: ['O1', 'O2'], key_objectives: [] });
        await act(async () => saves[0].finish());
        expect(first.disabled).toBe(false);
        expect(toggle(0)).toBe(first);
        expect(document.querySelector('[role="dialog"]')).toBe(dialog);
        expect(search.value).toBe('Human');
        expect(scroll.scrollTop).toBe(80);
        expect(fetchMock.mock.calls.filter(([url]) => /\/(matrix|catalogue)$/.test(url))).toHaveLength(initialReads);
    });

    it('serializes rapid changes and saves against the latest profile', async () => {
        const { saves, toggle } = await renderKeyCatalogue();
        await act(async () => toggle(0).click());
        await act(async () => toggle(1).click());
        expect(saves).toHaveLength(1);
        expect(toggle(0).checked).toBe(false);
        expect(toggle(1).checked).toBe(true);
        await act(async () => saves[0].finish());
        expect(saves).toHaveLength(2);
        expect(saves[1].body.key_objectives).toEqual(['O2']);
        await act(async () => saves[1].finish());
        expect(toggle(0).disabled).toBe(false);
        expect(toggle(1).disabled).toBe(false);
    });

    it('rolls back only the failed toggle and continues queued saves', async () => {
        const { saves, toggle, dialog } = await renderKeyCatalogue();
        await act(async () => toggle(0).click());
        await act(async () => toggle(1).click());
        await act(async () => saves[0].finish(500));
        expect(toggle(0).checked).toBe(true);
        expect(toggle(0).disabled).toBe(false);
        expect(toggle(1).checked).toBe(true);
        expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
        expect(saves[1].body.key_objectives).toEqual(['O1', 'O2']);
        await act(async () => saves[1].finish());
        expect(toggle(1).disabled).toBe(false);
    });
});


describe('catalogue selection saves', () => {
    it('updates card selection in place and keeps search, filters and scroll position', async () => {
        const { saves, toggle, dialog, fetchMock, initialReads } = await renderKeyCatalogue();
        const card = toggle(0).closest<HTMLElement>('.catalogue-card')!;
        const search = dialog.querySelector<HTMLInputElement>('input[placeholder="Search catalogue..."]')!;
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
            setter.call(search, 'Human');
            search.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const tag = Array.from(dialog.querySelectorAll<HTMLElement>('.MuiChip-root'))
            .find((chip) => chip.textContent === 'Control')!;
        await act(async () => tag.click());
        const scroll = dialog.querySelector<HTMLElement>('.MuiDialogContent-root')!;
        scroll.scrollTop = 80;
        await act(async () => card.click());
        expect(card.classList.contains('is-enabled')).toBe(false);
        expect(toggle(0).checked).toBe(false); // Disabling removes the explicit key.
        expect(toggle(0).disabled).toBe(true);
        expect(toggle(1).disabled).toBe(false);
        expect(saves[0].body).toMatchObject({ objectives: ['O2'], key_objectives: [] });
        await act(async () => card.click());
        expect(saves).toHaveLength(1);
        await act(async () => saves[0].finish());
        expect(toggle(0).closest('.catalogue-card')).toBe(card);
        expect(document.querySelector('[role="dialog"]')).toBe(dialog);
        expect(search.value).toBe('Human');
        expect(tag.classList.contains('MuiChip-filled')).toBe(true);
        expect(scroll.scrollTop).toBe(80);
        expect(fetchMock.mock.calls.filter(([url]) => /\/(matrix|catalogue)$/.test(url))).toHaveLength(initialReads);
    });

    it.each([true, false])('serializes mixed selection and key saves (selection first: %s)', async (selectionFirst) => {
        const { saves, toggle } = await renderKeyCatalogue(['O1']);
        const card = toggle(1).closest<HTMLElement>('.catalogue-card')!;
        expect(card.classList.contains('is-enabled')).toBe(false);
        if (selectionFirst) {
            await act(async () => card.click());
            expect(toggle(0).disabled).toBe(false);
            await act(async () => toggle(0).click());
        } else {
            await act(async () => toggle(0).click());
            await act(async () => card.click());
        }
        expect(card.classList.contains('is-enabled')).toBe(true);
        expect(saves).toHaveLength(1);
        await act(async () => saves[0].finish());
        expect(saves).toHaveLength(2);
        expect(saves[1].body).toMatchObject({ name: 'My profile', objectives: ['O1', 'O2'], key_objectives: [] });
        await act(async () => saves[1].finish());
        expect(toggle(0).disabled).toBe(false);
        expect(toggle(1).disabled).toBe(false);
    });

    it('restores selection and key on failure without undoing another pending change', async () => {
        const { saves, toggle, dialog } = await renderKeyCatalogue();
        const card = toggle(0).closest<HTMLElement>('.catalogue-card')!;
        await act(async () => card.click());
        await act(async () => toggle(1).click());
        expect(card.classList.contains('is-enabled')).toBe(false);
        await act(async () => saves[0].finish(500));
        expect(card.classList.contains('is-enabled')).toBe(true);
        expect(toggle(0).checked).toBe(true);
        expect(toggle(0).disabled).toBe(false);
        expect(toggle(1).checked).toBe(true);
        expect(saves[1].body).toMatchObject({ objectives: ['O1', 'O2'], key_objectives: ['O1', 'O2'] });
        expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
        await act(async () => saves[1].finish());
    });
});
