// @vitest-environment jsdom
// A retired dataset (deleted while evaluations used it) is neither offered nor taken back from the last run.
import { it, expect, vi, beforeEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin } from '../../models/models';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const plugin: Plugin = {
    pid: 'plg-1', name: 'DemoPlugin', config: {}, display_icon: 'extension', package_name: 'demo-pkg',
    version: '0.1.0', display_name: 'Demo', plugin_pid: 'plg-1', enabled: true, status: 'ok',
};

beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const answer = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
        if (url.includes('/display_icon')) return answer('extension');
        if (url.includes('/input_definitions')) {
            return answer([{ name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true }]);
        }
        if (url.includes('/config')) return answer(url.includes('/configs') ? [] : null);
        if (url.includes('/evaluation-inputs-template')) {
            return answer({ DemoPlugin: { dataset: { component_pid: 'old', value: {} } } });
        }
        if (url.includes('/projects/')) {
            return answer({
                pid: 'proj-1', name: 'P', plugins: [plugin],
                components: [
                    { pid: 'old', name: 'Old prompts', component_type: 'dataset', retired_at: '2026-11-12T16:35:00Z' },
                    { pid: 'new', name: 'New prompts', component_type: 'dataset', retired_at: null },
                ],
            });
        }
        return answer([]);
    });
});

it('the last run\'s retired dataset is not chosen again', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onSelectionChange = vi.fn();
    await act(async () => {
        createRoot(container).render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid="proj-1" />
                    <PluginEvaluationForm plugin={plugin} isConfigured isActive selections={[]}
                                          onToggle={() => {}} onSelectionChange={onSelectionChange} />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    expect(onSelectionChange.mock.calls.find(c => c[0]?.pid === 'old')).toBeUndefined();
    container.remove();
});
