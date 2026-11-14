// @vitest-environment jsdom
// When no connection is offered for a helper role (a judge), the launch form sends the person to where roles are
// set now: Manage > Connectivity, Connections tab, on the launcher.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin } from '../../models/models';
import { rememberPlatformProject } from '../../platform/currentProject';

const PROJECT = '11111111-2222-4333-8444-555555555555';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const plugin: Plugin = {
    pid: 'plg-sr',
    name: 'StrongREJECT (Mijke)',
    config: {},
    display_icon: 'gpp_bad',
    package_name: 'aisc-plugin-strongreject-mijke',
    version: '0.2.0',
    display_name: 'StrongREJECT (Mijke)',
    plugin_pid: 'plg-sr',
    enabled: true,
    status: 'ok',
};

beforeEach(() => {
    sessionStorage.clear();
    rememberPlatformProject('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'gpp_bad' } as Response;
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [{ name: 'helper:judge', label: 'Judge model', input_type: 'helper', required: false }],
            } as Response;
        }
        if (url.includes('/config/state')) return { ok: true, json: async () => ({ plugin_config_id: null }) } as Response;
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) return { ok: true, json: async () => ({}) } as Response;
        // no connection of the project is allowed the judge role
        if (url.includes('/helpers')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/projects/')) {
            return { ok: true, json: async () => ({ pid: PROJECT, name: 'P', plugins: [plugin], components: [] }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

it('sends the person to Connectivity to give a connection the judge role', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        createRoot(container).render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid={PROJECT} />
                    <PluginEvaluationForm
                        plugin={plugin}
                        isConfigured
                        isActive
                        selections={[]}
                        onToggle={() => {}}
                        onSelectionChange={() => {}}
                    />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    for (let i = 0; i < 80 && !(container.textContent || '').includes('Judge model'); i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    }

    const text = container.textContent || '';
    expect(text).toContain('Judge model');
    expect(text, 'no menu entry that the launcher no longer has').not.toContain('Helper models');
    expect(text).toContain('Connectivity');
    const links = [...container.querySelectorAll('a')].map(a => a.getAttribute('href') || '');
    expect(links.some(h => h.includes('/helpers.html')), `no link to the orphan page: ${links}`).toBe(false);
    expect(links.some(h => h.includes('/connectivity.html?project=')), `a link to Connectivity: ${links}`).toBe(true);
    container.remove();
});
