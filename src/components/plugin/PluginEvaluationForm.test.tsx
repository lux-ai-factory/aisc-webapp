// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin } from '../../models/models';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

function createContainer() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
}

const qc = () => new QueryClient({
    defaultOptions: { queries: { retry: false } },
});

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

it('prefills selection dropdowns from the last-used evaluation template on activation', async () => {
    const container = createContainer();
    const onSelectionChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <QueryClientProvider client={qc()}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid="proj-1" />
                    <PluginEvaluationForm
                        plugin={plugin}
                        isConfigured
                        isActive
                        selections={[]}
                        onToggle={() => {}}
                        onSelectionChange={onSelectionChange}
                    />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });

    // Allow the react-query fetch + effect to settle.
    await act(async () => {
        await new Promise(r => setTimeout(r, 400));
    });

    const datasetCall = onSelectionChange.mock.calls.find(
        c => c[1] === 'dataset'
    );
    const modelCall = onSelectionChange.mock.calls.find(
        c => c[1] === 'model'
    );

    expect(onSelectionChange).toHaveBeenCalled();
    expect(datasetCall?.[0]).toMatchObject({ pid: 'comp-dataset', name: 'dataset' });
    expect(modelCall?.[0]).toMatchObject({ pid: 'comp-model', name: 'model' });

    container.remove();
});
