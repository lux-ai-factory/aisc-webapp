// @vitest-environment jsdom
// A project may hold several versions of a test's package, one on. The version that is off shows no card and
// does not count as a second plugin of that name: the last-used values are restored for the version on.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
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

function mijke(pid: string, version: string, enabled: boolean): Plugin {
    return {
        pid, name: 'LangBiteEvaluationPlugin', config: {}, display_icon: 'extension',
        package_name: 'aisc-plugin-langbite-mijke', version, display_name: 'LangBiTe (Mijke)', plugin_pid: pid,
        enabled, status: 'ok',
    };
}

const OLD = mijke('plg-old', '0.2.8', false);
const NEW = mijke('plg-new', '0.3.0', true);

beforeEach(() => {
    sessionStorage.clear();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'extension' } as Response;
        if (url.includes('/input_definitions')) {
            return { ok: true, json: async () => [
                { name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true },
            ] } as Response;
        }
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) {
            // the engine's last-used values are keyed by plugin name alone
            return { ok: true, json: async () => ({
                LangBiteEvaluationPlugin: { dataset: { component_pid: 'comp-dataset', value: {} } },
            }) } as Response;
        }
        if (url.includes('/projects/')) {
            return { ok: true, json: async () => ({
                pid: 'proj-1', name: 'P', plugins: [OLD, NEW],
                components: [{ pid: 'comp-dataset', name: 'Dataset A', component_type: 'dataset' }],
            }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function settle(rounds = 8) {
    for (let i = 0; i < rounds; i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    }
}

function mountPage(container: HTMLDivElement) {
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

function cards(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll('[data-plugin-card]')) as HTMLElement[];
}

function picked(card: HTMLElement): boolean {
    return /plugin-eval-card--(active|configured)/.test(card.className);
}

it('restores the last-used values for the version on, past a version that is off', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await settle();
    expect(cards(container)).toHaveLength(1);
    expect(cards(container).map(picked)).toEqual([true]);
    container.remove();
});
