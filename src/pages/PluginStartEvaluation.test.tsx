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

beforeEach(() => {
    sessionStorage.clear();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
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
                }),
            } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'proj-1',
                    name: 'P',
                    plugins: [plugin],
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
    sessionStorage.setItem('start-eval-state', JSON.stringify({
        selectedPlugins: {
            DemoPlugin: [
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
