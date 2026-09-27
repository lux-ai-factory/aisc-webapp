// @vitest-environment jsdom
// I7.4 (isolation 2026-09-25): the plugin install dialog sends X-AISC-Project
// on every call it makes (workspace list, the project's own row, the project
// detail and the install POST). I7.5 is decided by the backend (the body's
// project_uuid must be the engine project of the header's database); the SPA's
// part is sending the header. Same fixture shape as PluginInstallDialog.wp8.test.tsx.
import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-hot-toast', () => ({
    default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PID = '1e722ea2-4ce3-47fa-81bf-11a6b53ad679';
const ENABLE = 'web+aiscplugin://enable?package=aisc-plugin-example&version=0.1.2&slug=example';

type Call = { url: string; method: string; project: string | null };
let calls: Call[] = [];
let listResult: { pid: string; name: string }[] = [];
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function json(body: unknown, status = 200): Response {
    return { ok: status < 400, status, json: async () => body } as Response;
}

function projectHeader(init?: RequestInit): string | null {
    const h = init?.headers;
    if (!h) return null;
    if (h instanceof Headers) return h.get('X-AISC-Project');
    if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === 'x-aisc-project')?.[1] ?? null;
    const rec = h as Record<string, string>;
    const key = Object.keys(rec).find((k) => k.toLowerCase() === 'x-aisc-project');
    return key ? rec[key] : null;
}

beforeEach(() => {
    calls = [];
    listResult = [{ pid: 'eng-1', name: 'MCAS workspace' }];
    sessionStorage.clear();
    sessionStorage.setItem('aisc_platform_project', PID);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        calls.push({ url, method, project: projectHeader(init) });
        if (method === 'POST' && url.includes(`/projects/for-platform/${PID}`)) {
            return json({ pid: 'eng-new', name: 'MCAS workspace' }, 201);
        }
        if (method === 'POST' && url.endsWith('/plugins')) return json({ ok: true });
        if (url.includes('/projects?platform_project_id=')) return json(listResult);
        const m = url.match(/\/projects\/(eng-[a-z0-9]+)$/);
        if (m) return json({ pid: m[1], name: 'MCAS workspace', plugins: [] });
        return json({});
    }) as unknown as typeof fetch;
    window.history.replaceState(null, '', `/receiver?uri=${encodeURIComponent(ENABLE)}`);
    vi.resetModules();
});

afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    document.body.innerHTML = '';
});

async function flush() {
    for (let i = 0; i < 10; i++) {
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
    }
}

async function mount() {
    const { PluginInstallProvider } = await import('../pluginCatalogue/PluginInstallContext');
    const { default: PluginInstallDialog } = await import('./PluginInstallDialog');
    const { ProjectProvider } = await import('../context/ProjectContext');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient();
    await act(async () => {
        root!.render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <ProjectProvider>
                        <PluginInstallProvider>
                            <PluginInstallDialog />
                        </PluginInstallProvider>
                    </ProjectProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    await flush();
}

const install = () =>
    Array.from(document.querySelectorAll('button')).find((b) => /enable plugin|install/i.test(b.textContent ?? '')) as
        | HTMLButtonElement
        | undefined;

const unlabelled = () => calls.filter((c) => c.project !== PID).map((c) => `${c.method} ${c.url}`);

describe('I7.4 PluginInstallDialog sends the project header', () => {
    it('I7.4 listing the workspaces and installing both send X-AISC-Project', async () => {
        await mount();
        await act(async () => install()?.click());
        await flush();
        expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/plugins'))).toBe(true);
        expect(unlabelled(), 'I7.4: dialog calls without X-AISC-Project').toEqual([]);
    });

    it("I7.4 asking for the project's own row sends X-AISC-Project", async () => {
        listResult = [];
        await mount();
        expect(calls.some((c) => c.method === 'POST' && c.url.includes('/projects/for-platform/'))).toBe(true);
        expect(unlabelled(), 'I7.4: dialog calls without X-AISC-Project').toEqual([]);
    });
});
