// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import AISystemSettings from './AISystemSettings';

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

const components = [
    {
        pid: 'c1',
        name: 'Model A',
        description: '',
        component_type: 'model',
        data: 'model.bin',
        file_size: 10,
    },
];

let container: HTMLElement;
let root: Root;

function mockFetch(deleted: { value: boolean }) {
    return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
            deleted.value = true;
            return Promise.resolve({ ok: true, status: 204, json: async () => undefined });
        }
        if (url.includes('/aisystem')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({
                    pid: 's1',
                    name: 'System',
                    components: deleted.value ? [] : components,
                }),
            });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
}

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ value: false }));
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

async function renderSettings() {
    await act(async () => {
        root.render(<AISystemSettings />);
    });
    await act(async () => {});
}

describe('AISystemSettings component cards', () => {
    it('deletes a component only after confirmation', async () => {
        const deleted = { value: false };
        const fetch = mockFetch(deleted);
        vi.stubGlobal('fetch', fetch);
        await renderSettings();

        const del = document.body.querySelector(
            'button[aria-label="Delete Model A"]',
        ) as HTMLButtonElement | null;
        expect(del).toBeTruthy();
        await act(async () => {
            del!.click();
        });
        expect(document.body.textContent ?? '').toContain('Delete component');
        expect(document.body.textContent ?? '').toContain('cannot be undone');
        expect(deleted.value).toBe(false);

        const confirm = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').trim() === 'Delete',
        );
        expect(confirm).toBeTruthy();
        await act(async () => {
            confirm!.click();
        });
        await act(async () => {});

        const call = (fetch.mock.calls as [string, RequestInit?][]).find(
            ([, init]) => init?.method === 'DELETE',
        );
        expect(call?.[0]).toContain('/components/c1');
        expect(document.body.textContent ?? '').not.toContain('Model A');
    });
});
