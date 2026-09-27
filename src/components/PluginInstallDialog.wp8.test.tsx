// @vitest-environment jsdom
// WP8 (pipeline 2026-09-23, 03-specs.md): one-click install into the project
// the catalogue was opened from. Tests first: S8.1 (webapp side), S8.2, S8.5.
import { it, expect, vi, beforeEach, afterEach, describe } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
    default: Object.assign(vi.fn(), { error: toastError, success: toastSuccess }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PID = '1e722ea2-4ce3-47fa-81bf-11a6b53ad679';
const PKG = 'aisc-plugin-example';
const VER = '0.1.2';
const SLUG = 'example';
const ENABLE = `web+aiscplugin://enable?package=${PKG}&version=${VER}&slug=${SLUG}`;

type Call = { url: string; method: string; body?: string };
let calls: Call[] = [];
let listResult: { pid: string; name: string }[] = [];
let installedPlugins: { package_name: string; version: string }[] = [];
let installStatus = 200;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function json(body: unknown, status = 200): Response {
    return { ok: status < 400, status, json: async () => body } as Response;
}

beforeEach(() => {
    calls = [];
    listResult = [{ pid: 'eng-1', name: 'MCAS workspace' }];
    installedPlugins = [];
    installStatus = 200;
    toastError.mockClear();
    toastSuccess.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('aisc_platform_project', PID);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        calls.push({ url, method, body: init?.body as string | undefined });
        if (method === 'POST' && url.includes(`/projects/for-platform/${PID}`)) {
            return json({ pid: 'eng-new', name: 'MCAS workspace' }, 201);
        }
        if (method === 'POST' && url.endsWith('/plugins')) {
            return json(installStatus === 403 ? { detail: 'Forbidden' } : { ok: true }, installStatus);
        }
        if (url.includes('/projects?platform_project_id=')) return json(listResult);
        const m = url.match(/\/projects\/(eng-[a-z0-9]+)$/);
        if (m) return json({ pid: m[1], name: 'MCAS workspace', plugins: installedPlugins });
        return json({});
    }) as unknown as typeof fetch;
    // The catalogue opened /receiver with one install.
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

const combobox = () => document.querySelector('[role="combobox"]');
const buttonNamed = (re: RegExp) =>
    Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent ?? '')) as
        | HTMLButtonElement
        | undefined;

describe('WP8 PluginInstallDialog', () => {
    it('S8.1 loads the workspaces of the catalogue project (already built)', async () => {
        await mount();
        expect(calls.some((c) => c.url.includes(`/projects?platform_project_id=${PID}`))).toBe(true);
    });

    it('S8.1 preselects the one workspace of the project', async () => {
        await mount();
        expect(combobox()?.textContent).toContain('MCAS workspace');
        expect(buttonNamed(/enable plugin|install/i)?.disabled).toBe(false);
    });

    it('S8.1 with no workspace yet, asks for the project row and preselects it', async () => {
        listResult = [];
        await mount();
        expect(
            calls.some((c) => c.method === 'POST' && c.url.includes(`/projects/for-platform/${PID}`)),
        ).toBe(true);
        expect(combobox()?.textContent).toContain('MCAS workspace');
    });

    it('S8.1 one Install click posts the plugin for that workspace with the catalogue slug', async () => {
        await mount();
        const btn = buttonNamed(/enable plugin|install/i);
        await act(async () => btn?.click());
        await flush();
        const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/plugins'));
        expect(post).toBeDefined();
        expect(JSON.parse(post!.body!)).toMatchObject({
            package_name: PKG,
            version: VER,
            project_uuid: 'eng-1',
            catalogue_slug: SLUG,
        });
    });

    it('S8.2 says "Already installed in <name>" and offers "Open plugins" when the same version is there', async () => {
        installedPlugins = [{ package_name: PKG, version: VER }];
        await mount();
        expect(calls.some((c) => c.method === 'GET' && /\/projects\/eng-1$/.test(c.url))).toBe(true);
        expect(document.body.textContent).toContain('Already installed in MCAS workspace');
        expect(buttonNamed(/open plugins/i)).toBeDefined();
    });

    it('S8.2 a different version is not "already installed"', async () => {
        installedPlugins = [{ package_name: PKG, version: '0.0.9' }];
        await mount();
        expect(combobox()?.textContent).toContain('MCAS workspace');
        expect(document.body.textContent).not.toContain('Already installed');
    });

    it("S8.5 the engine's 403 reads 'Installing a test takes the admin role'", async () => {
        installStatus = 403;
        await mount();
        await act(async () => buttonNamed(/enable plugin|install/i)?.click());
        await flush();
        expect(toastError).toHaveBeenCalled();
        expect(String(toastError.mock.calls[0][0])).toContain('Installing a test takes the admin role');
    });
});

describe('WP8 PluginInstallContext', () => {
    it('S8.1 keeps the ?project= of /receiver before stripping the URL', async () => {
        sessionStorage.clear();
        window.history.replaceState(
            null,
            '',
            `/receiver?project=${PID}&uri=${encodeURIComponent(ENABLE)}`,
        );
        await import('../pluginCatalogue/PluginInstallContext');
        expect(window.location.search).toBe('');
        expect(sessionStorage.getItem('aisc_platform_project')).toBe(PID);
    });
});
