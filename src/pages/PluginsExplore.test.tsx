// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Plugins from './Plugins';

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
// issue); the Plugins page pulls it transitively via PluginsConfig.
vi.mock('../components/plugin/PluginConfigForm', () => ({
    default: () => <div />,
}));
vi.mock('../components/plugin/ConfigHistory', () => ({
    default: () => <div />,
}));

const catalogue = {
    plugins: [
        { package_name: 'strongreject', version: '1.0', source: 'registry', tags: ['red-team'] },
    ],
    controls: [],
};

let container: HTMLElement;
let root: Root;
let calls: [string, RequestInit?][];

function mockFetch() {
    calls = [];
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            calls.push([url, init]);
            if (url.endsWith('/plugins') && (init === undefined || init.method === undefined)) {
                return Promise.resolve({ ok: true, status: 200, json: async () => [] });
            }
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ pid: 'p1', name: 'demo', plugins: [] }),
                });
            }
            if (url.endsWith('/catalogue')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => catalogue });
            }
            if (url.includes('/catalogue/installs')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ kind: 'plugin', status: 'installed' }),
                });
            }
            throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
        }),
    );
}

beforeEach(() => {
    mockFetch();
    sessionStorage.clear();
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

async function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
        root.render(
            <QueryClientProvider client={client}>
                <Plugins />
            </QueryClientProvider>,
        );
    });
    const start = Date.now();
    while (
        !Array.from(document.body.querySelectorAll('button')).some(
            (b) => b.textContent?.includes('Explore catalogue'),
        ) &&
        Date.now() - start < 4000
    ) {
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });
    }
}

describe('Plugins catalogue explore', () => {
    it('opens the explore drawer and installs into the project', async () => {
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        );
        expect(explore).toBeTruthy();
        await act(async () => {
            explore!.click();
        });
        await act(async () => {});
        expect(document.body.textContent ?? '').toContain('strongreject');
        const card = Array.from(document.body.querySelectorAll('.MuiCard-root')).find((el) =>
            (el.textContent ?? '').includes('strongreject'),
        );
        expect(card).toBeTruthy();
        await act(async () => {
            (card as HTMLElement).click();
        });
        await act(async () => {});
        const post = calls.find(
            ([url, init]) => url.includes('/catalogue/installs') && init?.method === 'POST',
        );
        expect(post).toBeTruthy();
        expect(post![0]).toContain('catalogue_id=strongreject');
        expect(post![0]).toContain('kind=plugin');
    });

    it('re-imports the plugin package from the update icon on an installed card', async () => {
        const refreshBodies: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if (url.endsWith('/projects/p1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'p1',
                            name: 'demo',
                            plugins: [
                                {
                                    pid: 'plg1',
                                    name: 'demo-plugin',
                                    display_name: 'Demo',
                                    enabled: true,
                                    package_name: 'strongreject',
                                    version: '1.0',
                                    config: {},
                                },
                            ],
                        }),
                    });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => catalogue });
                }
                if (url.includes('/display_icon')) {
                    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
                }
                if (url.endsWith('/plugins/refresh') && init?.method === 'POST') {
                    refreshBodies.push(JSON.parse(String(init.body)));
                    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        const update = document.body.querySelector<HTMLButtonElement>('button[aria-label="Update Demo"]');
        expect(update).toBeTruthy();
        await act(async () => {
            update!.click();
        });
        for (let i = 0; i < 30 && refreshBodies.length === 0; i++) {
            await act(async () => {
                await new Promise((r) => setTimeout(r, 10));
            });
        }
        expect(refreshBodies.length).toBe(1);
        expect(refreshBodies[0]).toMatchObject({
            package_name: 'strongreject',
            version: '1.0',
            project_uuid: 'p1',
        });
    });

    it('unselects only the clicked plugin in the catalogue, not its package siblings', async () => {
        const pkgCatalogue = {
            plugins: [
                { package_name: 'strongreject', plugin_name: 'plugin-a', display_name: 'Plugin A', version: '1.0', source: 'registry', tags: ['red-team'] },
                { package_name: 'strongreject', plugin_name: 'plugin-b', display_name: 'Plugin B', version: '1.0', source: 'registry', tags: ['red-team'] },
            ],
            controls: [],
        };
        const disableCalls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if (url.endsWith('/projects/p1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'p1',
                            name: 'demo',
                            plugins: [
                                { pid: 'plgA', name: 'plugin-a', display_name: 'Plugin A', enabled: true, package_name: 'strongreject', version: '1.0', config: {} },
                                { pid: 'plgB', name: 'plugin-b', display_name: 'Plugin B', enabled: true, package_name: 'strongreject', version: '1.0', config: {} },
                            ],
                        }),
                    });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({ ok: true, status: 200, json: async () => pkgCatalogue });
                }
                if (url.includes('/display_icon')) {
                    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
                }
                if (url.includes('/enabled') && init?.method === 'PATCH') {
                    const target = url.match(/\/plugins\/([^/]+)\/enabled/)?.[1] ?? url;
                    disableCalls.push(target);
                    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        );
        await act(async () => {
            explore!.click();
        });
        await act(async () => {});
        const cardA = Array.from(document.body.querySelectorAll('.MuiCard-root')).find((el) => {
            const t = el.textContent ?? '';
            return t.includes('Plugin A') && t.includes('installed');
        });
        expect(cardA).toBeTruthy();
        await act(async () => {
            (cardA as HTMLElement).click();
        });
        await act(async () => {});
        expect(disableCalls).toEqual(['plgA']);
    });

    it('stops highlighting a plugin in the catalogue after it is deleted on the page', async () => {
        let installed = false; // server-side project state, flipped by install/uninstall
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                if (url.endsWith('/projects/p1')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            pid: 'p1',
                            name: 'demo',
                            plugins: installed
                                ? [{ pid: 'plgA', name: 'plugin-a', display_name: 'Plugin A', enabled: true, package_name: 'strongreject', version: '1.0', config: {} }]
                                : [],
                        }),
                    });
                }
                if (url.endsWith('/catalogue')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            plugins: [{ package_name: 'strongreject', plugin_name: 'plugin-a', display_name: 'Plugin A', version: '1.0', source: 'registry', tags: [] }],
                            controls: [],
                        }),
                    });
                }
                if (url.includes('/display_icon')) {
                    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
                }
                if (url.includes('/catalogue/installs')) {
                    installed = true;
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ kind: 'plugin', status: 'installed' }),
                    });
                }
                if (url.includes('/enabled') && init?.method === 'PATCH') {
                    installed = false;
                    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();

        const openExplore = async () => {
            const explore = Array.from(document.body.querySelectorAll('button')).find(
                (b) => b.textContent?.includes('Explore catalogue'),
            );
            await act(async () => { explore!.click(); });
            await act(async () => {});
        };
        const closeExplore = async () => {
            const close = Array.from(document.body.querySelectorAll('button')).find(
                (b) => b.textContent?.trim() === 'Close',
            );
            await act(async () => { close!.click(); });
            await act(async () => {});
        };

        // The dialog card is portal-rendered last, after the page's own card.
        const cardContaining = (text: string) => {
            const cards = Array.from(document.body.querySelectorAll('.MuiCard-root')).filter((el) =>
                (el.textContent ?? '').includes(text),
            );
            return cards[cards.length - 1];
        };

        // Session 1: install from the catalogue card, which labels it installed.
        await openExplore();
        const card = cardContaining('Plugin A');
        expect(card).toBeTruthy();
        expect(card!.textContent ?? '').not.toContain('installed');
        await act(async () => { (card as HTMLElement).click(); });
        await act(async () => {});
        expect(card!.textContent ?? '').toContain('installed');
        await closeExplore();

        // The project now has the plugin, so its page card + bin exist.
        const remove = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.getAttribute('aria-label') === 'Remove Plugin A',
        );
        expect(remove).toBeTruthy();
        await act(async () => { remove!.click(); });
        const start = Date.now();
        while (
            !(document.body.textContent ?? '').includes('No plugins enabled') &&
            Date.now() - start < 4000
        ) {
            await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
        }

        // Reopening the catalogue must not keep the stale "installed" highlight.
        await openExplore();
        const marked = cardContaining('Plugin A');
        expect(marked).toBeDefined();
        expect(marked!.textContent ?? '').not.toContain('installed');
    });
});
