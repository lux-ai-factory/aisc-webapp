// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import ProjectContextWrapper from './ProjectContextWrapper';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ authenticated: true }) }));
it('blocks project content during navigation and ignores the departed lookup', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const replies = new Map<string, (value: Response) => void>();
    let navigate!: ReturnType<typeof useNavigate>;
    function Driver() { navigate = useNavigate(); return null; }
    function Page() { return <span>Active: {useProject().projectUUID}</span>; }
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise<Response>(resolve => replies.set(url.split('/').pop()!, resolve))));
    try {
        await act(async () => root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={['/projects/A']}><ProjectProvider><Driver />
                <Routes><Route path="/projects/:project_name" element={<ProjectContextWrapper><Page /></ProjectContextWrapper>} /></Routes>
            </ProjectProvider></MemoryRouter>
        </QueryClientProvider>));
        expect(host.textContent).not.toContain('Active:');
        await act(async () => { await navigate('/projects/B'); });
        expect(host.textContent).not.toContain('Active:');
        const reply = (name: string) => ({ ok: true, json: async () => ({ pid: name, name }) }) as Response;
        await act(async () => { replies.get('B')!(reply('B')); await new Promise(resolve => setTimeout(resolve, 30)); });
        expect(host.textContent).toContain('Active: B');
        await act(async () => { replies.get('A')!(reply('A')); await new Promise(resolve => setTimeout(resolve, 30)); });
        expect(host.textContent).toContain('Active: B');
        await act(async () => { await navigate('/projects/missing'); });
        await act(async () => { replies.get('missing')!({ ok: false } as Response); await new Promise(resolve => setTimeout(resolve, 30)); });
        expect(host.textContent).toContain('Could not load project');
        expect(host.textContent).not.toContain('Active:');
    } finally {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
    }
});
