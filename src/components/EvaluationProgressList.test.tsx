// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import EvaluationProgressList from './EvaluationProgressList';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLElement;
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

it('places Stop on the right, preserves failure status, and confirms before stopping', async () => {
    let finishStop: () => void = () => {};
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
            await new Promise<void>((resolve) => { finishStop = resolve; });
            return { ok: true };
        }
        const data = url.endsWith('?status=Pending') ? []
            : url.endsWith('?status=Processing') ? [{ pid: 'eval', task: 'task', evaluation_plugins: [] }]
            : url.endsWith('/tasks/task/status') ? { tool: { progress: 0.2, extra: { status: 'Failed' } } }
            : {};
        return { ok: true, json: async () => data };
    });
    vi.stubGlobal('fetch', fetch);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<EvaluationProgressList projectUUID="project" />));
    await act(async () => {});
    const stop = document.querySelector<HTMLButtonElement>('button[aria-label="Stop evaluation"]')!;
    const row = stop.closest('tr')!;
    const actions = stop.closest('span')!.parentElement!;
    expect(actions.textContent).toContain('Attention needed');
    expect(actions.previousElementSibling?.textContent).toContain('Evaluation Progress');
    expect(row.textContent).not.toContain('In progress');
    const details = row.nextElementSibling!.querySelector('.MuiCollapse-root')!;
    const expanded = details.className;
    await act(async () => stop.click());
    expect(details.className).toBe(expanded);
    expect(document.body.textContent).toContain('Stop this evaluation?');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    const confirm = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Stop')!;
    await act(async () => confirm.click());
    expect(stop.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/task/stop'), { method: 'POST' });
    await act(async () => finishStop());
    expect(stop.disabled).toBe(true);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect(document.body.textContent).not.toContain('Stop this evaluation?');
});
