// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { startReportGeneration, useReportGeneration } from './reportGeneration';
import { deleteReport, generateReport, prepareReport, type ReportSettingsPayload } from './report';
import { uploadReportCharts } from './reportCharts';
vi.mock('./evaluationChartExport', () => ({ exportEvaluationCharts: async () => [] }));
vi.mock('./reportCharts', () => ({ uploadReportCharts: vi.fn(async () => ({ dashboard: [], evaluation_charts: [] })) }));
vi.mock('./report', () => ({
    cleanSections: (sections: string[]) => sections,
    setReportSettings: async (_pid: string, settings: object) => settings,
    prepareReport: vi.fn(async (pid: string) => ({ pid: `draft-${pid}`, project_id: pid, status: 'preparing' })),
    generateReport: vi.fn(async (pid: string) => ({ pid: `draft-${pid}`, project_id: pid, status: 'pending' })),
    deleteReport: vi.fn(async () => {}),
}));
const input = () => ({ period: 'P1', evaluations: ['evaluation-A'], settings: {
    default_sections: ['evaluations'], default_format: 'pdf', report_title: 'Original',
} as ReportSettingsPayload });
it('continues across unmounts, freezes inputs, and prevents duplicate preparation', async () => {
    let finish!: (rows: []) => void;
    const exportCharts = vi.fn(() => new Promise<[]>(resolve => { finish = resolve; }));
    const host = document.createElement('div');
    let root = createRoot(host);
    function Status() { return <span>{useReportGeneration('navigation')?.running ? 'working' : 'done'}</span>; }
    const captured = input();
    await act(async () => { root.render(<Status />); startReportGeneration('navigation', captured, exportCharts); });
    expect(host.textContent).toBe('working');
    await act(async () => root.unmount());
    captured.evaluations.push('wrong');
    captured.settings.report_title = 'Changed';
    startReportGeneration('navigation', input(), exportCharts);
    expect(exportCharts).toHaveBeenCalledTimes(1);
    root = createRoot(host);
    await act(async () => root.render(<Status />));
    expect(host.textContent).toBe('working');
    await act(async () => finish([]));
    expect(host.textContent).toBe('done');
    expect(generateReport).toHaveBeenCalledWith('navigation', expect.objectContaining({ evaluation_pids: ['evaluation-A'] }));
    expect(deleteReport).not.toHaveBeenCalledWith('navigation', expect.anything());
    await act(async () => root.unmount());
});
it('allows another project to prepare independently', async () => {
    const exporter = async () => [];
    startReportGeneration('parallel-A', input(), exporter);
    startReportGeneration('parallel-B', input(), exporter);
    await vi.waitFor(() => {
        expect(generateReport).toHaveBeenCalledWith('parallel-A', expect.anything());
        expect(generateReport).toHaveBeenCalledWith('parallel-B', expect.anything());
    });
});
it('cleans up failed preparation but retains a submission whose response is lost', async () => {
    vi.mocked(uploadReportCharts).mockRejectedValueOnce(new Error('upload failed'));
    startReportGeneration('upload-failure', input(), async () => []);
    await vi.waitFor(() => expect(deleteReport).toHaveBeenCalledWith('upload-failure', 'draft-upload-failure'));
    vi.mocked(generateReport).mockRejectedValueOnce(new Error('response lost'));
    startReportGeneration('lost-response', input(), async () => []);
    await vi.waitFor(() => expect(generateReport).toHaveBeenCalledWith('lost-response', expect.anything()));
    expect(deleteReport).not.toHaveBeenCalledWith('lost-response', expect.anything());
    expect(prepareReport).toHaveBeenCalledWith('lost-response', 'P1', 'pdf');
});
