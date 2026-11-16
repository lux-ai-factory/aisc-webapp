// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import ProjectHome from './ProjectHome';

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

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1/qualification')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [
                        {
                            pid: 'd1', questionnaire_id: 'q1', answers: {}, status: 'completed',
                            system_card: { format: 'airo-min' },
                            system_version: { number: 1 },
                        },
                    ],
                });
            }
            if (url.includes('/questionnaires/projects/p1')) {
                return Promise.resolve({ ok: true, json: async () => [{ pid: 'q1' }] });
            }
            if (url.includes('/assessment-coverage')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ objectives: [{}, {}], key_objectives: 1, key_covered: 1 }),
                });
            }
            if (url.endsWith('/projects/p1/controls')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [{ pid: 'cl1', question_count: 5 }],
                });
            }
            if (url.includes('/submissions')) {
                return Promise.resolve({ ok: true, json: async () => [{ pid: 's1' }] });
            }
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        plugins: [{ name: 'a', display_name: 'A', enabled: true, config: null }],
                        components: [{ component_type: 'model' }, { component_type: 'dataset' }],
                    }),
                });
            }
            throw new Error(`unexpected fetch: ${url}`);
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

async function renderHome() {
    await act(async () => {
        root.render(
            <MemoryRouter>
                <ProjectHome />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

describe('ProjectHome overview (W7)', () => {
    it('renders card, qualification, coverage, ratios and sandbox state', async () => {
        await renderHome();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Overview');
        expect(text).toContain('v1 built');
        expect(text).toContain('1/1 key covered');
        expect(text).toContain('1/1 configured');
        expect(text).toContain('0/1 configured');
        expect(text).toContain('ready (1 model(s), 1 dataset(s))');
    });

    it('links sections to their pages', async () => {
        await renderHome();
        const hrefs = Array.from(document.body.querySelectorAll('a')).map((a) =>
            a.getAttribute('href'),
        );
        expect(hrefs).toContain('/projects/demo/qualification');
        expect(hrefs).toContain('/projects/demo/checklists');
        expect(hrefs).toContain('/projects/demo/sandbox');
    });
});
