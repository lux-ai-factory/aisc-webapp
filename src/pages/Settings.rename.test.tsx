// @vitest-environment jsdom
// Renaming the project in Settings: a refusal keeps what was typed and says the engine's reason; a rename that
// worked moves the page to the project's new name, so the by-name address keeps working.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const toasts = vi.hoisted(() => ({ success: [] as string[], error: [] as string[] }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn((m: string) => { toasts.success.push(String(m)); }),
    error: vi.fn((m: string) => { toasts.error.push(String(m)); }),
  });
  return { default: toast, toast };
});
vi.mock('../components/AISystemSettings', () => ({ default: () => null }));

import SettingsPage from './Settings';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PROJECT = 'fa6bf828-b44a-40dc-ba61-2c107251487f';
const REFUSAL = 'Renaming a project takes the owner role';
let patchAnswer: () => Response;
let where = '';

function SetProject({ uuid }: { uuid: string }) {
  const { setProjectUUID } = useProject();
  useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
  return null;
}

function Where() {
  const location = useLocation();
  where = location.pathname;
  return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  toasts.success = [];
  toasts.error = [];
  where = '';
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (method === 'PATCH') return patchAnswer();
    if (url.endsWith(`/projects/${PROJECT}`)) {
      return new Response(JSON.stringify({ pid: PROJECT, name: 'Demo' }), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  vi.unstubAllGlobals();
});

async function renderAndRename(newName: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(
      <MemoryRouter initialEntries={['/projects/Demo/settings']}>
        <ProjectProvider>
          <SetProject uuid={PROJECT} />
          <Routes><Route path="/projects/:project_name/settings" element={<><Where /><SettingsPage /></>} /></Routes>
        </ProjectProvider>
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 30 && !document.querySelector('input'); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  const input = Array.from(document.querySelectorAll('input')).find((i) => i.value === 'Demo') as HTMLInputElement;
  expect(input, 'the name field shows the project name').toBeDefined();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, newName);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const save = Array.from(document.querySelectorAll('button')).find((b) => /Save Changes/.test(b.textContent ?? ''));
  await act(async () => { save!.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
}

const nameShown = () => Array.from(document.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value);

it('a refused rename keeps the typed name and says the reason', async () => {
  patchAnswer = () => new Response(JSON.stringify({ detail: REFUSAL }), { status: 403 });
  await renderAndRename('Renamed');
  expect(nameShown(), 'the name field is not blanked as if saved').toContain('Renamed');
  expect(toasts.error.join(' | ')).toContain(REFUSAL);
});

it('a rename that worked moves the page to the new name', async () => {
  patchAnswer = () => new Response(JSON.stringify({ pid: PROJECT, name: 'Renamed' }), { status: 200 });
  await renderAndRename('Renamed');
  expect(where).toBe('/projects/Renamed/settings');
});
