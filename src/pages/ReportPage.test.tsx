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
    { pid: 'r1', project_id: 'p1', period: '2026-Q3', format: 'pdf', file_ref: 'x', status: 'generated', created_at: '2026-10-01' },
];

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    project.pid = 'p1';
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
            ([url, init]) =>
                url.includes('/report-settings') && init?.method === 'PUT',
        );
        const postIndex = calls.findIndex(
            ([url, init]) => url.includes('/reports/generate') && init?.method === 'POST',
        );
        expect(putIndex).toBeGreaterThan(-1);
        expect(postIndex).toBeGreaterThan(-1);
        // the form's values are saved before the report is generated
        expect(putIndex).toBeLessThan(postIndex);
        const body = JSON.parse((calls[postIndex][1] as RequestInit).body as string) as Record<string, unknown>;
        expect(body).toHaveProperty('evaluation_pids');
        expect(body).toHaveProperty('sections');
        expect(body).toHaveProperty('format', 'pdf');
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
