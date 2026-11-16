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
    { pid: 'r1', project_id: 'p1', period: '2026-Q3', format: 'pdf', file_ref: 'x', status: 'generated', created_at: '2026-10-01' },
];

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1/evaluations')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => runs });
            }
            if (url.endsWith('/projects/p1/reports')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => reports });
            }
            if (url.includes('/report-settings')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ default_format: 'pdf', default_sections: [] }),
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
    await act(async () => {
        root.render(<ReportPage />);
    });
    await act(async () => {});
}

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

    it('generates from the dialog with picked evaluations and sections', async () => {
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
        const buttonsWithText = (text: string) =>
            Array.from(document.body.querySelectorAll('button')).filter((b) =>
                (b.textContent ?? '').includes(text),
            );
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
        const post = calls.find(([url, init]) => url.includes('/reports/generate') && init?.method === 'POST');
        expect(post).toBeTruthy();
        const body = JSON.parse((post![1] as RequestInit).body as string) as Record<string, unknown>;
        expect(body).toHaveProperty('evaluation_pids');
        expect(body).toHaveProperty('sections');
        expect(body).toHaveProperty('format', 'pdf');
    });
});
