// @vitest-environment jsdom
// I7.4 (isolation 2026-09-25, 01-specs.md): the engine keeps one database per
// platform project, and its door (I7.2) opens the database named by the
// X-AISC-Project header. So the SPA sets X-AISC-Project from its current
// platform project on every API call: one wrapper, installed at start
// (installProjectHeader, adapt plan 2026-09-28 item 4), adds it to fetch and
// axios, and with no current project the SPA does not call a project route at
// all.
//
// Cross-project isolation itself is decided by the backend's door (I7.2, the
// backend suite); the SPA's part is only this header.
//
// Deployment modes (2026-09-27): all of this is the configurator's. In
// standalone (Sean's engine on its own) nothing is installed: fetch is fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PID = '3f2b8c1e-0d4a-4e7b-9a55-1c2d3e4f5a6b';
const SRC = join(__dirname, '..');

type Call = { url: string; method: string; project: string | null };
let calls: Call[] = [];
let uninstall: () => void = () => {};

/** What main.tsx does in the configurator. */
async function install(): Promise<void> {
  const { installProjectHeader } = await import('./installProjectHeader');
  uninstall = installProjectHeader(globalThis);
}

function headerOf(input: RequestInfo | URL, init: RequestInit | undefined, name: string): string | null {
  const fromRequest = typeof Request !== 'undefined' && input instanceof Request ? input.headers.get(name) : null;
  const h = init?.headers;
  if (!h) return fromRequest;
  if (h instanceof Headers) return h.get(name) ?? fromRequest;
  if (Array.isArray(h)) {
    const found = h.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : fromRequest;
  }
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : fromRequest;
}

beforeEach(() => {
  vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
  calls = [];
  sessionStorage.clear();
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    calls.push({
      url,
      method: (init?.method ?? 'GET').toUpperCase(),
      project: headerOf(input, init, 'X-AISC-Project'),
    });
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' } as Response;
  }) as unknown as typeof fetch;
  vi.resetModules();
});

afterEach(() => {
  uninstall();
  uninstall = () => {};
  vi.unstubAllEnvs();
  window.history.replaceState(null, '', '/');
});

/** Every exported call builder of src/api/api.tsx, called with dummy arguments. */
async function callEveryBuilder(): Promise<string[]> {
  const api = (await import('./api')) as Record<string, unknown>;
  const names = Object.keys(api).filter((k) => typeof api[k] === 'function');
  for (const name of names) {
    const fn = api[name] as (...args: unknown[]) => Promise<unknown>;
    try {
      await fn('x-1', 'x-2', 'x-3', 'x-4');
    } catch {
      /* a refusal is fine; what was sent is what counts */
    }
    try {
      await fn('x-1', { any: 'body' });
    } catch {
      /* idem */
    }
  }
  return names;
}

// The routes the door lets through without a project (plan 4 list, I7.2).
const projectLess = (url: string, method: string) =>
  (method === 'GET' && /\/plugins$/.test(url)) || /\/(me|me\/admin|app-name|docs|openapi\.json|audit)$/.test(url);

describe('I7.4 every API call names the current platform project', () => {
  it('I7.4 every call builder of api.tsx sends X-AISC-Project with the current project', async () => {
    sessionStorage.setItem('aisc_platform_project', PID);
    window.history.replaceState(null, '', `/?project=${PID}`);
    await install();
    const names = await callEveryBuilder();
    expect(names.length).toBeGreaterThan(10);
    expect(calls.length).toBeGreaterThan(0);
    const without = calls.filter((c) => c.project !== PID).map((c) => `${c.method} ${c.url}`);
    expect(without, 'I7.4: calls sent without X-AISC-Project = the current project').toEqual([]);
  });

  it('I7.4 with no current project the SPA calls no project route', async () => {
    await install();
    const names = await callEveryBuilder();
    expect(names.length).toBeGreaterThan(10);
    const projectRoutes = calls.filter((c) => !projectLess(c.url, c.method)).map((c) => `${c.method} ${c.url}`);
    expect(projectRoutes, 'I7.4: project routes called with no current project').toEqual([]);
  });
});

// Start-up: the header is added in one place only, the wrapper main.tsx
// installs before the first render, and only in the configurator. Sean's
// components call fetch and axios as they always did.
describe('I7.4 one wrapper adds the project header', () => {
  it('I7.4 main.tsx installs installProjectHeader, gated on the configurator, before rendering', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');
    const install = main.indexOf('if (isConfigurator()) installProjectHeader()');
    expect(install, 'I7.4: main.tsx does not install the wrapper in the configurator').toBeGreaterThan(-1);
    expect(install, 'I7.4: the wrapper is installed after the first render').toBeLessThan(main.indexOf('createRoot('));
  });
});

describe('I7.4 a caller may name the project itself', () => {
  const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

  it('a named pid wins over the tab project, and needs no tab project', async () => {
    await install();
    await fetch('/api/v1/projects/for-platform/x', { method: 'POST', headers: { 'X-AISC-Project': OTHER } });
    sessionStorage.setItem('aisc_platform_project', PID);
    await fetch('/api/v1/plugins', { method: 'POST', headers: { 'X-AISC-Project': OTHER } });
    expect(calls.map((c) => c.project)).toEqual([OTHER, OTHER]);
  });

  it('a named value that is not a pid is replaced by the tab project', async () => {
    sessionStorage.setItem('aisc_platform_project', PID);
    await install();
    await fetch('/api/v1/plugins', { method: 'POST', headers: { 'X-AISC-Project': 'not-a-pid' } });
    expect(calls.map((c) => c.project)).toEqual([PID]);
  });
});

describe('standalone: projectFetch is the base fetch, unchanged', () => {
  it('passes the same arguments to fetch and adds no header, with or without a project', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const { projectFetch } = await import('./projectHeader');
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    await projectFetch(globalThis.fetch, 'APP_API_URL/api/v1/projects', init);
    sessionStorage.setItem('aisc_platform_project', PID);
    await projectFetch(globalThis.fetch, 'APP_API_URL/api/v1/projects/x-1');
    expect(f.mock.calls[0]).toEqual(['APP_API_URL/api/v1/projects', init]);
    expect(f.mock.calls[0][1]).toBe(init);
    expect(f.mock.calls[1]).toEqual(['APP_API_URL/api/v1/projects/x-1', undefined]);
    expect(calls.map((c) => c.project)).toEqual([null, null]);
  });

  it('calls project routes with no current project (Sean\'s engine has no door)', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const names = await callEveryBuilder();
    expect(names.length).toBeGreaterThan(10);
    expect(calls.filter((c) => !projectLess(c.url, c.method)).length).toBeGreaterThan(10);
    expect(calls.every((c) => c.project === null)).toBe(true);
  });
});
