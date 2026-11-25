// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Measurement } from '../../models/models';
import { exportChartPanels } from './reportChartExport';
import { renderVisualization } from './dashboardPlot';
import { chartImage, serializeChartSurfaceSvg } from './dashboardExport';

vi.mock('./dashboardPlot', () => ({
    renderVisualization: vi.fn(() => <svg className="MuiChartsSurface-root"><rect height="20" /></svg>),
}));
vi.mock('./dashboardExport', () => ({
    serializeChartSurfaceSvg: vi.fn(() => '<svg viewBox="0 0 900 430"><rect height="20" /></svg>'),
    readLegendItems: vi.fn(() => []),
    chartImage: vi.fn(async () => 'data:image/png;base64,test'),
}));
const data = [{ name: 'accuracy', time: '', created_at: '', score: 1, dimensions: { language: 'en' } },
    { name: 'accuracy', time: '', created_at: '', score: 0.5, dimensions: { language: 'fr' } }] as Measurement[];
beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 430 } as DOMRect);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('waits beyond the old fixed delay before exporting a stable chart', async () => {
    vi.mocked(serializeChartSurfaceSvg).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined).mockReturnValueOnce(undefined).mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);
    const pending = exportChartPanels(data, { chart_type: 'bars', metrics: ['accuracy'] });
    await vi.advanceTimersByTimeAsync(250);
    expect(chartImage).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(await pending).toHaveLength(1);
    expect(document.body.children).toHaveLength(0);
});

it.each(['bars', 'line', 'scatter', 'kde', 'pie', 'radar'])('exports every %s facet panel', async (chart_type) => {
    const pending = exportChartPanels(data, { chart_type, metrics: ['accuracy'], facet_by_dimension: ['language'] });
    await vi.runAllTimersAsync();
    expect((await pending).map((panel) => panel.label)).toEqual(['language: en', 'language: fr']);
    const calls = vi.mocked(renderVisualization).mock.calls;
    expect(calls[calls.length - 1][4]).toBe(['line', 'bars'].includes(chart_type) ? 430 : 400);
    expect(document.body.children).toHaveLength(0);
});

it('cleans up and rejects a failed image export instead of returning a blank PNG', async () => {
    vi.mocked(chartImage).mockRejectedValueOnce(new Error('SVG load failed'));
    const pending = expect(exportChartPanels(data, { chart_type: 'bars', metrics: ['accuracy'] }))
        .rejects.toThrow('SVG load failed');
    await vi.runAllTimersAsync();
    await pending;
    expect(document.body.children).toHaveLength(0);
});

it('shares the two-chart limit across simultaneous exports', async () => {
    const first = exportChartPanels(data, { chart_type: 'bars', metrics: ['accuracy'], facet_by_dimension: ['language'] });
    const second = exportChartPanels(data, { chart_type: 'line', metrics: ['accuracy'], facet_by_dimension: ['language'] });
    await vi.advanceTimersByTimeAsync(0);
    expect(document.body.children).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(250);
    expect(document.body.children.length).toBeLessThanOrEqual(2);
    await vi.runAllTimersAsync();
    expect((await first).map((panel) => panel.label)).toEqual(['language: en', 'language: fr']);
    expect((await second).map((panel) => panel.label)).toEqual(['language: en', 'language: fr']);
    expect(document.body.children).toHaveLength(0);
});
