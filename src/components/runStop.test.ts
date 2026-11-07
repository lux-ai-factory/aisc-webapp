// @vitest-environment jsdom
// The progress bar titles each run with its name and offers to stop it (runStop.ts does the call).
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvalProgressRow } from './EvaluationProgressList';
import { progressTitle, stopRun } from './runStop';

describe('the title of a run in the progress bar', () => {
    it('is the run name when the run has one', () => {
        expect(progressTitle({ evaluation_plugins: [{ run_name: ' GENDER on local ' }] })).toBe('GENDER on local');
    });

    it('is "Evaluation Progress" when the run has no name, as before', () => {
        expect(progressTitle({ evaluation_plugins: [{ run_name: '' }] })).toBe('Evaluation Progress');
        expect(progressTitle({})).toBe('Evaluation Progress');
    });
});

describe('stopping a run', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('posts to the run and answers its new status', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pid: 'e1', status: 'Failed' }) });
        vi.stubGlobal('fetch', fetchMock);
        expect(await stopRun('http://api', 'e1')).toBe('Failed');
        expect(fetchMock).toHaveBeenCalledWith('http://api/evaluations/e1/stop', { method: 'POST' });
    });

    it('says why when the engine refuses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false, status: 409, json: async () => ({ detail: 'The run has already ended (Done)' }) }));
        await expect(stopRun('http://api', 'e1')).rejects.toThrow('already ended');
    });

    it('gives a general reason when the engine says nothing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error(); } }));
        await expect(stopRun('http://api', 'e1')).rejects.toThrow('could not be stopped');
    });
});

describe('the progress bar', () => {
    let root: Root | null = null;
    let container: HTMLElement | null = null;
    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        vi.unstubAllGlobals();
    });

    /** The bar's row for run e1, with the engine answering Stop with `stopAnswer`; every call is recorded. */
    async function showRow(stopAnswer: { ok: boolean; status: number; body: unknown }) {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/evaluations/e1/stop')) {
                return { ok: stopAnswer.ok, status: stopAnswer.status, json: async () => stopAnswer.body } as Response;
            }
            if (url.includes('/tasks/')) return { ok: true, json: async () => ({}) } as Response;
            if (url.includes('/evaluations/e1?include=plugin')) {
                return { ok: true, json: async () => ({ evaluation_plugins: [] }) } as Response;
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        const evaluation = { pid: 'e1', task: 't1', status: 'Processing',
                             evaluation_plugins: [{ pid: 'ep1', name: 'P', run_name: 'GENDER on local' }] };
        await act(async () => {
            root!.render(createElement(EvalProgressRow, {
                evaluation: evaluation as never, collapseSignal: 0, expandSignal: 0, pluginIcons: {} }));
        });
        return fetchMock;
    }

    const button = (text: string) =>
        [...container!.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
    const press = async (text: string) => {
        await act(async () => { button(text)!.click(); });
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };
    const stopCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
        fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/evaluations/e1/stop'));

    it("titles the run with its name", async () => {
        await showRow({ ok: true, status: 200, body: { pid: 'e1', status: 'Failed' } });
        expect(container!.textContent).toContain('GENDER on local');
        expect(container!.textContent).not.toContain('Evaluation Progress');
    });

    it('asks to confirm on the page, then stops the run and says it is stopping', async () => {
        const fetchMock = await showRow({ ok: true, status: 200, body: { pid: 'e1', status: 'Failed' } });
        await press('Stop');
        expect(container!.textContent).toContain('Stop this run?');
        expect(stopCalls(fetchMock)).toEqual([]);
        await press('Yes, stop');
        expect(stopCalls(fetchMock)).toEqual([[expect.stringMatching(/\/evaluations\/e1\/stop$/), { method: 'POST' }]]);
        expect(container!.textContent).toContain('Stopping...');
        expect(container!.textContent).not.toContain('Stop this run?');
    });

    it('No goes back to the Stop button without stopping', async () => {
        const fetchMock = await showRow({ ok: true, status: 200, body: {} });
        await press('Stop');
        await press('No');
        expect(stopCalls(fetchMock)).toEqual([]);
        expect(button('Stop')).toBeDefined();
        expect(container!.textContent).not.toContain('Stop this run?');
    });

    it("shows the engine's reason when it refuses, and offers Stop again", async () => {
        await showRow({ ok: false, status: 409, body: { detail: 'The run has already ended (Done)' } });
        await press('Stop');
        await press('Yes, stop');
        expect(container!.textContent).toContain('The run has already ended (Done)');
        expect(container!.textContent).not.toContain('Stopping...');
        expect(button('Stop')?.disabled).toBe(false);
    });
});
