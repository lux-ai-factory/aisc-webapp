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
            { objective_id: 'O1', score: 20, top_rating: 25, rank: 1, key: true, key_default: true, risk_ids: [], reasons: ['mitigates 1 risk rated 20 (Critical): score 20'] },
        ],
    });
    route((url) => url.includes('/control-objectives/catalogue'), [
        { id: 'O1', macro_requirement: 'REQ1 Human Agency and Oversight', legal_basis: 'Art 14', sub_requirement_label: '', text: 'Human oversight objective', assessment_mode: 'Control' },
    ]);
    route((url) => url.includes('/control-objectives/risks'), []);
    route((url) => url.includes('/control-objectives/mappings'), []);
    route((url) => url.includes('/control-objectives/profiles'), {
        profiles: [
            { key: 'fairness-oversight', name: 'Fairness and oversight', description: 'the fairness and oversight dimensions', objectives: ['O1'] },
            { key: 'full-ai-act', name: 'Full AI Act', description: 'every objective', objectives: ['O1', 'O2'] },
        ],
        current: 'fairness-oversight',
        current_name: 'Fairness and oversight',
        selected: ['O1'],
    });
    route((url) => url.includes('/objective-sets'), []);
    route((url) => url.endsWith('/control-objectives/profile'), { objectives: ['O1'], key_objectives: ['O1'] });
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

    it('undoes priority choices through the profile/keys route', async () => {
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
        const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Undo priority choices'),
        );
        expect(button).toBeTruthy();
        await act(async () => {
            (button as HTMLElement).click();
        });
        await act(async () => {});
        expect(
            calls.some(
                (c) => c.startsWith('DELETE ') && c.includes('/control-objectives/profile/keys'),
            ),
        ).toBe(true);
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
                { objective_id: 'O1', score: 20, top_rating: 25, rank: 1, key: true, key_default: true, risk_ids: ['r1'], reasons: [] },
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
        route((url) => url.includes('/control-objectives/profiles'), {
        profiles: [
            { key: 'fairness-oversight', name: 'Fairness and oversight', description: 'the fairness and oversight dimensions', objectives: ['O1'] },
            { key: 'full-ai-act', name: 'Full AI Act', description: 'every objective', objectives: ['O1', 'O2'] },
        ],
        current: 'fairness-oversight',
        current_name: 'Fairness and oversight',
        selected: ['O1'],
    });
    route((url) => url.includes('/objective-sets'), []);
    route((url) => url.endsWith('/control-objectives/profile'), { objectives: ['O1'], key_objectives: ['O1'] });
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
