// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import MeasurementsBarsChart from './MeasurementsBarsChart';
import type { Measurement } from '../../models/models';

vi.mock('@mui/x-charts/BarChart', () => ({
    BarChart: ({ height }: { height: number }) => <div data-plot-height={height} />,
}));
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const data = [{ name: 'accuracy', score: 1, time: '', created_at: '', dimensions: { fold: 'a' } },
    { name: 'accuracy', score: 0.8, time: '', created_at: '', dimensions: { fold: 'b' } }] as Measurement[];
let root: Root;
let container: HTMLDivElement;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it.each([undefined, 430])('keeps facet and non-facet dimensions consistent at height %s', async (height) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MeasurementsBarsChart data={data} height={height} />));
    const single = container.querySelector<HTMLElement>('[data-plot-height]')!;
    const singleHeight = single.dataset.plotHeight;
    const singleWidth = getComputedStyle(single.parentElement!).width;
    expect(singleWidth).toBe('100%');
    await act(async () => root.render(<MeasurementsBarsChart data={data} facetByDimension="fold" height={height} />));
    const panels = container.querySelectorAll<HTMLElement>('[data-plot-height]');
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
        expect(panel.dataset.plotHeight).toBe(singleHeight);
        expect(getComputedStyle(panel.parentElement!).width).toBe(singleWidth);
        expect(getComputedStyle(panel.parentElement!.parentElement!).width).toBe('100%');
    }
});
