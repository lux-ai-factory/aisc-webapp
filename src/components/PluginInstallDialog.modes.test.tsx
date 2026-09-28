// @vitest-environment jsdom
// Deployment modes 2026-09-27, Task 8: the catalogue install dialog in both modes.
// The catalogue opens <engine>/receiver?uri=web+aiscplugin://enable?... in a new
// tab. Standalone: Sean's dialog, every engine project to pick from. Configurator:
// the link's ?project=, else the project last opened in this browser, named; the
// caller's platform projects (GET /platform/api/projects) to change it.
//
// The assertions of the brief are kept; the web app has no testing library, so
// render/screen/waitFor are the small helpers of ../pluginCatalogue/testing.
// Ported from definitive (PluginInstallDialog.i7_4 / .wp8) where they still hold:
// every call names the project (I7.4), one Install posts the engine project with
// the catalogue slug (S8.1), the 403 text (S8.5), /receiver keeps ?project= (S8.1).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mode = vi.hoisted(() => ({ configurator: true }));
vi.mock('../deployment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../deployment')>()),
  isConfigurator: () => mode.configurator,
}));

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: toastError, success: toastSuccess }),
}));

import PluginInstallDialog from './PluginInstallDialog';
import { installProjectHeader } from '../api/installProjectHeader';
import {
  buttonNamed,
  chooseOption,
  cleanup,
  click,
  openSelect,
  pageText,
  renderWithInstall,
  waitFor,
} from '../pluginCatalogue/testing';

const DEMO = { pid: '701ef4b8-057d-4a93-8b30-9b19052c881e', name: 'Demo', slug: 'demo' };
const LOANS = { pid: '5b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3', name: 'Loans', slug: 'loans' };
const DEAD = '00000000-0000-0000-0000-00000000dead';
const ENABLE = 'web+aiscplugin://enable?package=aisc-plugin-langbite&version=0.1.1';

type Call = { url: string; method: string; project: string | null; body?: string };
let calls: Call[] = [];

function headerOf(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : null;
}

/** A fetch that records every call; `route` answers it. */
/** What main.tsx does in the configurator: the start-up wrapper over this test's fetch. It
 *  consults the mode itself, so in standalone it passes every call through unchanged. */
let uninstalls: (() => void)[] = [];
function stubFetchGlobal(fn: unknown) {
  vi.stubGlobal('fetch', fn);
  uninstalls.push(installProjectHeader(globalThis));
}

function stubFetch(route: (url: string, method: string) => Response) {
  stubFetchGlobal(
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method, project: headerOf(init, 'X-AISC-Project'), body: init?.body as string | undefined });
      return route(url, method);
    }),
  );
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The configurator's backend: the caller is in `mine`; for-platform answers `forPlatform`. */
function configuratorBackend(mine = [DEMO], forPlatform = 201, install = 200) {
  stubFetch((url, method) => {
    if (url.endsWith('/platform/api/projects')) return json(mine);
    const m = url.match(/\/projects\/for-platform\/([^/?]+)$/);
    if (method === 'POST' && m) {
      if (forPlatform === 404) return json({ detail: 'Not Found' }, 404);
      if (forPlatform === 403) return json({ detail: 'Forbidden' }, 403);
      const p = [DEMO, LOANS].find((x) => x.pid === m[1]);
      return json({ pid: `engine-${p?.slug ?? 'x'}`, name: p?.name ?? 'x' }, forPlatform);
    }
    if (method === 'POST' && url.endsWith('/plugins')) return json({ ok: install < 400 }, install);
    return json([]);
  });
}

beforeEach(() => {
  mode.configurator = true;
  calls = [];
  toastError.mockClear();
  toastSuccess.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  stubFetchGlobal(
    vi.fn(async (url: string) => {
      if (url.endsWith('/platform/api/projects')) return new Response(JSON.stringify([DEMO]));
      if (url.includes('/projects/for-platform/')) return new Response(JSON.stringify({ pid: 'engine-pid', name: 'Demo' }));
      return new Response('[]');
    }),
  );
});

afterEach(() => {
  cleanup();
  while (uninstalls.length) uninstalls.pop()!();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const installButton = () => buttonNamed(/^install/i);
const posts = (re: RegExp) => calls.filter((c) => c.method === 'POST' && re.test(c.url));

describe('configurator', () => {
  it('a link without a project installs into the project last opened, named', async () => {
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(pageText()).toMatch(/Install into Demo/));
  });

  it('with no project anywhere it says so and links to the launcher', async () => {
    stubFetchGlobal(vi.fn(async () => new Response('[]')));
    renderWithInstall(<PluginInstallDialog />, { uri: 'web+aiscplugin://enable?package=x&version=1' });
    await waitFor(() => expect(pageText()).toMatch(/in no project yet/));
    const link = Array.from(document.querySelectorAll('a')).find((a) => /launcher/i.test(a.textContent ?? ''));
    expect(link?.getAttribute('href')).toBeTruthy();
    expect(installButton()?.disabled).toBe(true);
  });

  it('a link naming a project the caller is not in disables Install', async () => {
    renderWithInstall(<PluginInstallDialog />, {
      uri: 'web+aiscplugin://enable?package=x&version=1',
      search: `?project=${DEAD}`,
    });
    await waitFor(() => expect(pageText()).toMatch(/not in this project/));
    expect(installButton()?.disabled).toBe(true);
  });

  it("the link's project wins over the one last opened", async () => {
    configuratorBackend([DEMO, LOANS]);
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE, search: `?project=${LOANS.pid}` });
    await waitFor(() => expect(pageText()).toMatch(/Install into Loans/));
  });

  it('reading a ?project= remembers it for this browser', async () => {
    const { currentPlatformProject, lastPlatformProject } = await import('../platform/currentProject');
    window.history.replaceState(null, '', `/?project=${LOANS.pid}`);
    currentPlatformProject();
    expect(localStorage.getItem('aisc_last_platform_project')).toBe(LOANS.pid);
    expect(lastPlatformProject()).toBe(LOANS.pid);
  });

  it('S8.1/I7.4 one Install: for-platform then the plugin, both naming the project', async () => {
    configuratorBackend();
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, {
      uri: 'web+aiscplugin://enable?package=aisc-plugin-langbite&version=0.1.1&slug=langbite',
    });
    await waitFor(() => expect(installButton()?.disabled).toBe(false));
    await click(installButton());
    const fp = posts(/\/projects\/for-platform\//);
    const install = posts(/\/plugins$/);
    expect(fp.map((c) => c.url)).toEqual([expect.stringMatching(new RegExp(`/projects/for-platform/${DEMO.pid}$`))]);
    expect(install).toHaveLength(1);
    expect(JSON.parse(install[0].body!)).toEqual({
      package_name: 'aisc-plugin-langbite',
      version: '0.1.1',
      project_uuid: 'engine-demo',
      catalogue_slug: 'langbite',
    });
    expect([...fp, ...install].map((c) => c.project)).toEqual([DEMO.pid, DEMO.pid]);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('changing the project installs into the chosen one, with its header', async () => {
    configuratorBackend([DEMO, LOANS]);
    // The tab was opened on Demo; the install goes to Loans.
    sessionStorage.setItem('aisc_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(pageText()).toMatch(/Install into Demo/));
    await click(buttonNamed(/change/i));
    await openSelect();
    await chooseOption(/Loans/);
    await waitFor(() => expect(pageText()).toMatch(/Install into Loans/));
    await click(installButton());
    const sent = [...posts(/\/projects\/for-platform\//), ...posts(/\/plugins$/)];
    expect(sent.map((c) => c.project)).toEqual([LOANS.pid, LOANS.pid]);
    expect(sent[0].url).toMatch(new RegExp(`/projects/for-platform/${LOANS.pid}$`));
    expect(JSON.parse(sent[1].body!).project_uuid).toBe('engine-loans');
  });

  it('Review Focus 4: a 404 from for-platform says "not in this project" and installs nothing', async () => {
    configuratorBackend([DEMO], 404);
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(installButton()?.disabled).toBe(false));
    await click(installButton());
    expect(pageText()).toMatch(/You are not in this project/);
    expect(installButton()?.disabled).toBe(true);
    expect(posts(/\/plugins$/)).toEqual([]);
  });

  it("S8.5 the engine's 403 reads 'Installing a test takes the admin role'", async () => {
    configuratorBackend([DEMO], 201, 403);
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(installButton()?.disabled).toBe(false));
    await click(installButton());
    expect(String(toastError.mock.calls[0]?.[0])).toContain('Installing a test takes the admin role');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('never asks the engine for every project', async () => {
    configuratorBackend();
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(pageText()).toMatch(/Install into Demo/));
    expect(calls.filter((c) => /\/api\/v1\/projects(\?|$)/.test(c.url))).toEqual([]);
  });

  it('S8.1 /receiver keeps its ?project= before the URL is stripped', async () => {
    vi.resetModules();
    window.history.replaceState(null, '', `/receiver?project=${LOANS.pid}&uri=${encodeURIComponent(ENABLE)}`);
    await import('../pluginCatalogue/PluginInstallContext');
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem('aisc_platform_project')).toBe(LOANS.pid);
    expect(localStorage.getItem('aisc_last_platform_project')).toBe(LOANS.pid);
  });
});

describe('configurator: only a pid is a project', () => {
  it('a page with ?project=foo leaves both storages untouched', async () => {
    configuratorBackend();
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE, search: '?project=foo' });
    await waitFor(() => expect(pageText()).toMatch(/Choose a project/));
    expect(sessionStorage.getItem('aisc_platform_project')).toBeNull();
    expect(localStorage.getItem('aisc_last_platform_project')).toBeNull();
    expect(installButton()?.disabled).toBe(true);
  });

  it('a stored "foo" gives no target and Install disabled, even when the list is unreadable', async () => {
    stubFetch(() => json({ detail: 'Bad Gateway' }, 502));
    localStorage.setItem('aisc_last_platform_project', 'foo');
    sessionStorage.setItem('aisc_platform_project', 'foo');
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(pageText()).toMatch(/could not be loaded/));
    expect(pageText()).not.toMatch(/project you came from/);
    expect(installButton()?.disabled).toBe(true);
    await click(installButton());
    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('a stored "foo" with a readable list says "Choose a project"', async () => {
    configuratorBackend([DEMO]);
    localStorage.setItem('aisc_last_platform_project', 'foo');
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() => expect(pageText()).toMatch(/Choose a project/));
    expect(pageText()).not.toMatch(/not in this project/);
    expect(installButton()?.disabled).toBe(true);
  });

  it('list unreadable and no target: says so, with the launcher link', async () => {
    stubFetch(() => json({ detail: 'Bad Gateway' }, 502));
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE });
    await waitFor(() =>
      expect(pageText()).toMatch(/Your projects could not be loaded\. Open this from your project on the launcher\./),
    );
    const link = Array.from(document.querySelectorAll('a')).find((a) => /launcher/i.test(a.textContent ?? ''));
    expect(link?.getAttribute('href')).toBeTruthy();
    expect(installButton()?.disabled).toBe(true);
  });

  it('list unreadable with a pid target: the URL and the header name the same project', async () => {
    stubFetch((url, method) => {
      if (url.endsWith('/platform/api/projects')) return json({}, 502);
      if (method === 'POST' && url.includes('/projects/for-platform/')) return json({ pid: 'engine-demo', name: 'Demo' });
      return json({ ok: true });
    });
    sessionStorage.setItem('aisc_platform_project', LOANS.pid);
    localStorage.setItem('aisc_last_platform_project', DEMO.pid);
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE, search: `?project=${DEMO.pid}` });
    await waitFor(() => expect(installButton()?.disabled).toBe(false));
    await click(installButton());
    const sent = calls.filter((c) => c.method === 'POST');
    expect(sent[0].url).toMatch(new RegExp(`/projects/for-platform/${DEMO.pid}$`));
    expect(sent.map((c) => c.project)).toEqual([DEMO.pid, DEMO.pid]);
  });
});

describe('standalone', () => {
  it("is Sean's dialog: every engine project in the dropdown", async () => {
    mode.configurator = false;
    stubFetchGlobal(vi.fn(async () => new Response(JSON.stringify([{ pid: 'p1', name: 'Loans' }]))));
    renderWithInstall(<PluginInstallDialog />, { uri: 'web+aiscplugin://enable?package=x&version=1' });
    await waitFor(() => expect(document.querySelector('[role="combobox"]')).toBeTruthy());
    await openSelect();
    await waitFor(() => expect(pageText()).toContain('Loans'));
    mode.configurator = true;
  });

  it("asks the engine for all its projects and posts master's body, with no project header", async () => {
    mode.configurator = false;
    stubFetch((_url, method) =>
      method === 'POST' ? json({ ok: true }) : json([{ pid: 'p1', name: 'Loans' }]),
    );
    renderWithInstall(<PluginInstallDialog />, { uri: ENABLE, search: `?project=${DEMO.pid}` });
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await openSelect();
    await chooseOption(/Loans/);
    await click(buttonNamed(/enable plugin/i));
    expect(calls[0].url).toMatch(/\/projects$/);
    const install = posts(/\/plugins$/);
    expect(JSON.parse(install[0].body!)).toEqual({
      package_name: 'aisc-plugin-langbite',
      version: '0.1.1',
      project_uuid: 'p1',
    });
    expect(calls.every((c) => c.project === null)).toBe(true);
    expect(calls.some((c) => c.url.includes('/platform/'))).toBe(false);
    mode.configurator = true;
  });
});
