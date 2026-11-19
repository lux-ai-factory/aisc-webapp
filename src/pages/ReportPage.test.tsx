// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ReportPage from './ReportPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const project = vi.hoisted(() => ({ pid: 'p1' }));

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: project.pid,
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
        fileUploadingPids: new Set<string>(),
        addFileUploadingPid: () => {},
        removeFileUploadingPid: () => {},
    }),
}));

const runs = [
    {
        pid: 'e1e1e1e1-1111-4111-8111-111111111111',
        status: 'Done',
        created_at: '2026-10-01T10:30:00Z',
        evaluation_plugins: [
            {
                name: 'ClassificationPerformancePlugin',
                display_name: 'Classification Performance',
                version: '0.3.0',
            },
            { name: 'RobustnessPlugin', display_name: 'Robustness', version: '0.1.0' },
        ],
    },
];
const reports = [
    {
        pid: 'r1',
        project_id: 'p1',
        period: '2026-Q3',
        format: 'pdf',
        file_ref: 'x',
        status: 'generated',
        created_at: '2026-10-01',
    },
];
const layouts = [
    {
        id: 'builtin-summary',
        name: 'Summary',
        description: 'One page.',
        blocks: [{ instance_id: 'b1', block_type: 'cover', options: {} }],
        show_index: false,
        numbering: true,
        revision: 0,
        built_in: true,
    },
    {
        id: 'L1',
        name: 'Mine',
        description: 'My layout.',
        blocks: [
            { instance_id: 'b2', block_type: 'cover', options: {} },
            { instance_id: 'b3', block_type: 'chapter', options: { title: 'Intro' } },
        ],
        show_index: true,
        numbering: true,
        revision: 3,
        built_in: false,
    },
];
const blockTypes = {
    groups: [
        {
            group: 'Document',
            types: [
                {
                    type_id: 'cover',
                    label: 'Cover',
                    group: 'Document',
                    options_schema: { properties: {} },
                    default_options: {},
                },
                {
                    type_id: 'chapter',
                    label: 'Chapter',
                    group: 'Document',
                    options_schema: { properties: { title: { type: 'string', label: 'Title' } } },
                    default_options: { title: 'Chapter' },
                },
            ],
        },
        {
            group: 'Results',
            types: [
                {
                    type_id: 'chart',
                    label: 'Chart',
                    group: 'Results',
                    options_schema: {
                        properties: { dataset: { type: 'string', enum: ['coverage_status'], label: 'Dataset' } },
                    },
                    default_options: { dataset: 'coverage_status' },
                },
            ],
        },
    ],
    max_blocks: 50,
};
const versions = [
    { pid: 'v1', project_id: 'p1', number: 1, name: 'v1', version: '', provider: 'aisc', description: '', created_at: '2026-01-01', created_by: '' },
];

function ok(json: unknown, status = 200) {
    return Promise.resolve({ ok: status < 300, status, json: async () => json });
}

interface MockOptions {
    onPost?: (url: string, body: Record<string, unknown>) => void;
}

function installFetch({ onPost }: MockOptions = {}) {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
            if (method === 'POST' && url.endsWith('/reports/generate')) {
                onPost?.(url, body);
                return ok({ ...reports[0], pid: 'r2' });
            }
            if (method === 'POST' && url.endsWith('/preview')) {
                return ok({
                    html: '<!doctype html><html><body><h1>Preview</h1></body></html>',
                    outline: [],
                    layout: { id: 'builtin-summary', name: 'Summary', show_index: false, numbering: true },
                });
            }
            if (method === 'POST' && url.endsWith('/duplicate')) {
                onPost?.(url, body);
                return ok({ ...layouts[1], id: 'L9', built_in: false });
            }
            if (method === 'POST' && url.endsWith('/report-layouts')) {
                onPost?.(url, body);
                return ok({ ...layouts[1], id: 'L2' });
            }
            if (method === 'POST' && url.endsWith('/report-layouts/import')) {
                onPost?.(url, body);
                return ok({ ...layouts[1], id: 'L3' });
            }
            if (method === 'PUT' && url.includes('/report-layouts/')) {
                return ok({ ...layouts[1] });
            }
            if (method === 'DELETE' && url.includes('/report-layouts/')) {
                return Promise.resolve({ ok: true, status: 204, json: async () => undefined });
            }
            if (url.endsWith('/report-layouts')) return ok(layouts);
            if (url.endsWith('/report-block-types')) return ok(blockTypes);
            if (url.endsWith('/system-versions')) return ok(versions);
            if (url.endsWith('/projects/p1/evaluations')) return ok(runs);
            if (url.endsWith('/projects/p1/reports')) return ok(reports);
            if (url.includes('/report-settings')) return ok({ default_format: 'pdf', default_sections: [] });
            return ok({});
        }),
    );
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    project.pid = 'p1';
    installFetch();
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
        root.render(<ReportPage />);
    });
    await act(async () => {});
}

const buttonsWithText = (text: string) =>
    Array.from(document.body.querySelectorAll('button')).filter((b) => (b.textContent ?? '').includes(text));

describe('ReportPage', () => {
    it('shows past reports as cards without the inline form', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Report');
        expect(text).toContain('2026-Q3');
        expect(text).toContain('PDF');
        // evaluations/sections live in the generate dialog, not the main page
        expect(text).not.toContain('Evaluations');
        expect(text).not.toContain('Sections');
    });

    it('lists the built-in and the project layouts', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Layouts');
        expect(text).toContain('Summary');
        expect(text).toContain('Built-in');
        expect(text).toContain('Mine');
        expect(text).toContain('Revision 3');
    });

    it('loads each project its own report fields', async () => {
        let releaseP2: (() => void) | null = null;
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/projects/p2/report-settings')) {
                    return new Promise((resolve) => {
                        releaseP2 = () =>
                            resolve({
                                ok: true,
                                status: 200,
                                json: async () => ({
                                    default_format: 'pdf',
                                    default_sections: [],
                                    report_title: 'P2 title',
                                }),
                            });
                    });
                }
                if (url.includes('/report-settings')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            default_format: 'pdf',
                            default_sections: [],
                            report_title: 'P1 title',
                        }),
                    });
                }
                if (url.endsWith('/evaluations')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => runs });
                }
                if (url.endsWith('/projects/p2/reports')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
                }
                if (url.endsWith('/projects/p1/reports')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => reports });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        await renderPage();
        const buttons = () =>
            Array.from(document.body.querySelectorAll('button')).filter((b) =>
                (b.textContent ?? '').includes('Generate'),
            );
        await act(async () => {
            buttons()[0]!.click();
        });
        await act(async () => {});
        expect(document.querySelector('input[value="P1 title"]')).toBeTruthy();

        project.pid = 'p2';
        await act(async () => {
            root.render(<ReportPage />);
        });
        await act(async () => {});
        // p2 is still loading: p1's fields must not be reused (or saved under p2)
        expect(document.body.textContent ?? '').not.toContain('P1 title');

        await act(async () => {
            releaseP2!();
        });
        await act(async () => {});
        expect(document.querySelector('input[value="P2 title"]')).toBeTruthy();
    });

    it('offers only completed evaluations in the dialog and shows the report version chip', async () => {
        const doneRun = { pid: 'e1e1e1e1-1111-4111-8111-111111111111', status: 'Done', created_at: '2026-10-01T10:30:00Z', evaluation_plugins: [{ name: 'RobustnessPlugin', display_name: 'Robustness', version: '0.1.0' }] };
        const busyRun = { pid: 'e2e2e2e2-2222-4222-8222-222222222222', status: 'Running' };
        const versionedReport = { pid: 'r1', project_id: 'p1', period: '2026-Q3', version: 3, format: 'pdf', file_ref: 'x', status: 'generated', created_at: '2026-10-01' };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.includes('/report-settings')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => ({ default_format: 'pdf', default_sections: [] }) });
                }
                if (url.endsWith('/evaluations')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [doneRun, busyRun] });
                }
                if (url.endsWith('/projects/p1/reports')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [versionedReport] });
                }
                throw new Error(`unexpected fetch: ${url}`);
            }),
        );
        await renderPage();
        const buttons = () =>
            Array.from(document.body.querySelectorAll('button')).filter((b) =>
                (b.textContent ?? '').includes('Generate'),
            );
        await act(async () => {
            buttons()[0]!.click();
        });
        await act(async () => {});
        const text = document.body.textContent ?? '';
        // the completed run is offered, the still-running one is not
        expect(text).toContain('Robustness');
        expect(text).not.toContain('Runner');
        expect(text).not.toContain('e2e2e2e2');
        // the report card carries its per-project version chip
        expect(text).toContain('v3');
    });

    it('generates from the dialog with picked evaluations, sections, layout and version', async () => {
        const calls: [string, RequestInit?][] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push([url, init]);
                const method = init?.method ?? 'GET';
                if (method === 'POST' && url.endsWith('/reports/generate')) {
                    return ok({ ...reports[0], pid: 'r2' });
                }
                if (method === 'PUT' && url.includes('/report-settings')) {
                    return ok({ default_format: 'pdf', default_sections: [] });
                }
                if (url.endsWith('/report-layouts')) return ok(layouts);
                if (url.endsWith('/report-block-types')) return ok(blockTypes);
                if (url.endsWith('/system-versions')) return ok(versions);
                if (url.endsWith('/projects/p1/evaluations')) return ok(runs);
                if (url.endsWith('/projects/p1/reports')) return ok(reports);
                if (url.includes('/report-settings')) {
                    return ok({ default_format: 'pdf', default_sections: [] });
                }
                return ok({});
            }),
        );
        await renderPage();
        expect(buttonsWithText('Generate').length).toBeGreaterThan(0);
        await act(async () => {
            buttonsWithText('Generate')[0]!.click();
        });
        await act(async () => {});
        expect(document.body.textContent ?? '').toContain('Generate report');
        // the evaluation list names the executed plugins, not the UUID
        expect(document.body.textContent ?? '').toContain('Classification Performance');
        expect(document.body.textContent ?? '').toContain('Robustness');
        expect(document.body.textContent ?? '').not.toContain('e1e1e1e1');
        const confirmButtons = buttonsWithText('Generate');
        const confirm = confirmButtons[confirmButtons.length - 1]!;
        await act(async () => {
            confirm.click();
        });
        await act(async () => {});

        const putIndex = calls.findIndex(
            ([url, init]) => url.includes('/report-settings') && init?.method === 'PUT',
        );
        const postIndex = calls.findIndex(
            ([url, init]) => url.endsWith('/reports/generate') && init?.method === 'POST',
        );
        expect(putIndex).toBeGreaterThan(-1);
        expect(postIndex).toBeGreaterThan(-1);
        // the form's values are saved before the report is generated
        expect(putIndex).toBeLessThan(postIndex);
        const body = JSON.parse((calls[postIndex][1] as RequestInit).body as string) as Record<string, unknown>;
        expect(body).toHaveProperty('evaluation_pids');
        expect(body).toHaveProperty('sections');
        expect(body).toHaveProperty('format', 'pdf');
        expect(body).toHaveProperty('layout_id', 'builtin-summary');
        expect(body).toHaveProperty('version_pid', 'v1');
    });

    it('previews the selected layout as HTML', async () => {
        await renderPage();
        const preview = buttonsWithText('Preview');
        expect(preview.length).toBeGreaterThan(0);
        await act(async () => {
            preview[0]!.click();
        });
        await act(async () => {});
        const frame = document.body.querySelector('[data-testid="report-preview"]');
        expect(frame).toBeTruthy();
        expect((frame as HTMLIFrameElement).getAttribute('srcdoc')).toContain('Preview');
    });

    it('opens the editor for a project layout and can reorder its blocks', async () => {
        await renderPage();
        const edit = buttonsWithText('Edit');
        expect(edit.length).toBeGreaterThan(0);
        await act(async () => {
            edit[0]!.click();
        });
        await act(async () => {});
        const outline = document.body.querySelector('[data-testid="block-outline"]');
        expect(outline).toBeTruthy();
        expect(outline!.querySelectorAll('[data-testid^="block-"]').length).toBe(2);
        const down = Array.from(outline!.querySelectorAll('button')).find((b) =>
            (b.getAttribute('aria-label') ?? '') === 'Move down',
        );
        await act(async () => {
            down!.click();
        });
        await act(async () => {});
        const first = outline!.querySelector('[data-testid="block-0"]');
        expect(first!.textContent ?? '').toContain('Chapter');
    });

    it('creates a new layout from the palette', async () => {
        const posts: [string, Record<string, unknown>][] = [];
        installFetch({ onPost: (url, body) => posts.push([url, body]) });
        await renderPage();
        const newBtn = buttonsWithText('New layout');
        await act(async () => {
            newBtn[0]!.click();
        });
        await act(async () => {});
        expect(document.body.textContent ?? '').toContain('New layout');
        const save = buttonsWithText('Save layout');
        await act(async () => {
            save[0]!.click();
        });
        await act(async () => {});
        const post = posts.find(([url]) => url.endsWith('/report-layouts'));
        expect(post).toBeTruthy();
        expect(post![1]).toHaveProperty('name', 'New layout');
        expect((post![1].blocks as unknown[]).length).toBe(1);
    });

    it('saves edited customisation before generating', async () => {
        const calls: [string, RequestInit?][] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push([url, init]);
                if (url.includes('/reports/generate')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ ...reports[0], pid: 'r2' }),
                    });
                }
                if (url.endsWith('/projects/p1/evaluations')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => runs });
                }
                if (url.endsWith('/projects/p1/reports')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => reports });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ default_format: 'pdf', default_sections: [] }),
                });
            }),
        );
        await renderPage();
        const buttons = () =>
            Array.from(document.body.querySelectorAll('button')).filter((b) =>
                (b.textContent ?? '').includes('Generate'),
            );
        await act(async () => {
            buttons()[0]!.click();
        });
        await act(async () => {});
        const title = document.body.querySelector(
            'input[placeholder="AI system assessment report"]',
        ) as HTMLInputElement | null;
        expect(title).toBeTruthy();
        const setValue = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        )!.set!;
        await act(async () => {
            setValue.call(title, 'Quarterly report');
            title!.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            const generate = buttons();
            generate[generate.length - 1]!.click();
        });
        await act(async () => {});
        const put = calls.find(
            ([url, init]) =>
                url.includes('/report-settings') && init?.method === 'PUT',
        );
        expect(put).toBeTruthy();
        expect(JSON.parse((put![1] as RequestInit).body as string)).toMatchObject({
            report_title: 'Quarterly report',
            default_format: 'pdf',
        });
        expect(
            calls.some(
                ([url, init]) =>
                    url.includes('/reports/generate') && init?.method === 'POST',
            ),
        ).toBe(true);
    });

    it('deletes a report after confirmation', async () => {
        let deleted = false;
        const calls: [string, RequestInit?][] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push([url, init]);
                if (init?.method === 'DELETE') {
                    deleted = true;
                    return Promise.resolve({ ok: true, status: 204, json: async () => undefined });
                }
                if (url.endsWith('/projects/p1/evaluations')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => runs });
                }
                if (url.endsWith('/projects/p1/reports')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => (deleted ? [] : reports),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ default_format: 'pdf', default_sections: [] }),
                });
            }),
        );
        await renderPage();

        const del = document.body.querySelector(
            'button[aria-label="Delete 2026-Q3"]',
        ) as HTMLButtonElement | null;
        expect(del).toBeTruthy();
        await act(async () => {
            del!.click();
        });
        expect(document.body.textContent ?? '').toContain('Delete report');
        expect(document.body.textContent ?? '').toContain('cannot be undone');

        const confirm = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').trim() === 'Delete',
        );
        expect(confirm).toBeTruthy();
        await act(async () => {
            confirm!.click();
        });
        await act(async () => {});

        const call = calls.find(([, init]) => init?.method === 'DELETE');
        expect(call?.[0]).toContain(`/projects/p1/reports/${reports[0].pid}`);
        expect(document.body.textContent ?? '').not.toContain('2026-Q3');
    });

    it('shows a pending card (no download) with chips for the chosen evaluations', async () => {
        const pending = {
            ...reports[0],
            period: 'P9',
            status: 'pending',
            evaluations: [
                { pid: 'e1e1e1e1-1111-4111-8111-111111111111', status: 'Done', task: 'classification' },
            ],
        };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                if (url.endsWith('/projects/p1/evaluations')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => runs });
                }
                if (url.endsWith('/projects/p1/reports')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => [pending] });
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ default_format: 'pdf', default_sections: [] }),
                });
            }),
        );
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Generating');
        expect(document.body.querySelector('.MuiCircularProgress-root')).toBeTruthy();
        // a pending report cannot be downloaded or opened yet
        expect(document.body.querySelector('button[aria-label="Download P9"]')).toBeNull();
        // the card carries a chip per selected evaluation (short pid)
        expect(text).toContain('#e1e1e1e1');
    });
});
