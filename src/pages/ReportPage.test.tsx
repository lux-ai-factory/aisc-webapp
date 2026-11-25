// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ReportPage from './ReportPage';
import { prepareReport, uploadReportChart } from '../lib/report';
import { fetchDashboard } from '../lib/dashboardStorage';
import { exportEvaluationCharts } from '../lib/evaluationChartExport';
import { exportDashboardWidgets } from '../lib/reportDashboard';

vi.mock('../lib/evaluationChartExport', () => ({ exportEvaluationCharts: vi.fn(async () => []) }));

vi.mock('../lib/dashboardStorage', () => ({
    fetchDashboard: vi.fn(async () => ({ widgets: [], layouts: {}, revision: 0, can_edit: true })),
}));
vi.mock('../lib/report', async (importOriginal) => ({
    ...await importOriginal<typeof import('../lib/report')>(),
    prepareReport: vi.fn(async () => ({ pid: 'draft-report', project_id: 'p1', period: 'Report',
        format: 'pdf', status: 'preparing', created_at: '', file_ref: '' })),
    uploadReportChart: vi.fn(async () => 'artifact-1'),
}));

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

// The picker renders live charts (heavy MUI x-charts/x-data-grid, not needed
// here); this keeps ReportPage tests on the wiring: generate() must send the
// widgets the picker exported (with artifact ids, no image bytes).
const pickerExport = vi.hoisted(() => ({
    selected: async () => [
        { key: 'c1', kind: 'chart', image: 'png', title: 'T' },
    ] as Array<Record<string, string>>,
}));
vi.mock('../lib/reportDashboard', () => ({ exportDashboardWidgets: vi.fn(() => pickerExport.selected()) }));

vi.mock('../components/dashboard/DashboardWidgetPicker', async () => {
    const React = (await import('react')).default;
    const MockPicker = React.forwardRef((props: { widgets?: Array<{ key: string }>; selected?: Set<string>; onToggle?: (key: string) => void }, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({
            exportSelected: pickerExport.selected,
        }));
        return React.createElement('div', {}, `${(props.widgets ?? []).length} widgets`,
            ...(props.widgets ?? []).map(widget => React.createElement('button', {
                key: widget.key, 'aria-pressed': props.selected?.has(widget.key),
                onClick: () => props.onToggle?.(widget.key),
            }, `Widget ${widget.key}`)));
    });
    MockPicker.displayName = 'DashboardWidgetPicker';
    return { __esModule: true, default: MockPicker };
});

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
    pickerExport.selected = async () => [
        { key: 'c1', kind: 'chart', image: 'png', title: 'T' },
    ];
    vi.mocked(exportEvaluationCharts).mockResolvedValue([]);
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

async function selectReportSection(label: string) {
    const nav = document.querySelector('nav[aria-label="Split pane sections"]');
    const item = Array.from(nav?.querySelectorAll<HTMLElement>('[role="button"]') ?? [])
        .find(item => item.querySelector('.MuiListItemText-root')?.textContent === label);
    expect(item).toBeTruthy();
    await act(async () => item!.click());
}

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
        await selectReportSection('Settings');
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
        await act(async () => buttons()[0]!.click());
        await selectReportSection('Settings');
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
        // the evaluation list shows the evaluation title (short uuid here),
        // with the executed plugins named underneath
        expect(document.body.textContent ?? '').toContain('Classification Performance');
        expect(document.body.textContent ?? '').toContain('Robustness');
        expect(document.body.textContent ?? '').toContain('e1e1e1e1');
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
        // the widgets exported by the dashboard picker go into the generate call
        expect(body).toHaveProperty('dashboard');
        expect((body.dashboard as Array<{ key?: string }>)[0]?.key).toBe('c1');
    });

    it('keeps selections across split-pane sections and exports from Settings without a mounted picker', async () => {
        const widgets = [{ key: 'c1', kind: 'chart' as const, plugin: 'Tool' },
            { key: 'n1', kind: 'text' as const, text: 'Note' }];
        vi.mocked(fetchDashboard).mockResolvedValueOnce({ widgets, layouts: {}, revision: 1, can_edit: true });
        const originalFetch = fetch;
        const requests = vi.fn((url: string, init?: RequestInit) => url.endsWith('/reports/generate')
            ? Promise.resolve({ ok: true, json: async () => ({ ...reports[0], pid: 'new-report' }) })
            : originalFetch(url, init));
        vi.stubGlobal('fetch', requests);
        await renderPage();
        await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Generate'))!.click());
        const dialog = document.querySelector('[role="dialog"]')!;
        expect(dialog.querySelector('.split-pane-body')).toBeTruthy();
        expect(dialog.querySelector('input[placeholder="Search evaluations…"]')).toBeTruthy();
        expect(dialog.querySelector('input[placeholder="AI system assessment report"]')).toBeNull();
        await act(async () => (dialog.querySelector('.catalogue-card') as HTMLElement).click());
        await selectReportSection('Dashboard widgets');
        await act(async () => Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Widget n1')!.click());
        await selectReportSection('Settings');
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        await act(async () => {
            const title = dialog.querySelector('input[placeholder="AI system assessment report"]')!;
            const period = dialog.querySelector('input[placeholder="2026-Q3"]')!;
            setValue.call(title, 'Selected title'); title.dispatchEvent(new Event('input', { bubbles: true }));
            setValue.call(period, '2026-Q4'); period.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await selectReportSection('Evaluations');
        expect(dialog.querySelector('.catalogue-card.is-enabled')).toBeTruthy();
        await selectReportSection('Dashboard widgets');
        expect(Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Widget n1')!.getAttribute('aria-pressed')).toBe('false');
        await selectReportSection('Settings');
        expect(dialog.querySelector('input[value="Selected title"]')).toBeTruthy();
        expect(dialog.querySelector('input[value="2026-Q4"]')).toBeTruthy();
        expect(dialog.textContent).not.toContain('2 widgets');
        await act(async () => Array.from(dialog.querySelectorAll('button')).find(button => button.textContent?.includes('Generate'))!.click());
        expect(exportDashboardWidgets).toHaveBeenLastCalledWith('p1', widgets, new Set(['c1']));
        const request = requests.mock.calls.find(([url]) => url.endsWith('/reports/generate'))!;
        expect(JSON.parse(String(request[1]?.body))).toMatchObject({ period: '2026-Q4', evaluation_pids: [runs[0].pid] });
    });

    it('submits dashboard widgets as artifact ids, without inline images or svg', async () => {
        pickerExport.selected = async () => [{
            key: 'c1', kind: 'chart', title: 'Accuracy', comment: 'en',
            image: 'data:image/png;base64,AAAA',
        }];
        const calls: [string, RequestInit?][] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push([url, init]);
                if (url.startsWith('data:image/png')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])]),
                        json: async () => ({}),
                    });
                }
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
                    ok: true, status: 200,
                    json: async () => ({ default_format: 'pdf', default_sections: [] }),
                });
            }),
        );
        await renderPage();
        const buttonsWithText = (text: string) =>
            Array.from(document.body.querySelectorAll('button')).filter((b) =>
                (b.textContent ?? '').includes(text),
            );
        await act(async () => { buttonsWithText('Generate')[0]!.click(); });
        await act(async () => {});
        const confirm = buttonsWithText('Generate');
        await act(async () => { confirm[confirm.length - 1]!.click(); });
        await act(async () => {});
        const post = calls.find(([url, init]) =>
            url.includes('/reports/generate') && init?.method === 'POST',
        );
        expect(post).toBeTruthy();
        const body = JSON.parse((post![1] as RequestInit).body as string) as Record<string, unknown>;
        const widget = (body.dashboard as Array<Record<string, unknown>>)[0];
        expect(widget).toMatchObject({
            key: 'c1', kind: 'chart', title: 'Accuracy', comment: 'en',
            artifact_id: 'artifact-1',
        });
        expect(widget).not.toHaveProperty('image');
        expect(widget).not.toHaveProperty('svg');
        expect(vi.mocked(uploadReportChart)).toHaveBeenCalled();
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
        await selectReportSection('Settings');
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

    it('shows the pending card during chart preparation, polling, and server generation', async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        vi.mocked(exportEvaluationCharts).mockReturnValueOnce(new Promise((resolve) => {
            finish = () => resolve([]);
        }));
        let submitted = false;
        let preparing = false;
        vi.mocked(prepareReport).mockImplementationOnce(async () => {
            preparing = true;
            return { pid: 'draft-report', project_id: 'p1', period: 'Report', format: 'pdf',
                status: 'preparing', created_at: '', file_ref: '' };
        });
        let completed = false;
        const serverReport = { ...reports[0], pid: 'r2', period: 'Report', status: 'pending' };
        const originalFetch = fetch;
        vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
            if (url.includes('/reports/generate')) {
                submitted = true;
                return Promise.resolve({ ok: true, json: async () => serverReport });
            }
            if (url.endsWith('/reports')) {
                return Promise.resolve({ ok: true, json: async () => submitted
                    ? [{ ...serverReport, status: completed ? 'generated' : 'pending' }, ...reports]
                    : preparing ? [{ ...serverReport, pid: 'draft-report', status: 'preparing' }, ...reports] : reports });
            }
            return originalFetch(url, init);
        }));
        try {
            await renderPage();
            const generateButtons = () => Array.from(document.querySelectorAll('button'))
                .filter((button) => button.textContent?.includes('Generate'));
            await act(async () => generateButtons()[0].click());
            await act(async () => {
                const buttons = generateButtons();
                buttons[buttons.length - 1].click();
            });
            const deleteButton = () => document.querySelector<HTMLButtonElement>('button[aria-label="Delete Report"]');
            expect(exportEvaluationCharts).toHaveBeenCalled();
            expect(document.body.textContent).toContain('Generating…');
            expect(document.body.textContent).not.toContain('Generating report…');
            expect(deleteButton()?.disabled).toBe(true);
            expect(document.querySelector('button[aria-label="Download Report"]')).toBeNull();
            await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
            expect(document.querySelector('[role="dialog"]')).toBeNull();
            expect(deleteButton()?.disabled).toBe(true); // polling preserves the temporary card
            expect(submitted).toBe(false);
            await act(async () => finish());
            expect(submitted).toBe(true);
            expect(document.querySelectorAll('button[aria-label="Delete Report"]')).toHaveLength(1);
            expect(deleteButton()?.disabled).toBe(false);
            expect(document.body.textContent).toContain('Generating…');
            completed = true;
            await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
            expect(document.body.textContent).not.toContain('Generating…');
            expect(document.querySelector('button[aria-label="Download Report"]')).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('removes the temporary card and shows the error if preparation fails', async () => {
        vi.mocked(exportEvaluationCharts).mockRejectedValueOnce(new Error('Chart preparation failed'));
        await renderPage();
        const buttons = () => Array.from(document.querySelectorAll('button'))
            .filter((button) => button.textContent?.includes('Generate'));
        await act(async () => buttons()[0].click());
        await act(async () => {
            const generate = buttons();
            generate[generate.length - 1].click();
        });
        expect(document.body.textContent).toContain('Chart preparation failed');
        expect(document.body.textContent).not.toContain('Generating…');
        expect(document.querySelector('button[aria-label="Delete Report"]')).toBeNull();
        expect(document.querySelector('button[aria-label="Delete 2026-Q3"]')).not.toBeNull();
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
        expect(text).toContain('e1e1e1e1');
    });
});

describe('report operation guards', () => {
    const buttons = () => Array.from(document.querySelectorAll('button'))
        .filter((button) => button.textContent?.includes('Generate'));
    async function confirm() {
        await act(async () => buttons()[0].click());
        await act(async () => { const all = buttons(); all[all.length - 1].click(); });
    }
    function backend() {
        const fetch = vi.fn(async (url: string, init?: RequestInit) => {
            if (url.includes('/reports/generate')) throw new Error('response lost');
            if (init?.method === 'DELETE') return { ok: true, status: 204 };
            return { ok: true, status: 200, json: async () =>
                url.endsWith('/reports') || url.endsWith('/evaluations') ? [] : { default_format: 'pdf', default_sections: [] } };
        });
        vi.stubGlobal('fetch', fetch);
        return fetch;
    }
    it('ignores a late dialog load after switching projects', async () => {
        backend();
        await renderPage();
        let release!: () => void;
        vi.mocked(fetchDashboard).mockImplementationOnce(() => new Promise((resolve) => {
            release = () => resolve({ widgets: [{ key: 'late', kind: 'text', text: 'old' }], layouts: {}, revision: 1, can_edit: true });
        }));
        await act(async () => buttons()[0].click());
        project.pid = 'p2';
        await renderPage();
        await act(async () => release());
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    it('continues the original project preparation after switching projects', async () => {
        const fetch = backend();
        let release!: () => void;
        vi.mocked(exportEvaluationCharts).mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([]); }));
        await renderPage();
        await confirm();
        project.pid = 'p2';
        await renderPage();
        await act(async () => release());
        expect(fetch.mock.calls.some(([url]) => url.includes('/reports/generate'))).toBe(true);
        expect(fetch.mock.calls.some(([url, init]) => url.includes('/projects/p1/reports/draft-report') && init?.method === 'DELETE')).toBe(false);
        expect(document.body.textContent).not.toContain('Project changed');
        expect(document.body.textContent).not.toContain('Generating…');
    });
    it('retains a submitted report when its response is lost', async () => {
        const fetch = backend();
        await renderPage();
        await confirm();
        expect(fetch.mock.calls.some(([url]) => url.includes('/reports/generate'))).toBe(true);
        expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
        expect(document.body.textContent).toContain('response lost');
    });
});
