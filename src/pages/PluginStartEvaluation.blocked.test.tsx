// @vitest-environment jsdom
// The launch page asks the engine which tests cannot be launched yet (GET /plugins/launch-blockers): those
// cards are greyed out and never ticked, whether by a click, by the selections saved in this tab or by the
// last run's inputs, and Launch never sends them.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

const REASON = 'No target of the AI card has a connection yet: set one under Manage, Components and connections';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const langbite: Plugin = {
    pid: 'plg-1', name: 'LangBiTe', config: {}, display_icon: 'science', package_name: 'langbite-pkg',
    version: '0.3.8', display_name: 'LangBiTe', plugin_pid: 'plg-1', enabled: true, status: 'ok',
};
const reader: Plugin = { ...langbite, pid: 'plg-2', name: 'Reader', package_name: 'reader-pkg', display_name: 'Reader', plugin_pid: 'plg-2' };

let blockers: Record<string, string>;
let blockersAnswer: number;

beforeEach(() => {
    sessionStorage.clear();
    blockers = { 'plg-1': REASON };
    blockersAnswer = 200;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/plugins/launch-blockers')) {
            return { ok: blockersAnswer < 400, status: blockersAnswer, json: async () => blockers } as Response;
        }
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'science' } as Response;
        if (url.includes('/input_definitions')) {
            return { ok: true, json: async () => [{ name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true }] } as Response;
        }
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) {
            // the last run used both tests: on a first visit both would be ticked again
            return {
                ok: true,
                json: async () => ({
                    LangBiTe: { dataset: { component_pid: 'comp-dataset', value: {} } },
                    Reader: { dataset: { component_pid: 'comp-dataset', value: {} } },
                }),
            } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'proj-1', name: 'P', plugins: [langbite, reader],
                    components: [{ pid: 'comp-dataset', name: 'Dataset A', component_type: 'dataset' }],
                }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function waitFor(query: () => boolean, container: HTMLElement, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        if (query()) return;
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

const cardOf = (container: HTMLElement, name: string) =>
    [...container.querySelectorAll('[data-plugin-card]')].find(c => c.textContent?.includes(name)) as HTMLElement;
const launchButton = (container: HTMLElement) =>
    [...container.querySelectorAll('button')].find(b => /Launch/.test(b.textContent ?? '')) as HTMLButtonElement;
const savedTicks = () => Object.keys(JSON.parse(sessionStorage.getItem('start-eval-selections:proj-1') ?? '{}').selectedPlugins ?? {});

it('greys out the blocked test with its reason and leaves the other one as it was', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = mountPage(container);
    await waitFor(() => !!cardOf(container, 'LangBiTe')?.className.includes('plugin-eval-card--blocked'), container);
    expect(cardOf(container, 'LangBiTe').textContent).toContain(REASON);
    expect(cardOf(container, 'Reader').className).not.toContain('plugin-eval-card--blocked');
    act(() => root.unmount());
    container.remove();
});

it("does not tick the blocked test again from the last run's inputs, and ticks the other", async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = mountPage(container);
    await waitFor(() => savedTicks().includes('reader-pkg/Reader'), container);
    await act(async () => { await new Promise(r => setTimeout(r, 200)); });
    expect(savedTicks()).toEqual(['reader-pkg/Reader']);
    act(() => root.unmount());
    container.remove();
});

it('unticks a blocked test this tab had ticked, so Launch cannot send it', async () => {
    sessionStorage.setItem('start-eval-selections:proj-1', JSON.stringify({
        selectedPlugins: { 'langbite-pkg/LangBiTe': [{ pid: 'comp-dataset', name: 'dataset', input_type: 'dataset', value: {} }] },
        selectionCache: {},
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = mountPage(container);
    await waitFor(() => !!cardOf(container, 'LangBiTe')?.className.includes('plugin-eval-card--blocked'), container);
    await waitFor(() => savedTicks().length === 0, container);
    expect(launchButton(container).disabled).toBe(true);
    act(() => root.unmount());
    container.remove();
});

it('blocks nothing when the engine does not answer (a standalone engine has no such route)', async () => {
    blockersAnswer = 404;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = mountPage(container);
    await waitFor(() => savedTicks().length === 2, container);
    expect(cardOf(container, 'LangBiTe').className).not.toContain('plugin-eval-card--blocked');
    act(() => root.unmount());
    container.remove();
});
