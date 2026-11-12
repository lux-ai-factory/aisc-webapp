// @vitest-environment jsdom
// A dataset deleted while evaluations used it is retired by the engine: the page says so, leaves it out of the
// list, and shows it again under Show retired, with Restore.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AISystemSettings from './AISystemSettings';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PID = '11111111-2222-4333-8444-555555555555';
let calls: { url: string; method: string }[] = [];
let deleteAnswer: Response;

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

beforeEach(() => {
    vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
    calls = [];
    deleteAnswer = { ok: true, status: 204, json: async () => null } as Response;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input), method = init?.method ?? 'GET';
        calls.push({ url, method });
        if (method === 'DELETE') return deleteAnswer;
        if (url.includes('/aisystem')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'sys-1', name: 'System',
                    components: [
                        { pid: 'c-1', name: 'Prompts in use', component_type: 'dataset', data: 'p.csv', retired_at: null },
                        { pid: 'c-2', name: 'Old prompts', component_type: 'dataset', data: 'o.csv',
                          retired_at: '2026-11-12T16:35:00Z' },
                    ],
                }),
            } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
    });
});

afterEach(() => { vi.unstubAllEnvs(); document.body.innerHTML = ''; });

async function render() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        createRoot(container).render(
            <ProjectProvider><ProjectUUIDSetter uuid={PID} /><AISystemSettings /></ProjectProvider>);
    });
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    return container;
}

const button = (root: HTMLElement, label: RegExp) =>
    [...root.querySelectorAll('button, label')].find(b => label.test(b.textContent ?? '') || label.test(b.getAttribute('aria-label') ?? '')) as HTMLElement;

it('a retired dataset is left out of the list', async () => {
    const page = await render();
    expect(page.textContent).toContain('Prompts in use');
    expect(page.textContent).not.toContain('Old prompts');
});

it('Show retired lists it with Restore, which brings it back', async () => {
    const page = await render();
    await act(async () => { button(page, /Show retired/).click(); });
    expect(page.textContent).toContain('Old prompts');
    await act(async () => { button(page, /Restore Old prompts/).click(); });
    expect(calls).toContainEqual({ url: expect.stringContaining('/components/c-2/restore'), method: 'POST' });
});

it('deleting a dataset evaluations used says it was retired', async () => {
    deleteAnswer = { ok: true, status: 200, json: async () => ({ retired: true, evaluations: 2 }) } as Response;
    const page = await render();
    await act(async () => { button(page, /Delete Prompts in use/).click(); });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(page.textContent).toContain('Prompts in use is retired: 2 evaluations used it');
});

it('a failed delete is said, not ignored', async () => {
    deleteAnswer = { ok: false, status: 500, json: async () => ({ detail: 'boom' }) } as Response;
    const page = await render();
    await act(async () => { button(page, /Delete Prompts in use/).click(); });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(page.textContent).toContain('Prompts in use could not be deleted');
});
