// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SandboxPage from './SandboxPage';

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

const doneEvals = [
    { pid: 'e-done', status: 'Done', created_at: '2026-10-01T00:00:00Z', evaluation_plugins: [] },
];

const project = { pid: 'p1', name: 'demo', plugins: [], components: [] };

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.includes('status=Done')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => doneEvals });
            }
            if (url.includes('/evaluations?status=')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => [] });
            }
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => project });
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        }),
    );
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
                <MemoryRouter>
                    <SandboxPage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    await act(async () => {});
}

describe('SandboxPage', () => {
    it('renders the start flow above progress and completed results, without all-runs', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        // expect(text).toContain('Sandbox');
        expect(text).toContain('Start an Evaluation');
        expect(text).toContain('Completed Evaluations');
        expect(text).not.toContain('All runs');
        expect(text).not.toContain('No runs yet');
        expect(text.indexOf('Start an Evaluation')).toBeLessThan(text.indexOf('Completed Evaluations'));
    });

    it('renders completed evaluation results below the start flow', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Results');
        expect(text).toContain('Executed plugins');
        const link = Array.from(document.body.querySelectorAll('a')).find((a) =>
            a.getAttribute('href')?.includes('e-done'),
        );
        expect(link?.getAttribute('href')).toBe('/projects/demo/plugins/evaluations/e-done');
    });
});
