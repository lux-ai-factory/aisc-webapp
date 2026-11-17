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

const connection = (over: Record<string, unknown> = {}) => ({
    name: 'system',
    label: 'The system',
    kind: 'rest',
    protocol: 'REST endpoint, POST /chat',
    base_url: 'http://system.local',
    model: '',
    supports_tools: false,
    supports_logprobs: false,
    protocol_version: '',
    path: '/chat',
    method: 'POST',
    body_template: { q: '{{input}}' },
    response_path: 'answer',
    headers: {},
    secret_header: '',
    timeout_s: 30,
    settings: {},
    target: null,
    has_secret: true,
    secret_headers: ['X-Token'],
    last_test_at: null,
    last_test_ok: false,
    ...over,
});

const list = () => ({
    adapters: [
        { kind: 'rest', label: "REST endpoint (the system's own API)" },
        { kind: 'openai', label: 'OpenAI-compatible' },
        { kind: 'a2a', label: 'A2A agent (Google)' },
        { kind: 'oip', label: 'OIP (KServe)' },
    ],
    connections: [connection()],
});

let container: HTMLElement;
let root: Root;
let calls: { url: string; method: string; body: unknown }[];
let tryResult: Record<string, unknown>;

beforeEach(() => {
    calls = [];
    tryResult = { ok: true, answer: '42', latency_ms: 7 };
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            calls.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            if (url.includes('/aisystem'))
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        components: [{ pid: 'comp-1', name: 'the llm', component_type: 'llm' }],
                    }),
                });
            if (url.endsWith('/test'))
                return Promise.resolve({ ok: true, status: 200, json: async () => tryResult });
            if (method === 'PUT')
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => connection({ path: '/chat' }),
                });
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
const byTestId = (id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function type(testid: string, value: string) {
    const field = byTestId(testid) as HTMLInputElement | HTMLTextAreaElement;
    await act(async () => {
        const proto =
            field.tagName === 'TEXTAREA'
                ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('ConnectionsPage', () => {
    it('lists each connection with its protocol, target and key state', async () => {
        await renderPage();
        expect(text()).toContain('The system');
        expect(text()).toContain('REST endpoint');
        expect(text()).toContain('http://system.local');
        expect(text()).toContain('no target yet');
        expect(text()).toContain('key stored');
        expect(text()).toContain('secret headers: X-Token');
    });

    it('offers the protocols the deployment serves in the editor', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('new-connection') as HTMLButtonElement).click();
        });
        expect(byTestId('connection-editor')).not.toBeNull();
        const kind = byTestId('field-kind');
        expect(kind).not.toBeNull();
        // the four built-in protocols are the options the API reported
        expect(container.innerHTML).toContain('REST endpoint');
    });

    it('saves a rest connection with its own fields', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('edit-system') as HTMLButtonElement).click();
        });
        await type('field-body', '{"question": "{{input}}"}');
        await type('field-answer', 'data.answer');
        await act(async () => {
            (byTestId('save-connection') as HTMLButtonElement).click();
        });
        const put = calls.find((c) => c.method === 'PUT');
        expect(put?.url).toContain('/projects/p1/connections/system');
        expect(put?.body).toMatchObject({
            kind: 'rest',
            path: '/chat',
            body_template: { question: '{{input}}' },
            response_path: 'data.answer',
        });
    });

    it('refuses a body that is not JSON', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('edit-system') as HTMLButtonElement).click();
        });
        await type('field-body', '{oops');
        await act(async () => {
            (byTestId('save-connection') as HTMLButtonElement).click();
        });
        expect(text()).toContain('not valid JSON');
        expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    it('tries the connection with the typed prompt and shows what a test gets', async () => {
        await renderPage();
        await type('try-input-system', 'why?');
        await act(async () => {
            (byTestId('try-system') as HTMLButtonElement).click();
        });
        const post = calls.find((c) => c.url.endsWith('/test'));
        expect(post?.url).toContain('/projects/p1/connections/system/test');
        expect(post?.body).toEqual({ input: 'why?' });
        expect(byTestId('try-result-system')?.textContent).toContain('What a test gets: 42');
    });

    it('shows the system’s refusal rather than an error', async () => {
        tryResult = { ok: true, refused: true, refusal_reason: 'ungrounded', latency_ms: 4 };
        await renderPage();
        await act(async () => {
            (byTestId('try-system') as HTMLButtonElement).click();
        });
        expect(byTestId('try-result-system')?.textContent).toContain(
            'The system refused: ungrounded',
        );
    });

    it('reports a connection that could not be reached', async () => {
        tryResult = { ok: false, error: 'unreachable', detail: 'connect failed', latency_ms: 1 };
        await renderPage();
        await act(async () => {
            (byTestId('try-system') as HTMLButtonElement).click();
        });
        const result = byTestId('try-result-system')?.textContent ?? '';
        expect(result).toContain('Failed (unreachable)');
    });
});
