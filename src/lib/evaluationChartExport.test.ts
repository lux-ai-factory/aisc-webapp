import { afterEach, expect, it, vi } from 'vitest';
import { exportEvaluationCharts } from './evaluationChartExport';
import { refreshDoneEvaluations } from './dashboardCharts';

vi.mock('./dashboardCharts', () => ({ refreshDoneEvaluations: vi.fn() }));
vi.mock('../components/dashboard/reportChartExport', () => ({
    exportChartPanels: vi.fn(async () => [{ image: 'png', svg: 'svg' }]),
}));
afterEach(() => vi.unstubAllGlobals());
it('fetches four plugin results at once and preserves plugin/spec order', async () => {
    vi.mocked(refreshDoneEvaluations).mockResolvedValue([
        { pid: 'e1', status: 'Done', evaluation_plugins: Array.from({ length: 5 }, (_, index) => ({ pid: `p${index}`, name: 'tool' })) },
        { pid: 'ignored', status: 'Done', evaluation_plugins: [{ pid: 'ignored', name: 'tool' }] },
    ]);
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn(() => new Promise((resolve) => releases.push(() => resolve({
        ok: true, json: async () => ({ measurements: [], metric_visualizations: [
            { chart_type: 'table', metrics: [] }, { chart_type: 'bars', metrics: [] },
        ] }),
    }))));
    vi.stubGlobal('fetch', fetchMock);
    const pending = exportEvaluationCharts('project', ['e1']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    releases[3](); // Finish a later request first.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    for (const index of [4, 2, 1, 0]) releases[index]();
    const charts = await pending;
    expect(charts.map((chart) => chart.evaluation_plugin_pid)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    expect(charts.every((chart) => chart.visualization_index === 1)).toBe(true);
});
