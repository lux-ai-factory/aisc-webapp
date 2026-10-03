// @vitest-environment jsdom
// Step 4's test tiles (2026-10-03): E links to /projects/<name>/plugins/evaluation?plugin=<plugin name>, and that
// test's card opens. Sean's page (PluginStartEvaluation.tsx) stays as on his master, so the wrapper opens the card
// the way a click does; this renders his real page through it.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import OpenPluginFromUrl from './OpenPluginFromUrl';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const plugin = (name: string, display: string, enabled = true): Plugin => ({
    pid: `pid-${name}`, name, config: {}, display_icon: 'extension', package_name: `pkg-${name}`, version: '1.0',
    display_name: display, plugin_pid: `pid-${name}`, enabled, status: 'ok',
});
const PLUGINS = [plugin('OffPlugin', 'Off', false), plugin('FirstPlugin', 'First'), plugin('SecondPlugin', 'Second')];

beforeEach(() => {
    sessionStorage.clear();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'extension' } as Response;
        if (url.includes('/input_definitions')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) return { ok: true, json: async () => ({}) } as Response;
        if (url.includes('/projects/')) {
            return { ok: true, json: async () => ({ pid: 'proj-1', name: 'P', plugins: PLUGINS, components: [] }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function settle(ms = 1500) {
    const end = Date.now() + ms;
    while (Date.now() < end) await act(async () => { await new Promise(r => setTimeout(r, 100)); });
}

async function mount(entry: string) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={[entry]}>
                    <ProjectProvider>
                        <ProjectUUIDSetter uuid="proj-1" />
                        <OpenPluginFromUrl><PluginStartEvaluation /></OpenPluginFromUrl>
                    </ProjectProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    await settle();
    const cards = Array.from(container.querySelectorAll('[data-plugin-card]')) as HTMLElement[];
    const active = cards.map(c => c.classList.contains('plugin-eval-card--active'));
    root.unmount();
    container.remove();
    return { cards, active };
}

it('opens the card the ?plugin= names', async () => {
    const { cards, active } = await mount('/projects/P/plugins/evaluation?plugin=SecondPlugin');
    expect(cards.map(c => c.textContent?.includes('Second') ? 'Second' : 'First')).toEqual(['First', 'Second']);
    expect(active).toEqual([false, true]);
});

it('opens none without ?plugin=', async () => {
    expect((await mount('/projects/P/plugins/evaluation')).active).toEqual([false, false]);
});

it('opens none for a test the page does not list (unknown or disabled)', async () => {
    expect((await mount('/projects/P/plugins/evaluation?plugin=NoSuchPlugin')).active).toEqual([false, false]);
    expect((await mount('/projects/P/plugins/evaluation?plugin=OffPlugin')).active).toEqual([false, false]);
});

it('the execution route goes through the wrapper', () => {
    const app = readFileSync('src/MyApp.tsx', 'utf8');
    expect(app).toMatch(/path: '\/projects\/:project_name\/plugins\/evaluation', element: <ProjectContextWrapper><OpenPluginFromUrl><PluginStartEvaluation \/><\/OpenPluginFromUrl><\/ProjectContextWrapper>/);
});
