// @vitest-environment jsdom
// Refresh package says what the engine answered: a refusal (403 for anyone without the admin role) is shown with
// its reason, never as "Package refreshed.".
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const toasts = vi.hoisted(() => ({ success: [] as string[], error: [] as string[] }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn((m: string) => { toasts.success.push(String(m)); }),
    error: vi.fn((m: string) => { toasts.error.push(String(m)); }),
  });
  return { default: toast, toast };
});
vi.mock('../deployment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../deployment')>()),
  isConfigurator: () => true,
  listsPackageIndex: () => false,
}));

import Plugins from './Plugins';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PROJECT = 'fa6bf828-b44a-40dc-ba61-2c107251487f';
const LANGBITE = {
  pid: 'abfd8721-c402-443c-86a3-1d88933a04ee', name: 'LangBiteEvaluationPlugin',
  display_name: 'LangBiTe', package_name: 'aisc-plugin-langbite', version: '0.1.1', enabled: true,
};
const REFUSAL = 'Refreshing a test takes the admin role';

function SetProject({ uuid }: { uuid: string }) {
  const { setProjectUUID } = useProject();
  useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
  return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  toasts.success = [];
  toasts.error = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/plugins/refresh')) {
      return new Response(JSON.stringify({ detail: REFUSAL }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ pid: PROJECT, name: 'Demo', plugins: [LANGBITE] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  vi.unstubAllGlobals();
});

async function renderPage() {
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
  for (let i = 0; i < 20 && !/langbite/i.test(document.body.textContent ?? ''); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}

it('a refused refresh is said with the engine\'s reason, not as refreshed', async () => {
  await renderPage();
  const refresh = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === 'refresh');
  expect(refresh, 'the page shows a refresh button for the installed package').toBeDefined();
  await act(async () => { refresh!.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
  expect(toasts.success, 'no success toast for a refused refresh').toEqual([]);
  expect(toasts.error.join(' | ')).toContain(REFUSAL);
});
