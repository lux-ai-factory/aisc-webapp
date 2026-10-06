// @vitest-environment jsdom
// The web app by deployment mode (spec 2026-09-27, "What the switch decides"):
// standalone is Sean's engine as on master, configurator is the launcher's.
// Each test sets the mode itself, so the file passes in both suite runs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const PID = '3f2b8c1e-0d4a-4e7b-9a55-1c2d3e4f5a6b';

// Who is signed in is AuthContext's business (tested below); the pages only read it.
const auth = { ready: true, authenticated: true, username: 'user', roles: [] as string[], login: vi.fn(), logout: vi.fn() };
vi.mock('./context/AuthContext', async (original) => ({
  ...(await original<typeof import('./context/AuthContext')>()),
  useAuth: () => auth,
}));
vi.mock('./pluginCatalogue/PluginInstallContext', async (original) => ({
  ...(await original<typeof import('./pluginCatalogue/PluginInstallContext')>()),
  usePluginInstall: () => ({ registerProtocol: vi.fn() }),
}));
// Sean's Keycloak client: standalone signs in with it, the configurator never touches it.
const kc = vi.hoisted(() => ({
  initKeycloak: vi.fn(async () => true),
  installAuthFetch: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  keycloak: { authenticated: true, token: 't', tokenParsed: { preferred_username: 'sean', realm_access: { roles: ['admin'] } } },
}));
vi.mock('./auth/keycloak', () => ({ ...kc, default: kc.keycloak }));

type Call = { url: string; method: string; project: string | null };
/** The engine's project name for-platform answers with: the platform project's name, free text. */
let forPlatformName = 'launcher-project';
let calls: Call[] = [];
let container: HTMLElement;
let root: Root;
let uninstall: () => void = () => {};

/** The configurator as main.tsx starts it: the mode, then the start-up wrapper over this test's fetch. */
async function configurator() {
  vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
  const { installProjectHeader } = await import('./api/installProjectHeader');
  uninstall = installProjectHeader(globalThis);
}

function respond(url: string, method: string): unknown {
  if (url.includes('/for-platform/')) return { pid: 'eng-1', name: forPlatformName };
  if (/\/me$/.test(url)) return { username: 'gateway-user', roles: ['primary-user'] };
  if (url.includes('/display_icon')) return 'extension';
  if (/\/projects\/[^/?]+$/.test(url)) return { pid: 'eng-1', name: 'alpha', plugins: [] };
  if (/\/projects(\?|$)/.test(url) && method === 'GET') return [{ pid: 'eng-1', name: 'alpha' }];
  if (/\/plugins$/.test(url)) return [];
  return {};
}

beforeEach(() => {
  calls = [];
  forPlatformName = 'launcher-project';
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.resetModules();
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method, project: headers['X-AISC-Project'] ?? null });
    return { ok: true, status: 200, json: async () => respond(url, method) } as Response;
  }) as unknown as typeof fetch;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  uninstall();
  uninstall = () => {};
  vi.unstubAllEnvs();
});

async function render(node: ReactNode, path = '/') {
  const { ProjectProvider } = await import('./context/ProjectContext');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <ProjectProvider>
            <Routes>
              <Route path="/" element={node} />
              <Route path="/projects/:name/*" element={<>{node}<p data-testid="in-project">in project</p></>} />
            </Routes>
          </ProjectProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

async function until(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`timed out; page: ${container.textContent}`);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  }
}

describe('GlobalHome by mode', () => {
  it("standalone shows Sean's project list from GET /projects, with no project header", async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const { default: GlobalHome } = await import('./pages/GlobalHome');
    await render(<GlobalHome />);
    await until(() => container.textContent!.includes('alpha'));
    expect(container.textContent).toContain('Projects');
    expect(calls.map((c) => `${c.method} ${c.url.replace(/^.*\/api\/v1/, '')}`)).toEqual(['GET /projects']);
    expect(calls[0].project).toBeNull();
  });

  it("standalone lists every project even when a ?project= is in the URL", async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    window.history.replaceState(null, '', `/?project=${PID}`);
    const { default: GlobalHome } = await import('./pages/GlobalHome');
    await render(<GlobalHome />);
    await until(() => container.textContent!.includes('alpha'));
    expect(calls.some((c) => c.url.includes('for-platform'))).toBe(false);
  });

  it("configurator opens the launcher's project (OpenTheProject): finds or makes the engine's row and goes in", async () => {
    await configurator();
    window.history.replaceState(null, '', `/?project=${PID}`);
    const { default: GlobalHome } = await import('./pages/GlobalHome');
    await render(<GlobalHome />);
    await until(() => container.querySelector('[data-testid="in-project"]') !== null);
    const open = calls.find((c) => c.url.endsWith(`/projects/for-platform/${PID}`));
    expect(open?.method).toBe('POST');
    expect(open?.project).toBe(PID);
    expect(calls.some((c) => c.method === 'GET' && /\/projects$/.test(c.url))).toBe(false);
  });

  it("configurator goes into a project whose name has / # ? or spaces (the platform's name is free text)", async () => {
    await configurator();
    forPlatformName = 'MCAS v2/2026 #1?';
    window.history.replaceState(null, '', `/?project=${PID}`);
    const { default: GlobalHome } = await import('./pages/GlobalHome');
    const { useParams } = await import('react-router-dom');
    const Probe = () => <p data-testid="opened">{useParams().name}</p>;
    const { ProjectProvider } = await import('./context/ProjectContext');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/']}>
            <ProjectProvider>
              <Routes>
                <Route path="/" element={<GlobalHome />} />
                <Route path="/projects/:name" element={<Probe />} />
              </Routes>
            </ProjectProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await until(() => container.querySelector('[data-testid="opened"]') !== null);
    expect(container.querySelector('[data-testid="opened"]')!.textContent).toBe('MCAS v2/2026 #1?');
  });

  it('configurator with no project points to the launcher and lists nothing', async () => {
    await configurator();
    vi.stubEnv('VITE_LAUNCHER_URL', 'http://launcher.test/');
    const { default: GlobalHome } = await import('./pages/GlobalHome');
    await render(<GlobalHome />);
    await until(() => container.textContent!.includes('Open a project on the launcher'));
    expect(container.querySelector('a[href="http://launcher.test"]')).not.toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('TopBar by mode', () => {
  it("standalone has Sean's ADD PROJECT wizard button and no launcher link", async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const { default: TopBar } = await import('./components/TopBar');
    await render(<TopBar />);
    expect(container.textContent).toContain('ADD PROJECT');
    expect(container.querySelector('[aria-label="Back to the project"]')).toBeNull();
  });

  it('configurator links back to the project on the launcher and cannot add a project', async () => {
    await configurator();
    vi.stubEnv('VITE_LAUNCHER_URL', 'http://launcher.test/');
    sessionStorage.setItem('aisc_platform_project', PID);
    const { default: TopBar } = await import('./components/TopBar');
    await render(<TopBar />);
    const back = container.querySelector('[aria-label="Back to the project"]');
    expect(back?.getAttribute('href')).toBe(`http://launcher.test/p/${PID}`);
    expect(container.textContent).not.toContain('ADD PROJECT');
  });
});

describe('LeftBar by mode', () => {
  async function renderLeftBar() {
    vi.stubEnv('VITE_SHOW_CELERY_TASKS', 'true');
    sessionStorage.setItem('aisc_platform_project', PID);
    const { default: LeftBar } = await import('./components/LeftBar');
    const { useProject } = await import('./context/ProjectContext');
    const { useEffect } = await import('react');
    function InProject() {
      const { setProjectName, setProjectUUID } = useProject();
      // ProjectContext's setters are new functions on every render: listed, they would rerun this on every render
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => { setProjectName('alpha'); setProjectUUID('eng-1'); }, []);
      return <LeftBar drawerWidth={320} expandedDrawerWidth={320} collapsed={false} />;
    }
    await render(<InProject />);
    await until(() => container.textContent!.includes('Start Evaluations'));
  }

  it("standalone shows Sean's Celery tasks page when VITE_SHOW_CELERY_TASKS is on", async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    await renderLeftBar();
    expect(container.querySelector('a[href="/projects/alpha/tasks"]')).not.toBeNull();
  });

  it("configurator hides it (it lists every project's tasks), even when the flag is on", async () => {
    await configurator();
    await renderLeftBar();
    expect(container.querySelector('a[href="/projects/alpha/tasks"]')).toBeNull();
  });
});

describe('AuthContext by mode', () => {
  async function renderAuth() {
    const { AuthProvider, useAuth } = await vi.importActual<typeof import('./context/AuthContext')>('./context/AuthContext');
    function Who() {
      const { authenticated, username } = useAuth();
      return <p>{authenticated ? `signed in as ${username}` : 'signed out'}</p>;
    }
    await render(<AuthProvider><Who /></AuthProvider>);
    await until(() => container.textContent!.includes('signed'));
  }

  it("standalone signs in with Sean's Keycloak client", async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    kc.initKeycloak.mockClear();
    await renderAuth();
    expect(kc.initKeycloak).toHaveBeenCalled();
    expect(kc.installAuthFetch).toHaveBeenCalled();
    expect(container.textContent).toContain('signed in as sean');
    expect(calls.some((c) => c.url.endsWith('/me'))).toBe(false);
  });

  it("configurator has no login of its own: it asks the API who the gateway says this is", async () => {
    await configurator();
    kc.initKeycloak.mockClear();
    kc.installAuthFetch.mockClear();
    await renderAuth();
    expect(kc.initKeycloak).not.toHaveBeenCalled();
    expect(kc.installAuthFetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain('signed in as gateway-user');
  });
});

describe('a bad AISC_DEPLOYMENT stops the app with a blocking error page', () => {
  it.each(['APP_DEPLOYMENT', 'config'])('%s', async (value) => {
    vi.stubEnv('VITE_DEPLOYMENT', value);
    const { DeploymentGate } = await import('./DeploymentGate');
    await act(async () => {
      root.render(<DeploymentGate><p>the app</p></DeploymentGate>);
    });
    expect(container.textContent).toContain('AISC_DEPLOYMENT must be standalone or configurator');
    expect(container.textContent).not.toContain('the app');
  });

  it('a good one renders the app', async () => {
    await configurator();
    const { DeploymentGate } = await import('./DeploymentGate');
    await act(async () => {
      root.render(<DeploymentGate><p>the app</p></DeploymentGate>);
    });
    expect(container.textContent).toBe('the app');
  });
});
