// @vitest-environment jsdom
// A launch the engine refuses says why, once, in the engine's own words: not as a quoted JSON string and not
// as the same generic toast twice.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

const toasts = vi.hoisted(() => ({ error: [] as string[] }));
vi.mock('react-hot-toast', () => {
    const toast = Object.assign(() => undefined, {
        error: (message: unknown) => { toasts.error.push(String(message)); },
        success: () => undefined,
    });
    return { default: toast, toast, Toaster: () => null };
});

const PROJECT = '11111111-2222-4333-8444-555555555555';

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

// what the engine answers to the launch
let refusal: { status: number; body: unknown } = { status: 400, body: {} };

beforeEach(() => {
    sessionStorage.clear();
    toasts.error = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/evaluations/task') && init?.method === 'POST') {
            return { ok: false, status: refusal.status, json: async () => refusal.body } as Response;
        }
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'extension' } as Response;
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [{ name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true }],
            } as Response;
        }
        if (url.includes('/config/state')) return { ok: true, json: async () => ({ plugin_config_id: null }) } as Response;
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) {
            return { ok: true, json: async () => ({ DemoPlugin: { dataset: { component_pid: 'comp-dataset', value: {} } } }) } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: PROJECT,
                    name: 'P',
                    plugins: [plugin],
                    components: [{ pid: 'comp-dataset', name: 'Dataset A', component_type: 'dataset' }],
                }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function settle(_container: HTMLElement, done: () => boolean, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        if (done()) return;
    }
}

/** Mounts the page, waits for the last run's dataset to come back, presses Launch: what the person saw. */
async function launchAndRead(): Promise<{ page: string; toasts: string[] }> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        createRoot(container).render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter>
                    <ProjectProvider>
                        <ProjectUUIDSetter uuid={PROJECT} />
                        <PluginStartEvaluation />
                    </ProjectProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    const launchButton = () => [...container.querySelectorAll('button')]
        .find(b => (b.textContent || '').includes('Launch Evaluation'));
    await settle(container, () => !!launchButton() && !launchButton()!.disabled);
    expect(launchButton()?.disabled, 'Launch is enabled once the last run is restored').toBe(false);
    await act(async () => { launchButton()!.click(); });
    await settle(container, () => toasts.error.length > 0 || !!container.querySelector('[role="alert"]'));
    const seen = { page: container.textContent || '', toasts: [...toasts.error] };
    container.remove();
    return seen;
}

/** How many times `text` reaches the person: in toasts and on the page. */
function timesShown(seen: { page: string; toasts: string[] }, text: string): number {
    return seen.toasts.filter(t => t.includes(text)).length + seen.page.split(text).length - 1;
}

it("shows a refused launch's reason once, in the engine's words and without quotes", async () => {
    const reason = "Plugin StrongREJECT (Mijke) has no current config";
    refusal = { status: 400, body: { detail: reason } };
    const seen = await launchAndRead();

    expect(seen.toasts.some(t => t.startsWith('"')), `no quoted JSON string: ${JSON.stringify(seen.toasts)}`).toBe(false);
    expect(timesShown(seen, reason)).toBe(1);
});

it('names the missing project setting of a refused launch, once', async () => {
    refusal = {
        status: 400,
        body: { detail: "Required project settings are missing or invalid - Missing: 'HF_TOKEN' (not set)" },
    };
    const seen = await launchAndRead();

    expect(seen.toasts.some(t => t.startsWith('"')), `no quoted JSON string: ${JSON.stringify(seen.toasts)}`).toBe(false);
    expect(timesShown(seen, 'HF_TOKEN')).toBe(1);
});

it('shows each problem of a request the engine could not read, once', async () => {
    refusal = {
        status: 422,
        body: { detail: [{ loc: ['body', 'data', 'plugins_to_run', 0, 'inputs', 0, 'pid'], msg: 'Input should be a valid UUID' }] },
    };
    const seen = await launchAndRead();

    expect(timesShown(seen, 'Input should be a valid UUID')).toBe(1);
    expect(seen.toasts.filter(t => t === 'Failed to launch evaluation').length, 'no doubled generic toast').toBeLessThanOrEqual(0);
});
