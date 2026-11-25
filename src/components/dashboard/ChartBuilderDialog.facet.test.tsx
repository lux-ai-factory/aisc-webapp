// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ChartBuilderDialog from './ChartBuilderDialog';

// Mirror the picker's chart mocks: the live MUI chart components are replaced
// with lightweight nodes so the preview stays cheap in jsdom.
vi.mock('../plugin/MeasurementsDataGrid', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsLineChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsScatterChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsRadarChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsKDEChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsPieChart', () => ({ default: () => null }));
vi.mock('../plugin/MeasurementsBarsChart', async () => {
    const React = (await import('react')).default;
    return { default: () => React.createElement('svg', { 'data-chart': 'bars' }) };
});

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { name: string; score: number; time: string; created_at: string; dimensions: Record<string, string> };

function rows(values: string[]): Row[] {
    return values.map((fold) => ({ name: 'acc', score: 0.5, time: 't', created_at: 't', dimensions: { fold } }));
}

let suppliedRows: Row[] = [];
let renderedTick: (() => void) | null = null;

// The dialog reads its data through dataFor (a prop); the harness re-renders
// with a fresh closure to deliver "data updates" exactly like the dashboard
// poll does, without React caching the measurements.
function DialogHarness() {
    const [, setTick] = useState(0);
    renderedTick = () => setTick((t) => t + 1);
    return (
        <ChartBuilderDialog
            open
            plugins={[{ name: 'Tool', displayName: 'Tool' }]}
            evals={[{
                pid: 'e1', status: 'Done', name: 'Run', created_at: '2026-10-01',
                evaluation_plugins: [{ pid: 'ep1', name: 'Tool', display_name: 'Tool' }],
            }]}
            dataFor={() => suppliedRows}
            requestData={() => {}}
            visualizationsFor={() => []}
            initial={null}
            onClose={() => {}}
            onSubmit={() => {}}
        />
    );
}

let container: HTMLElement;
let root: Root;

async function render() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(<DialogHarness />); });
    await act(async () => {});
}

async function pickFacetDimension(name: string) {
    const combo = Array.from(document.body.querySelectorAll<HTMLElement>('[role="combobox"]')).find((c) =>
        (c.closest('.MuiFormControl-root')?.querySelector('label')?.textContent ?? '').includes('Facet (iterate) by dim'),
    );
    await act(async () => {
        combo!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        combo!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const option = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
        (m) => (m.textContent ?? '').trim() === name,
    );
    await act(async () => { (option as HTMLElement).click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
}

/** Click a facet value in the "Facet charts to add" dropdown to (de)select it. */
async function toggleFacetValue(value: string) {
    const combo = Array.from(document.body.querySelectorAll<HTMLElement>('[role="combobox"]')).find((c) =>
        (c.closest('.MuiFormControl-root')?.querySelector('label')?.textContent ?? '').includes('Facet charts to add'),
    );
    await act(async () => {
        combo!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        combo!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const option = Array.from(document.body.querySelectorAll('.MuiMenuItem-root')).find(
        (m) => (m.textContent ?? '').trim() === value,
    );
    await act(async () => { (option as HTMLElement).click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
}

async function deliverData(next: Row[]) {
    suppliedRows = next;
    await act(async () => { renderedTick!(); });
    await act(async () => {});
}

function facetSelectText(): string {
    const combo = Array.from(document.body.querySelectorAll<HTMLElement>('[role="combobox"]')).find((c) =>
        (c.closest('.MuiFormControl-root')?.querySelector('label')?.textContent ?? '').includes('Facet charts to add'),
    );
    return combo?.textContent ?? '';
}

beforeEach(() => {
    document.body.innerHTML = '';
    suppliedRows = [];
    renderedTick = null;
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('ChartBuilderDialog facet selection', () => {
    it('defaults to all values and preserves a customized selection across data updates', async () => {
        suppliedRows = rows(['a']);
        await render();
        await pickFacetDimension('fold');
        // untouched selection starts from the first available value set
        expect(facetSelectText()).toContain('a');
        expect(facetSelectText()).not.toContain('b');

        // late data arrives before any user selection: the default follows it
        await deliverData(rows(['a', 'b']));
        expect(facetSelectText()).toContain('a');
        expect(facetSelectText()).toContain('b');

        // the user drops "b", customizing the selection
        await toggleFacetValue('b');
        expect(facetSelectText()).toContain('a');
        expect(facetSelectText()).not.toContain('b');

        // a background data update adds "c": it is NOT auto-selected after the
        // user customized; "a" (still present) is preserved
        await deliverData(rows(['a', 'b', 'c']));
        expect(facetSelectText()).toContain('a');
        expect(facetSelectText()).not.toContain('c');

        // a data update removes "a": the selected value that genuinely
        // disappeared is dropped, others stay untouched
        await deliverData(rows(['b', 'c']));
        expect(facetSelectText()).not.toContain('a');
        expect(facetSelectText()).not.toContain('c');
    });

    it('preserves an intentionally empty selection against late data', async () => {
        suppliedRows = rows(['a']);
        await render();
        await pickFacetDimension('fold');
        // user intentionally clears the selection (None)
        await toggleFacetValue('a');
        expect(facetSelectText()).not.toContain('a');

        // additional values arrive — a customized (empty) selection must stay empty
        await deliverData(rows(['a', 'b']));
        expect(facetSelectText()).not.toContain('a');
        expect(facetSelectText()).not.toContain('b');

        // and it also survives even later updates
        await deliverData(rows(['a', 'b', 'c']));
        expect(facetSelectText()).not.toContain('a');
        expect(facetSelectText()).not.toContain('c');
    });
});
