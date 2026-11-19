// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const plugin: Plugin = {
    pid: 'plg-1',
    name: 'DemoPlugin',
    config: {},
    display_icon: 'extension',
    package_name: 'demo-pkg',
    version: '0.1.0',
    display_name: 'Demo',
    plugin_pid: 'plg-1',
    enabled: true,
    status: 'ok',
};

const otherPlugin: Plugin = { ...plugin, pid: 'plg-2', name: 'OtherPlugin', package_name: 'other-pkg', display_name: 'Other', plugin_pid: 'plg-2' };

// the tests the project offers, and what the engine answers to a launch
let offered: Plugin[];
let launchAnswer: { status: number; body: unknown };

beforeEach(() => {
    sessionStorage.clear();
    offered = [plugin];
    launchAnswer = { status: 200, body: { pid: 'run-1' } };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/evaluations/task') && init?.method === 'POST') {
            return { ok: launchAnswer.status < 400, status: launchAnswer.status, json: async () => launchAnswer.body } as Response;
        }
        if (url.includes('/display_icon')) {
            return { ok: true, json: async () => 'extension' } as Response;
        }
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [
                    { name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true },
                    { name: 'model', label: 'Model', input_type: 'model', required: true },
                ],
            } as Response;
        }
        if (url.includes('/configs')) {
            return { ok: true, json: async () => [] } as Response;
        }
        if (url.includes('/evaluation-inputs-template')) {
            return {
                ok: true,
                json: async () => ({
                    DemoPlugin: {
                        dataset: { component_pid: 'comp-dataset', value: {} },
                        model: { component_pid: 'comp-model', value: {} },
                    },
                    OtherPlugin: {
                        dataset: { component_pid: 'comp-dataset', value: {} },
                        model: { component_pid: 'comp-model', value: {} },
                    },
                }),
            } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'proj-1',
                    name: 'P',
                    plugins: offered,
                    components: [
                        { pid: 'comp-dataset', name: 'Dataset A', component_type: 'dataset' },
                        { pid: 'comp-model', name: 'Model A', component_type: 'model' },
                    ],
                }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function waitForHtml(query: (el: HTMLElement) => boolean, container: HTMLElement, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        } catch { /* ignore */ }
        if (query(container)) return;
    }
    throw new Error('waitFor timed out; html: ' + container.innerHTML.slice(0, 2000));
}

function mountPage(container: HTMLDivElement): Root {
    const root = createRoot(container);
    act(() => {
        root.render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter>
                    <ProjectProvider>
                        <ProjectUUIDSetter uuid="proj-1" />
                        <PluginStartEvaluation />
                    </ProjectProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    return root;
}

it('restores previously used values from session storage after remount', async () => {
    sessionStorage.setItem('start-eval-selections:proj-1', JSON.stringify({
        selectedPlugins: {
            'demo-pkg/DemoPlugin': [
                { pid: 'comp-model', name: 'model', input_type: 'model', value: {} },
            ],
        },
        selectionCache: {},
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);

    await waitForHtml(el => !!el.querySelector('[data-plugin-card]'), container);

    const card = container.querySelector('[data-plugin-card]') as HTMLElement;
    await act(async () => { card.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await waitForHtml(el => (el.textContent || '').includes('Model A'), container);
    expect(container.textContent).toContain('Model A');
    container.remove();
});

it('keeps a plugin unselected after the user deliberately unselects it', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);

    // Auto-restored from the last-used template.
    await waitForHtml(el => (el.textContent || '').includes('Dataset A'), container);

    // Unselect the (now ready/configured) plugin via the check-mark icon.
    const unselect = container.querySelector('[data-testid="CheckCircleIcon"]') as HTMLElement;
    expect(unselect).toBeTruthy();
    await act(async () => { unselect.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    // The selection should be gone and must NOT be re-restored by the template.
    await waitForHtml(el => !(el.textContent || '').includes('Dataset A'), container);
    container.remove();
});

it("never restores another project's selections in this tab", async () => {
    // the saved selections have one key per project: with one key for every project, after switching
    // projects in a tab the page would restore project A's selections (A's component pids) on project B's
    // evaluation page, keep them over B's last-used values, and Launch would send them
    const foreign = JSON.stringify({
        selectedPlugins: { 'demo-pkg/DemoPlugin': [{ pid: 'comp-of-another-project', name: 'model', input_type: 'model', value: {} }] },
        selectionCache: {},
    });
    sessionStorage.setItem('start-eval-selections', foreign);
    sessionStorage.setItem('start-eval-selections:proj-other', foreign);

    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);

    // this project's own last-used values come back (the template), not the other project's
    await waitForHtml(el => (el.textContent || '').includes('Dataset A'), container);
    expect(sessionStorage.getItem('start-eval-selections:proj-1') ?? '').not.toContain('comp-of-another-project');
    container.remove();
});

function ticked(container: HTMLElement): number {
    return container.querySelectorAll('[data-testid="CheckCircleIcon"]').length;
}

async function launchButton(container: HTMLElement): Promise<HTMLButtonElement> {
    await waitForHtml(el => {
        const b = [...el.querySelectorAll('button')].find(x => (x.textContent || '').includes('Launch Evaluation'));
        return !!b && !b.disabled;
    }, container);
    return [...container.querySelectorAll('button')].find(x => (x.textContent || '').includes('Launch Evaluation')) as HTMLButtonElement;
}

it('a launch clears every tick', async () => {
    offered = [plugin, otherPlugin];
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await waitForHtml(el => ticked(el) === 2, container);

    const launch = await launchButton(container);
    await act(async () => { launch.click(); });
    await waitForHtml(el => ticked(el) === 0, container);

    expect(ticked(container)).toBe(0);
    const saved = JSON.parse(sessionStorage.getItem('start-eval-selections:proj-1') ?? '{}');
    expect(saved.selectedPlugins).toEqual({});
    container.remove();
});

it('a refused launch keeps the ticks', async () => {
    offered = [plugin, otherPlugin];
    launchAnswer = { status: 400, body: { detail: { message: 'Required project settings are missing or invalid', missing: [], invalid: [], ambiguous: [] } } };
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await waitForHtml(el => ticked(el) === 2, container);

    const launch = await launchButton(container);
    await act(async () => { launch.click(); });
    await waitForHtml(el => (el.textContent || '').includes('Go to Project Settings'), container);

    expect(ticked(container)).toBe(2);
    container.remove();
});

it('coming back to the page after a launch keeps every test unticked', async () => {
    offered = [plugin, otherPlugin];
    const first = document.createElement('div');
    document.body.appendChild(first);
    const root = mountPage(first);
    await waitForHtml(el => ticked(el) === 2, first);
    const launch = await launchButton(first);
    await act(async () => { launch.click(); });
    await waitForHtml(el => ticked(el) === 0, first);
    await act(async () => { root.unmount(); });
    first.remove();

    // the same tab, the same last-run template: the saved state (empty) is respected
    const second = document.createElement('div');
    document.body.appendChild(second);
    mountPage(second);
    await waitForHtml(el => (el.textContent || '').includes('Demo'), second);
    await act(async () => { await new Promise(r => setTimeout(r, 600)); });

    expect(ticked(second)).toBe(0);
    second.remove();
});
