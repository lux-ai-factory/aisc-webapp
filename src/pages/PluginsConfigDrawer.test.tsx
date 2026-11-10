// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SideDrawer from '../components/SideDrawer';
import PluginConfig from './PluginsConfig';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
        fileUploadingPids: new Set<string>(),
        addFileUploadingPid: () => {},
        removeFileUploadingPid: () => {},
    }),
}));

// @rjsf/react-bootstrap is unresolvable under vitest (pre-existing packaging
// issue, untouched by W5); stub the heavy form/history children so this test
// covers the drawer-embed wiring, not the form library.
vi.mock('../components/plugin/PluginConfigForm', () => ({
    default: ({ pluginPID }: { pluginPID: string }) => <div>config form for {pluginPID}</div>,
}));
vi.mock('../components/plugin/ConfigHistory', () => ({
    default: () => <div />,
}));

const project = {
    pid: 'p1',
    name: 'demo',
    plugins: [{ pid: 'plg1', name: 'demo-plugin', display_name: 'Demo', enabled: true, config: {} }],
    components: [],
};

const configState = {
    plugin_config_id: 'cfg1',
    description: 'Demo plugin config',
    formSchema: { type: 'object', properties: {} },
    uiSchema: {},
    config: {},
    project_config_definitions: [],
    project_configs: [],
    project_config_selections: [],
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => project });
            }
            if (url.includes('/plugins/plg1/config/state')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => configState });
            }
            if (url.includes('/plugins/plg1/feature_flags')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
            }
            throw new Error(`unexpected fetch: ${url}`);
        }),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

async function renderDrawer() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
        root.render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <SideDrawer open onClose={() => {}} title="Configure — demo-plugin">
                        <PluginConfig pluginName="demo-plugin" />
                    </SideDrawer>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    const start = Date.now();
    while (!(document.body.textContent ?? '').includes('Demo') && Date.now() - start < 4000) {
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });
    }
}

describe('PluginConfig in SideDrawer (W5)', () => {
    it('renders the config form for the named plugin inside the drawer', async () => {
        await renderDrawer();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Configure — demo-plugin');
        expect(text).toContain('Demo');
        expect(text).toContain('Configuration');
    });
});
