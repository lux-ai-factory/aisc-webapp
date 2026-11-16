// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ChecklistsPage from './ChecklistsPage';

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

const installed = [
    {
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
    },
];

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1/controls')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => installed });
            }
            if (url.endsWith('/catalogue')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ plugins: [], controls: [] }),
                });
            }
            throw new Error(`unexpected fetch: ${url}`);
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
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
        root.render(
            <QueryClientProvider client={queryClient}>
                <ChecklistsPage />
            </QueryClientProvider>,
        );
    });
    // Let React Query's initial loads resolve and the page re-render before
    // the test starts interacting.
    for (let i = 0; i < 30; i++) {
        const text = document.body.textContent ?? '';
        if (text.includes('No checklists installed') || text.includes('Risk Management')) return;
        await act(async () => {
            await new Promise((r) => setTimeout(r, 25));
        });
    }
}

function bodyText(): string {
    return document.body.textContent ?? '';
}

describe('ChecklistsPage', () => {
    it('renders installed checklist cards with chips', async () => {
        await renderPage();
        expect(bodyText()).toContain('Checklists');
        expect(bodyText()).toContain('Risk Management');
        expect(bodyText()).toContain('AESIA');
        expect(bodyText()).toContain('42 questions');
    });

    it('lists submission versions with status in the versions menu', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => [
                            { pid: 's1', checklist_pid: 'cl1', label: 'First pass', status: 'draft', version: 1, readiness: null },
                            { pid: 's0', checklist_pid: 'cl1', label: 'Baseline', status: 'closed', version: 0, readiness: 80 },
                        ],
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 0,
                            questions: [],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        await renderPage();
        const card = Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
            (el.textContent ?? '').includes('Risk Management'),
        );
        expect(card).toBeTruthy();
        await act(async () => {
            (card as HTMLElement).click();
        });
        await act(async () => {});
        // the answer drawer's version dropdown lists submission versions (v1, v0)
        const trigger = Array.from(document.body.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('v1'),
        );
        expect(trigger).toBeTruthy();
    });

    it('reopens the answer drawer on the submission version picked before', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => [
                            { pid: 's1', checklist_pid: 'cl1', label: 'First pass', status: 'draft', version: 1, readiness: null },
                            { pid: 's0', checklist_pid: 'cl1', label: 'Baseline', status: 'closed', version: 0, readiness: 80 },
                        ],
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 1,
                            questions: [{ order: 1, text: 'First question', article: 'a', category: 'c' }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's1',
                            checklist_pid: 'cl1',
                            status: 'draft',
                            version: 1,
                            answers: [{ question_order: 1, answer: 'draft answer', score: 2 }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s0')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's0',
                            checklist_pid: 'cl1',
                            status: 'closed',
                            version: 0,
                            answers: [{ question_order: 1, answer: 'baseline answer', score: 3 }],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        const openCard = () =>
            Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
                (el.textContent ?? '').includes('Risk Management'),
            ) as HTMLElement;
        const shownAnswer = () => {
            const field = document.body.querySelector('[aria-label="Question 1"]') as HTMLTextAreaElement | null;
            return field?.value ?? '';
        };
        // the answer load is async (submissions -> checklist -> version fetches),
        // so poll a little for the drawer to settle on a value
        const settleOn = async (expected: string) => {
            for (let i = 0; i < 40 && shownAnswer() !== expected; i++) {
                await act(async () => {
                    await new Promise((r) => setTimeout(r, 10));
                });
            }
            return shownAnswer();
        };
        await renderPage();
        // open the drawer: the active draft's answers are loaded
        await act(async () => {
            openCard().click();
        });
        expect(await settleOn('draft answer')).toBe('draft answer');
        // pick the closed baseline version in the dropdown
        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
        );
        await act(async () => {
            trigger!.click();
        });
        await act(async () => {});
        const v0Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim().startsWith('v0'),
        )!;
        await act(async () => {
            (v0Item as HTMLElement).click();
        });
        expect(await settleOn('baseline answer')).toBe('baseline answer');
        // close, then reopen by clicking the card again: the picked version's
        // answers (not the draft's, not a blank form) must be shown
        await act(async () => {
            document.body.querySelector<HTMLButtonElement>('button[aria-label="Close panel"]')!.click();
        });
        await act(async () => {});
        expect(shownAnswer()).toBe('');
        await act(async () => {
            openCard().click();
        });
        expect(await settleOn('baseline answer')).toBe('baseline answer');
    });

    it('updates the checklist version chip from the drawer dropdown', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => [
                            {
                                ...installed[0],
                                submission_count: 2,
                                latest_version: 1,
                                latest_status: 'draft',
                            },
                        ],
                    });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => [
                            { pid: 's1', checklist_pid: 'cl1', label: 'First pass', status: 'draft', version: 1, readiness: null },
                            { pid: 's0', checklist_pid: 'cl1', label: 'Baseline', status: 'closed', version: 0, readiness: 80 },
                        ],
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 1,
                            questions: [{ order: 1, text: 'First question', article: 'a', category: 'c' }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's1', checklist_pid: 'cl1', status: 'draft', version: 1,
                            answers: [{ question_order: 1, answer: 'draft answer', score: 2 }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s0')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's0', checklist_pid: 'cl1', status: 'closed', version: 0,
                            answers: [{ question_order: 1, answer: 'baseline answer', score: 3 }],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        const card = () =>
            Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
                (el.textContent ?? '').includes('Risk Management'),
            ) as HTMLElement;
        await renderPage();
        // the card starts with the latest version chip (v1)
        expect(card().textContent).toContain('v1');
        // open the drawer and pick the closed baseline version (v0)
        await act(async () => {
            card().click();
        });
        for (let i = 0; i < 40; i++) {
            if (document.querySelector('[aria-label="Question 1"]')) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.replace(/\s+/g, '').endsWith('arrow_drop_down'),
        );
        await act(async () => {
            trigger!.click();
        });
        await act(async () => {});
        const v0Item = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
            (b) => b.textContent?.trim().startsWith('v0'),
        )!;
        await act(async () => {
            (v0Item as HTMLElement).click();
        });
        for (let i = 0; i < 40; i++) {
            if ((card().textContent ?? '').includes('v0')) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        expect(card().textContent).toContain('v0');
    });

    it('does not save an empty checklist form as a draft', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 1,
                            questions: [{ order: 1, text: 'First question', article: 'a', category: 'c' }],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        await renderPage();
        const cardEl = Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
            (el.textContent ?? '').includes('Risk Management'),
        ) as HTMLElement;
        await act(async () => {
            cardEl.click();
        });
        for (let i = 0; i < 40; i++) {
            if (document.querySelector('[aria-label="Question 1"]')) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save',
        )!;
        await act(async () => {
            save.click();
        });
        for (let i = 0; i < 40; i++) {
            if ((document.body.textContent ?? '').includes('nothing to save')) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        expect(bodyText()).toContain('nothing to save');
        // nothing was written: no create-submission POST, no answers POST
        expect(calls.some((c) => c.startsWith('POST '))).toBe(false);
    });

    it('shows the submitted version\'s answers when opening the drawer', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => [
                            { pid: 's2', checklist_pid: 'cl1', label: 'Submitted', status: 'closed', version: 2, readiness: 80 },
                            { pid: 's1', checklist_pid: 'cl1', label: 'Baseline', status: 'closed', version: 1, readiness: 60 },
                        ],
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 1,
                            questions: [{ order: 1, text: 'First question', article: 'a', category: 'c' }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's1', checklist_pid: 'cl1', status: 'closed', version: 1,
                            answers: [{ question_order: 1, answer: 'baseline answer', score: 3 }],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/submissions/s2')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 's2', checklist_pid: 'cl1', status: 'closed', version: 2,
                            answers: [{ question_order: 1, answer: 'submitted answer', score: 4 }],
                        }),
                    });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        const shownAnswer = () => {
            const field = document.body.querySelector('[aria-label="Question 1"]') as HTMLTextAreaElement | null;
            return field?.value ?? '';
        };
        const settleOn = async (expected: string) => {
            for (let i = 0; i < 40 && shownAnswer() !== expected; i++) {
                await act(async () => {
                    await new Promise((r) => setTimeout(r, 10));
                });
            }
            return shownAnswer();
        };
        await renderPage();
        const cardEl = Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
            (el.textContent ?? '').includes('Risk Management'),
        ) as HTMLElement;
        // no draft exists, only submitted (closed) versions — the latest one's
        // answers must be loaded, not a blank form
        await act(async () => {
            cardEl.click();
        });
        expect(await settleOn('submitted answer')).toBe('submitted answer');
    });

    it('creates a new checklist from the explore catalogue dialog', async () => {
        const posts: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if (url.endsWith('/projects/p1/controls')) {
                    if (init?.method === 'POST') {
                        posts.push(JSON.parse(String(init.body)));
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            json: async () => ({
                                pid: 'clx',
                                name: 'My Checklist',
                                template: { title: 'My Checklist', catalogue_id: 'custom-x' },
                                question_count: 1,
                                questions: [{ order: 1, text: 'First q', article: '', category: '' }],
                            }),
                        });
                    }
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ plugins: [], controls: [] }),
                    });
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
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
        expect(bodyText()).toContain('Catalogue — checklists');
        const newBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('New checklist'),
        )!;
        await act(async () => {
            newBtn.click();
        });
        await act(async () => {});
        const setValue = (el: HTMLElement, value: string) => {
            const proto =
                el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
            setter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const name = document.body.querySelector('[aria-label="Checklist name"]') as HTMLInputElement;
        const question = document.body.querySelector('[aria-label="Question text 1"]') as HTMLInputElement;
        expect(name).toBeTruthy();
        expect(question).toBeTruthy();
        await act(async () => {
            setValue(name, 'My Checklist');
            setValue(question, 'First q');
        });
        const create = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Create',
        )!;
        await act(async () => {
            create.click();
        });
        for (let i = 0; i < 30 && posts.length === 0; i++) {
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        expect(posts.length).toBe(1);
        expect(posts[0]).toMatchObject({
            name: 'My Checklist',
            questions: [{ text: 'First q', article: '', category: '' }],
        });
    });

    it('shows an empty state with no installed checklists', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ plugins: [], controls: [] }),
                });
            }),
        );
        await renderPage();
        expect(bodyText()).toContain('No checklists installed');
    });

    it('removes a checklist with DELETE when Remove is clicked', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                if ((init?.method ?? 'GET') === 'DELETE') {
                    return Promise.resolve({ ok: true, status: 204, json: async () => undefined });
                }
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ plugins: [], controls: [] }),
                });
            }),
        );
        await renderPage();
        const buttons = Array.from(document.body.querySelectorAll('button')).filter(
            (b) => (b.getAttribute('aria-label') ?? '').startsWith('Remove'),
        );
        expect(buttons.length).toBeGreaterThan(0);
        await act(async () => {
            buttons[0].click();
        });
        await act(async () => {});
        await act(async () => {});
        expect(calls.some((c) => c.startsWith('DELETE') && c.includes('/projects/p1/controls/cl1'))).toBe(true);
        // the library is refetched after removal, so installedKeys drops the
        // checklist and the catalogue no longer highlights it
        const libraryGets = calls.filter(
            (c) => c.startsWith('GET ') && c.endsWith('/projects/p1/controls'),
        );
        expect(libraryGets.length).toBeGreaterThanOrEqual(2);
    });

    it('answers a checklist: creates a draft submission and saves the answers', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                if (url.endsWith('/projects/p1/controls')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => installed });
                }
                if (url.endsWith('/projects/p1/controls/cl1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'cl1',
                            template: installed[0].template,
                            question_count: 1,
                            questions: [
                                { order: 1, text: 'First question', article: 'a', category: 'c' },
                            ],
                        }),
                    });
                }
                if (url.endsWith('/projects/p1/controls/cl1/submissions')) {
                    if (init?.method === 'POST') {
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            json: async () => ({
                                pid: 'sub1',
                                checklist_pid: 'cl1',
                                label: 'Risk Management',
                                status: 'draft',
                                version: 1,
                                coverage: {},
                            }),
                        });
                    }
                    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
                }
                if (url.includes('/controls/submissions/sub1/answers')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'sub1',
                            checklist_pid: 'cl1',
                            label: 'Risk Management',
                            status: 'draft',
                            version: 1,
                            coverage: {},
                            answers: [{ question_order: 1, answer: 'my answer', score: null }],
                        }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ plugins: [], controls: [] }),
                });
            }),
        );

        await renderPage();
        const card = Array.from(document.body.querySelectorAll('.gradient-card')).find((el) =>
            (el.textContent ?? '').includes('Risk Management'),
        );
        expect(card).toBeTruthy();
        await act(async () => {
            (card as HTMLElement).click();
        });
        await act(async () => {});

        const field = document.body.querySelector('[aria-label="Question 1"]') as HTMLTextAreaElement;
        expect(field).toBeTruthy();
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                'value',
            )!.set!;
            setter.call(field, 'my answer');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });

        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save',
        );
        await act(async () => {
            save!.click();
        });
        await act(async () => {});

        expect(
            calls.some((c) => c.startsWith('POST') && c.includes('/projects/p1/controls/cl1/submissions')),
        ).toBe(true);
        expect(
            calls.some((c) => c.startsWith('POST') && c.includes('/controls/submissions/sub1/answers')),
        ).toBe(true);
    });
});
