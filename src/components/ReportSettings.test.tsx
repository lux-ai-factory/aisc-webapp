// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ReportSettings from './ReportSettings';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ default_format: 'html', default_sections: ['system'] }),
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

async function renderSettings() {
    await act(async () => {
        root.render(<ReportSettings projectPid="p1" />);
    });
    await act(async () => {});
}

describe('ReportSettings', () => {
    it('loads stored defaults and section checkboxes', async () => {
        await renderSettings();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Report settings');
        expect(text).toContain('system');
        expect(text).toContain('evaluations');
    });

    it('saves with PUT when Save is clicked', async () => {
        const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
            if ((init?.method ?? 'GET') === 'PUT') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        default_format: 'pdf',
                        default_sections: ['controls'],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ default_format: 'html', default_sections: ['system'] }),
            });
        });
        vi.stubGlobal('fetch', fetch);
        await renderSettings();
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Save'),
        );
        expect(save).toBeTruthy();
        await act(async () => {
            save!.click();
        });
        await act(async () => {});
        const puts = (fetch.mock.calls as [string, RequestInit][]).filter(
            ([, init]) => init?.method === 'PUT',
        );
        expect(puts.length).toBe(1);
        expect(puts[0][0]).toContain('/projects/p1/report-settings');
        expect(document.body.textContent ?? '').toContain('Report settings saved.');
    });
});
