// @vitest-environment jsdom
// I7.4 (isolation 2026-09-25, 01-specs.md): the engine keeps one database per
// platform project, and its door (I7.2) opens the database named by the
// X-AISC-Project header. So the SPA sets X-AISC-Project from its current
// platform project on every API call, every call builder goes through the one
// function that adds it, and with no current project the SPA does not call a
// project route at all.
//
// Cross-project isolation itself is decided by the backend's door (I7.2, the
// backend suite); the SPA's part is only this header.
//
// Deployment modes (2026-09-27): all of this is the configurator's. In
// standalone (Sean's engine on its own) apiFetch is fetch, unchanged.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PID = '3f2b8c1e-0d4a-4e7b-9a55-1c2d3e4f5a6b';
const SRC = join(__dirname, '..');

type Call = { url: string; method: string; project: string | null };
let calls: Call[] = [];

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
    const names = await callEveryBuilder();
    expect(names.length).toBeGreaterThan(10);
    expect(calls.length).toBeGreaterThan(0);
    const without = calls.filter((c) => c.project !== PID).map((c) => `${c.method} ${c.url}`);
    expect(without, 'I7.4: calls sent without X-AISC-Project = the current project').toEqual([]);
  });

  it('I7.4 with no current project the SPA calls no project route', async () => {
    const names = await callEveryBuilder();
    expect(names.length).toBeGreaterThan(10);
    const projectRoutes = calls.filter((c) => !projectLess(c.url, c.method)).map((c) => `${c.method} ${c.url}`);
    expect(projectRoutes, 'I7.4: project routes called with no current project').toEqual([]);
  });
});

// Source scan: the header is added in one place only. Every file under src/
// (tests excluded) that calls the network directly is listed; only one module,
// the one function that adds X-AISC-Project, may do so. gatewaySession.ts
// calls its injected fetchImpl (the project-less /me) and does not match.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

// Pages that call fetch themselves and are not in the configurator's path:
// Sean's Celery tasks page (standalone only, hidden in the configurator) and
// the install dialog, whose configurator branch is Task 8 of the deployment
// modes plan.
const NOT_YET = ['components/PluginInstallDialog.tsx', 'pages/CeleryTasks.tsx'];

const RAW_NETWORK = /(^|[^\w.])fetch\s*\(|\baxios\s*[.(]|new\s+XMLHttpRequest|new\s+EventSource/;

describe('I7.4 one function adds the project header', () => {
  it('I7.4 only one module in src/ calls the network directly, and it sets X-AISC-Project', () => {
    const direct = sourceFiles(SRC)
      .filter((f) => !NOT_YET.includes(relative(SRC, f)))
      .filter((f) => RAW_NETWORK.test(readFileSync(f, 'utf8')));
    const names = direct.map((f) => relative(SRC, f)).sort();
    expect(names.length, `I7.4: files calling fetch/axios directly: ${names.join(', ')}`).toBeLessThanOrEqual(1);
    for (const f of direct) {
      expect(readFileSync(f, 'utf8'), `I7.4: ${relative(SRC, f)} does not set the header`).toContain('X-AISC-Project');
    }
  });
});

describe('standalone: apiFetch is fetch, unchanged', () => {
  it('passes the same arguments to fetch and adds no header, with or without a project', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const { apiFetch } = await import('./projectHeader');
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    await apiFetch('APP_API_URL/api/v1/projects', init);
    sessionStorage.setItem('aisc_platform_project', PID);
    await apiFetch('APP_API_URL/api/v1/projects/x-1');
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
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
