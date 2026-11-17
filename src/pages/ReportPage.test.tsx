// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ReportPage from './ReportPage';

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

const runs = [{ pid: 'e1e1e1e1-1111-4111-8111-111111111111', status: 'Done' }];
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

    it('generates from the dialog with picked evaluations and sections', async () => {
        const posts: [string, Record<string, unknown>][] = [];
        installFetch({ onPost: (url, body) => posts.push([url, body]) });
        await renderPage();
        expect(buttonsWithText('Generate').length).toBeGreaterThan(0);
        await act(async () => {
            buttonsWithText('Generate')[0]!.click();
        });
        await act(async () => {});
        expect(document.body.textContent ?? '').toContain('Generate report');
        // the dialog's confirm button has no start-icon ligature
        const confirm = buttonsWithText('Generate').filter(
            (b) => !(b.textContent ?? '').includes('picture_as_pdf'),
        );
        await act(async () => {
            confirm[confirm.length - 1]!.click();
        });
        await act(async () => {});
        const post = posts.find(([url]) => url.includes('/reports/generate'));
        expect(post).toBeTruthy();
        expect(post![1]).toHaveProperty('evaluation_pids');
        expect(post![1]).toHaveProperty('sections');
        expect(post![1]).toHaveProperty('format', 'pdf');
        expect(post![1]).toHaveProperty('layout_id', 'builtin-summary');
        expect(post![1]).toHaveProperty('version_pid', 'v1');
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
});
