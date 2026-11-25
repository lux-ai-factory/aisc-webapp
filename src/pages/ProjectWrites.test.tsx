// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import TopBar from '../components/TopBar';
import Settings from './Settings';

const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), name: vi.fn(), wizard: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: mocks.error, success: mocks.success } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ authenticated: true, username: 'user' }) }));
vi.mock('../context/ProjectContext', () => ({ useProject: () => ({ projectUUID: 'p', projectName: 'old',
    setProjectUUID: () => {}, setProjectName: mocks.name, addFileUploadingPid: () => {}, removeFileUploadingPid: () => {} }) }));
vi.mock('../components/addProjectWizard.tsx', () => ({ default: ({ onFinish }: { onFinish: (data: object) => Promise<void> }) => {
    mocks.wizard.mockImplementation(() => onFinish({ name: 'demo', components: [{ name: 'dataset', type: 'dataset', file: new File(['data'], 'data.csv') }] }));
    return null;
} }));
vi.mock('../components/AISystemSettings', () => ({ default: () => null }));
vi.mock('../api/api', () => ({ getProjectConfigs: async () => [] }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it.each(['component', 'upload'])('reports a failed %s request without claiming an upload succeeded', async failure => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        let data: unknown = [];
        let ok = true;
        if (url.endsWith('/projects') && init?.method === 'POST') data = { pid: 'p', name: 'demo' };
        if (url.endsWith('/components')) { ok = failure !== 'component'; data = { pid: 'c' }; }
        if (url.endsWith('/data')) ok = false;
        return { ok, status: ok ? 200 : 500, json: async () => data };
    }));
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
        await act(async () => root.render(<MemoryRouter><TopBar /></MemoryRouter>));
        await act(async () => { await mocks.wizard(); });
        expect(mocks.error).toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); }
});
it.each([true, false])('updates project navigation only after a successful rename (success=%s)', async ok => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => ({ ok: init?.method === 'PATCH' ? ok : true,
        json: async () => ({ pid: 'p', name: init?.method === 'PATCH' ? 'renamed' : 'old' }) })));
    function Location() { return <span data-location>{useLocation().pathname}</span>; }
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
        await act(async () => root.render(<MemoryRouter initialEntries={['/projects/old/settings']}><Settings /><Location /></MemoryRouter>));
        const input = host.querySelector('input')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'renamed');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Save Changes')!.click(); });
        expect(host.querySelector('[data-location]')!.textContent).toBe(`/projects/${ok ? 'renamed' : 'old'}/settings`);
        if (ok) expect(mocks.name).toHaveBeenCalledWith('renamed');
        else { expect(mocks.name).not.toHaveBeenCalled(); expect(mocks.error).toHaveBeenCalled(); }
    } finally { await act(async () => root.unmount()); }
});
