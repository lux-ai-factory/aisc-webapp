// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CataloguePage from './CataloguePage';

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

const CATALOGUE = {
    plugins: [
        {
            package_name: 'aisc-plugin-fairness',
            plugin_name: 'FairnessPlugin',
            display_name: 'Fairness',
            display_icon: 'balance',
            version: '1.0',
            source: 'local',
            tags: [],
        },
    ],
    controls: [
        {
            catalogue_id: 'human-oversight-checklist',
            title: 'Human Oversight Checklist',
            source: 'AESIA',
            control_topic: 'Human Oversight',
            question_count: 25,
            tags: ['Human Oversight'],
            dimensions: ['human-agency-oversight'],
        },
        {
            catalogue_id: 'risk-management-checklist',
            title: 'Risk Management Checklist',
            source: 'AESIA',
            control_topic: 'Risk Management',
            question_count: 12,
            tags: ['Risk Management'],
            dimensions: ['risk-management'],
        },
    ],
    dimensions: [
        { requirement: 'REQ1', slug: 'human-agency-oversight', label: 'Human Agency and Oversight' },
        { requirement: 'REQ9', slug: 'risk-management', label: 'Risk Management' },
    ],
    app_catalog_url: 'https://sandboxconfigurator.aifactory.lu/catalogue',
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/catalogue')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => CATALOGUE,
                });
            }
            if (url.endsWith('/projects/p1/controls')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => [] });
            }
            if (url.endsWith('/projects/p1/control-objectives/dimensions')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        objectives: ['O1'],
                        dimensions: ['human-agency-oversight'],
                    }),
                });
            }
            if (url.endsWith('/projects/p1')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        pid: 'p1',
                        name: 'demo',
                        plugins: [
                            {
                                pid: 'pl1',
                                name: 'FairnessPlugin',
                                package_name: 'aisc-plugin-fairness',
                                enabled: true,
                            },
                        ],
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

async function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
        root.render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <CataloguePage />
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });
    await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
    });
}

describe('CataloguePage', () => {
    it('combines tests and checklists with counts and manage links', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Catalogue');
        expect(text).toContain('Tests installed');
        expect(text).toContain('Checklists installed');
        expect(text).toContain('Explore catalogue');
        const hrefs = Array.from(document.body.querySelectorAll('a')).map((a) =>
            a.getAttribute('href'),
        );
        expect(hrefs).toContain('/projects/demo/plugins');
        expect(hrefs).toContain('/projects/demo/checklists');
    });

    it('links the independently published catalogue', async () => {
        await renderPage();
        const hrefs = Array.from(document.body.querySelectorAll('a')).map((a) =>
            a.getAttribute('href'),
        );
        expect(hrefs).toContain('https://sandboxconfigurator.aifactory.lu/catalogue');
    });

    it('offers the catalogue of the project\'s own dimensions first', async () => {
        await renderPage();
        const explore = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Explore catalogue'),
        ) as HTMLElement;
        await act(async () => explore.click());
        await act(async () => {
            await new Promise((r) => setTimeout(r, 30));
        });
        const titles = Array.from(document.body.querySelectorAll('.MuiTypography-subtitle1')).map(
            (el) => el.textContent,
        );
        expect(titles).toContain('Human Oversight Checklist');
        expect(titles).not.toContain('Risk Management Checklist');
        expect(document.body.textContent).toContain('For this project');
    });
});
