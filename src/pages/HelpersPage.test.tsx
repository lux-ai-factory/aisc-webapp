// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import HelpersPage from './HelpersPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
    }),
}));

const list = (canManage = true) => ({
    can_manage: canManage,
    roles: ['judge', 'attacker', 'grader', 'embedder', 'generator'],
    helpers: [
        {
            name: 'judge-1',
            label: 'Judge',
            endpoint_url: 'http://judge.local/v1',
            roles: ['judge', 'grader'],
            has_key: true,
        },
    ],
});

let container: HTMLElement;
let root: Root;
let calls: { url: string; method: string; body: unknown }[];
let canManage: boolean;

beforeEach(() => {
    calls = [];
    canManage = true;
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            calls.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            if (url.endsWith('/test'))
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ ok: true, status: 'reachable', detail: '', latency_ms: 3 }),
                });
            if (method === 'PUT' || method === 'DELETE')
                return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
            return Promise.resolve({ ok: true, status: 200, json: async () => list(canManage) });
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
                <HelpersPage />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

const text = () => document.body.textContent ?? '';
const byTestId = (id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function type(testid: string, value: string) {
    const input = byTestId(testid) as HTMLInputElement;
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        )?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('HelpersPage', () => {
    it('lists each helper model with its endpoint, roles and key state', async () => {
        await renderPage();
        expect(text()).toContain('Judge');
        expect(text()).toContain('http://judge.local/v1');
        expect(text()).toContain('judge, grader');
        expect(text()).toContain('key stored');
    });

    it('saves a new helper model with its roles and key', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('new-helper') as HTMLButtonElement).click();
        });
        await type('field-name', 'attacker-1');
        await type('field-label', 'Attacker');
        await type('field-endpoint', 'http://attacker.local/v1');
        await type('field-key', 'secret');
        await act(async () => {
            (byTestId('role-attacker') as HTMLInputElement).click();
        });
        await act(async () => {
            (byTestId('save-helper') as HTMLButtonElement).click();
        });
        const put = calls.find((c) => c.method === 'PUT');
        expect(put?.url).toContain('/projects/p1/helpers/attacker-1');
        expect(put?.body).toMatchObject({
            label: 'Attacker',
            endpoint_url: 'http://attacker.local/v1',
            roles: ['attacker'],
            key: 'secret',
        });
    });

    it('refuses a helper with no role', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('new-helper') as HTMLButtonElement).click();
        });
        await type('field-name', 'h1');
        await type('field-endpoint', 'http://h/v1');
        await act(async () => {
            (byTestId('save-helper') as HTMLButtonElement).click();
        });
        expect(text()).toContain('Choose at least one role');
        expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    it('tests a helper with the model typed and reports the status only', async () => {
        await renderPage();
        await type('model-judge-1', 'm1');
        await act(async () => {
            (byTestId('test-judge-1') as HTMLButtonElement).click();
        });
        const post = calls.find((c) => c.url.endsWith('/test'));
        expect(post?.url).toContain('/projects/p1/helpers/judge-1/test');
        expect(post?.body).toEqual({ model: 'm1' });
        expect(byTestId('result-judge-1')?.textContent).toContain('Reachable');
    });

    it('lets a viewer read but not manage', async () => {
        canManage = false;
        await renderPage();
        expect(text()).toContain('judge-1');
        expect(byTestId('new-helper')).toBeNull();
        expect(byTestId('edit-judge-1')).toBeNull();
        expect(byTestId('test-judge-1')).toBeNull();
    });
});
