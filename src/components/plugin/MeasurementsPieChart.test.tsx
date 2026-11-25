// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import MeasurementsPieChart from './MeasurementsPieChart';

const state = vi.hoisted(() => ({ data: [] as Array<{ value: number }> }));
vi.mock('@mui/x-charts', () => ({ PieChart: ({ series }: { series: Array<{ data: typeof state.data }> }) => {
    state.data = series[0].data;
    return null;
} }));
it('includes each series even when measurements have different timestamps', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(<MeasurementsPieChart groupByDimensions={['run']} data={[
        { name: 'score', score: 60, time: '2026-01-01', dimensions: { run: 'A' }, description: '', created_at: '2026-01-01' },
        { name: 'score', score: 40, time: '2026-01-02', dimensions: { run: 'B' }, description: '', created_at: '2026-01-01' },
        { name: 'score', score: 90, time: '2026-01-03', dimensions: { run: 'A' }, description: '', created_at: '2026-01-01' },
    ]} />));
    expect(state.data.map(slice => slice.value)).toEqual([60, 40]);
    await act(async () => root.unmount());
});
