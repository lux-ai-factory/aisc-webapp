// @vitest-environment jsdom
// Deployment modes, 2026-09-28 (the user's decision): inside the Configurator the hosted
// catalogue is the only place tests are found. The Plugins page of a project then lists
// only what is installed in that project, and offers the catalogue for anything else; it
// never lists the package index (GET /plugins), which held packages no catalogue entry
// points to. Standalone keeps Sean's page: every package on the index, enable from here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mode = vi.hoisted(() => ({ configurator: true }));
vi.mock('../deployment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../deployment')>()),
  isConfigurator: () => mode.configurator,
  listsPackageIndex: () => !mode.configurator,
}));
const openPublicCatalogue = vi.hoisted(() => vi.fn());
vi.mock('../pluginCatalogue/installUri', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../pluginCatalogue/installUri')>()),
  openPublicCatalogue,
}));

import Plugins from './Plugins';
import { installProjectHeader } from '../api/installProjectHeader';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PROJECT = 'fa6bf828-b44a-40dc-ba61-2c107251487f';
const INDEX = [
  { package_name: 'aisc-plugin-langbite', version: '0.1.1', source: 'registry' },
  { package_name: 'explitest', version: '0.1.0', source: 'registry' },
  { package_name: 'llm-eval-framework', version: '0.1.0', source: 'registry' },
];
const LANGBITE = {
  pid: 'abfd8721-c402-443c-86a3-1d88933a04ee', name: 'LangBiteEvaluationPlugin',
  display_name: 'LangBiTe', package_name: 'aisc-plugin-langbite', version: '0.1.1', enabled: true,
};

function SetProject({ uuid }: { uuid: string }) {
  const { setProjectUUID } = useProject();
  useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
  return null;
}

/** What main.tsx does in the configurator: the start-up wrapper over this test's fetch. It
 *  consults the mode itself, so in standalone it passes every call through unchanged. */
let uninstalls: (() => void)[] = [];
function stubFetchGlobal(fn: unknown) {
  vi.stubGlobal('fetch', fn);
  uninstalls.push(installProjectHeader(globalThis));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let urls: string[] = [];

async function renderPage(installed: object[]) {
  stubFetchGlobal(vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const body = /\/plugins$/.test(url) ? INDEX : { pid: PROJECT, name: 'Demo', plugins: installed };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  host = document.createElement('div');
  document.body.appendChild(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root = createRoot(host!);
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProjectProvider><SetProject uuid={PROJECT} /><Plugins /></ProjectProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 20 && !/langbite|No tests/i.test(document.body.textContent ?? ''); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}

const text = () => document.body.textContent ?? '';
const button = (re: RegExp) =>
  Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent ?? ''));

beforeEach(() => {
  urls = [];
  sessionStorage.setItem('aisc_platform_project', '9f2afa73-a818-4a27-b01d-f9f7773838c2');
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  while (uninstalls.length) uninstalls.pop()!();
  vi.unstubAllGlobals();
  openPublicCatalogue.mockReset();
});

describe('configurator: the catalogue is the only place tests are found', () => {
  beforeEach(() => { mode.configurator = true; });

  it('lists the installed tests only, and never asks the package index', async () => {
    await renderPage([LANGBITE]);
    expect(text()).toContain('aisc-plugin-langbite');
    expect(text()).not.toContain('explitest');
    expect(text()).not.toContain('llm-eval-framework');
    expect(text()).not.toContain('Available Packages');
    expect(urls.some((u) => /\/plugins$/.test(u))).toBe(false);
  });

  it('offers the public catalogue to add tests', async () => {
    await renderPage([LANGBITE]);
    const add = button(/Add tests from the Public Catalogue/);
    expect(add).toBeDefined();
    await act(async () => { add!.click(); });
    expect(openPublicCatalogue).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing is installed yet', async () => {
    await renderPage([]);
    expect(text()).toContain('No tests are installed in this project yet.');
    expect(button(/Add tests from the Public Catalogue/)).toBeDefined();
  });
});

describe("standalone: Sean's page, every package on the index", () => {
  beforeEach(() => { mode.configurator = false; });

  it('lists every package on the index', async () => {
    await renderPage([LANGBITE]);
    expect(text()).toContain('Available Packages');
    for (const p of INDEX) expect(text()).toContain(p.package_name);
    expect(button(/Add tests from the Public Catalogue/)).toBeUndefined();
  });
});
