// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import ConnectionsPage from './ConnectionsPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
    }),
}));

const list = () => ({
    adapters: ['builtin', 'openai', 'a2a', 'rest'],
    connections: [
        {
            pid: 'c1',
            name: 'judge',
            component_type: 'llm',
            adapter: 'openai',
            adapter_version: '',
            helper_role: '',
            endpoint: 'http://llm.local',
            key_set: true,
        },
        {
            pid: 'c2',
            name: 'train',
            component_type: 'dataset',
            adapter: 'builtin',
            adapter_version: '',
            helper_role: '',
            endpoint: '',
            key_set: false,
        },
    ],
});

let container: HTMLElement;
let root: Root;
let calls: { url: string; method: string; body: unknown; ok: boolean }[];

beforeEach(() => {
    calls = [];
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            calls.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
                ok: true,
            });
            if (method === 'PUT') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ ...list().connections[0], helper_role: 'judge' }),
                });
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => list() });
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
    await act(async () => {
        root.render(
            <MemoryRouter>
                <ConnectionsPage />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

const text = () => document.body.textContent ?? '';
const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('ConnectionsPage', () => {
    it('lists each connection with its adapter and key state', async () => {
        await renderPage();
        expect(text()).toContain('judge');
        expect(text()).toContain('llm');
        expect(text()).toContain('set');
        expect(text()).toContain('not set');
        expect(text()).toContain('http://llm.local');
    });

    it('saves the helper role through the API', async () => {
        await renderPage();
        const input = byTestId('helper-judge')?.querySelector('input') as HTMLInputElement;
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            )?.set;
            setter?.call(input, 'judge');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            (byTestId('save-judge') as HTMLButtonElement).click();
        });
        const put = calls.find((c) => c.method === 'PUT');
        expect(put?.url).toContain('/projects/p1/connections/c1');
        expect(put?.body).toMatchObject({ adapter: 'openai', helper_role: 'judge' });
    });

    it('shows the backend refusal', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
                if ((init?.method ?? 'GET') === 'PUT') {
                    return Promise.resolve({
                        ok: false,
                        status: 403,
                        json: async () => ({ detail: 'your role does not allow this' }),
                    });
                }
                return Promise.resolve({ ok: true, status: 200, json: async () => list() });
            }),
        );
        await renderPage();
        await act(async () => {
            (byTestId('save-judge') as HTMLButtonElement).click();
        });
        expect(text()).toContain('your role does not allow this');
    });
});
