// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import AssistantModelsSection from './AssistantModelsSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({ projectUUID: 'p1' }),
}));

const endpoints = [
    {
        pid: 'e1',
        name: 'judge',
        description: '',
        component_type: 'endpoint',
        data: '',
        file_size: null,
        url: 'https://models.example/v1',
        protocol: 'openai-chat',
        adapter: 'openai',
        preset: 'llm',
        has_secret: true,
    },
];

let container: HTMLElement;
let root: Root;

function mockFetch(patched: { body?: object }) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'PATCH' || init?.method === 'POST') {
            patched.body = JSON.parse(String(init.body));
            return Promise.resolve({
                ok: true, status: 200,
                json: async () => ({ pid: 'cfg1', key: 'ai_assistant', json_value: { type: 'string', value: 'e1' } }),
            });
        }
        if (url.includes('/endpoints')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => endpoints });
        }
        if (url.includes('/project/settings/')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => [] });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
}

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({}));
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

async function render() {
    await act(async () => { root.render(<AssistantModelsSection />); });
    await act(async () => {});
}

describe('AssistantModelsSection', () => {
    it('lists the project-level endpoints', async () => {
        await render();
        expect(document.body.textContent ?? '').toContain('judge');
        expect(document.body.textContent ?? '').toContain('https://models.example/v1');
    });

    it('writes the ai_assistant setting when a model is chosen', async () => {
        const patched: { body?: object } = {};
        vi.stubGlobal('fetch', mockFetch(patched));
        await render();
        const radio = document.body.querySelector(
            'input[aria-label="Use judge as the assistant model"]',
        ) as HTMLInputElement | null;
        expect(radio).toBeTruthy();
        await act(async () => { radio!.click(); });
        await act(async () => {});
        expect(patched.body).toEqual({
            category: 'variables', key: 'ai_assistant', name: 'AI assistant model',
            json_value: { type: 'string', value: 'e1' },
        });
    });
});
