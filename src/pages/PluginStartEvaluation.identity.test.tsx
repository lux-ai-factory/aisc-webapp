// @vitest-environment jsdom
// Two packages may ship a plugin of the same name (a copy of a test: LangBiTe and LangBiTe (Mijke), both
// LangBiteEvaluationPlugin). Each card is its own: selecting one never selects the other, and Launch names
// the package of each plugin it runs.
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

function langbite(pid: string, packageName: string, displayName: string): Plugin {
    return {
        pid, name: 'LangBiteEvaluationPlugin', config: {}, display_icon: 'extension', package_name: packageName,
        version: '0.1.0', display_name: displayName, plugin_pid: pid, enabled: true, status: 'ok',
    };
}

const PLAIN = langbite('plg-plain', 'aisc-plugin-langbite', 'LangBiTe');
const MIJKE = langbite('plg-mijke', 'aisc-plugin-langbite-mijke', 'LangBiTe (Mijke)');
let launched: unknown = null;

beforeEach(() => {
    sessionStorage.clear();
    launched = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/evaluations/task')) {
            launched = JSON.parse(String(init?.body));
            return { ok: true, json: async () => ({ pid: 'ev-1' }) } as Response;
        }
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
                pid: 'proj-1', name: 'P', plugins: [PLAIN, MIJKE],
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

function cardOf(container: HTMLElement, displayName: string): HTMLElement {
    const card = cards(container).find(c => (c.textContent || '').includes(displayName)
        && !(displayName === 'LangBiTe' && (c.textContent || '').includes('(Mijke)')));
    if (!card) throw new Error(`no card ${displayName}`);
    return card;
}

function picked(card: HTMLElement): boolean {
    return /plugin-eval-card--(active|configured)/.test(card.className);
}

it('a name two plugins share restores neither from the last-used values', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await settle();
    expect(cards(container)).toHaveLength(2);
    expect(cards(container).map(picked)).toEqual([false, false]);
    container.remove();
});

it('selecting one of two plugins of the same name selects only that one', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await settle();
    await act(async () => { cardOf(container, 'LangBiTe (Mijke)').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await settle(3);
    expect(picked(cardOf(container, 'LangBiTe (Mijke)'))).toBe(true);
    expect(picked(cardOf(container, 'LangBiTe'))).toBe(false);
    container.remove();
});

it('Launch names the package of the plugin it runs', async () => {
    sessionStorage.setItem('start-eval-selections:proj-1', JSON.stringify({
        selectedPlugins: {
            'aisc-plugin-langbite-mijke/LangBiteEvaluationPlugin': [
                { pid: 'comp-dataset', name: 'dataset', input_type: 'dataset', value: {} },
            ],
        },
        selectionCache: {},
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await settle();
    const launch = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('Launch'));
    await act(async () => { launch!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await settle(3);
    expect(launched).toEqual({
        project_pid: 'proj-1',
        plugins_to_run: [{
            name: 'LangBiteEvaluationPlugin', package_name: 'aisc-plugin-langbite-mijke',
            inputs: [{ pid: 'comp-dataset', name: 'dataset', input_type: 'dataset', value: {} }],
        }],
    });
    container.remove();
});

it('selections saved by name alone, before plugins were told apart, are not restored', async () => {
    sessionStorage.setItem('start-eval-state:proj-1', JSON.stringify({
        selectedPlugins: { LangBiteEvaluationPlugin: [{ pid: 'comp-dataset', name: 'dataset', input_type: 'dataset', value: {} }] },
        selectionCache: {},
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountPage(container);
    await settle();
    expect(cards(container).map(picked)).toEqual([false, false]);
    container.remove();
});
