// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import ChartBuilderDialog from './ChartBuilderDialog';
import type { GridWidget } from '../../lib/dashboardCharts';
import type { Measurement } from '../../models/models';

vi.mock('../plugin/MeasurementsDataGrid', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsLineChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsScatterChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsKDEChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsBarsChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsPieChart', () => ({ default: () => null }));
vi.mock('@mui/x-charts', () => ({ RadarAxis: () => null }));
// Keep the real radar series builder; only replace MUI's drawing surface.
vi.mock('@mui/x-charts/RadarChart', () => ({
    RadarChart: ({ series, children }: { series: Array<{ label?: string }>; children: ReactNode }) =>
        <div data-radar-labels={JSON.stringify(series.map((item) => item.label))}>{children}</div>,
}));
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const run = 'Explainability (bd7039cc)';
const first = `feature_ablation - ${run}`;
const second = `integrated_gradients - ${run}`;
const data: Measurement[] = ['a', 'b'].flatMap((fold) => ['feature_ablation', 'integrated_gradients']
    .flatMap((method) => ['Complexity', 'Fidelity'].map((name) => ({
        name, score: 0.7, time: '', created_at: '', dimensions: { method, fold, __eval: run },
    }))));
let root: Root;
let container: HTMLElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

async function renderBuilder(facetDim = '') {
    const initial: GridWidget = { key: 'radar', kind: 'chart', plugin: 'Tool', chartType: 'radar',
        evaluations: ['eval'], metrics: ['Complexity', 'Fidelity'], groupBy: ['method'], facetDim };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const submit = vi.fn();
    await act(async () => root.render(<ChartBuilderDialog open
        initial={initial} plugins={[{ name: 'Tool', displayName: 'Tool' }]}
        evals={[{ pid: 'eval', status: 'Done' }]} dataFor={() => data}
        requestData={() => {}} visualizationsFor={() => []} onClose={() => {}} onSubmit={submit} />));
    return submit;
}
function editorFields() {
    return Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter((input) =>
        [first, second].includes(input.labels?.[0]?.textContent ?? ''));
}
function plotLabels() {
    return Array.from(document.querySelectorAll('[data-radar-labels]')).map((plot) =>
        JSON.parse(plot.getAttribute('data-radar-labels')!) as string[]);
}

it('shows one editor label per actual radar group, without metric prefixes', async () => {
    await renderBuilder();
    expect(editorFields().map((input) => input.labels![0].textContent)).toEqual([first, second]);
    expect(plotLabels()).toEqual([[first, second]]);
    const labels = Array.from(document.querySelectorAll('label')).map((label) => label.textContent);
    expect(labels).not.toContain(`Complexity (${first})`);
    expect(labels).not.toContain(`Fidelity (${first})`);
});

it('applies editor renaming and ordering to the radar preview and saved widget', async () => {
    const submit = await renderBuilder();
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        const input = editorFields()[0];
        setter.call(input, 'Feature ablation');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const move = Array.from(document.querySelectorAll('button'))
        .find((button) => button.getAttribute('aria-label') === `Move up ${second}`)!;
    await act(async () => move.click());
    expect(plotLabels()).toEqual([[second, 'Feature ablation']]);
    const save = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Save')!;
    await act(async () => save.click());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
        labelOverrides: { [first]: 'Feature ablation' }, labelOrder: [second, first],
    }));
});

it('uses matching group labels in each facet editor and preview', async () => {
    await renderBuilder('fold');
    expect(plotLabels()).toHaveLength(4); // two folds × two metrics
    expect(editorFields()).toHaveLength(8); // two groups per chart
    for (const labels of plotLabels()) expect(labels).toEqual([first, second]);
});
