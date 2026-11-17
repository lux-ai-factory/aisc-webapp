// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import EvidenceMapPage from './EvidenceMapPage';
import type { EvidenceMap } from '../lib/evidence';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
    }),
}));

const baseMap = (): EvidenceMap => ({
    version: { pid: 'v1', number: 2 },
    versions: [
        { pid: 'v1', number: 2 },
        { pid: 'v0', number: 1 },
    ],
    objectives: [
        {
            id: 'O1',
            title: 'objective one',
            dimension: 'technical-robustness-safety',
            expects: 'Control + Test',
            priority: true,
            stale: null,
            linked: false,
            risks: [],
            evidence: 'not covered',
        },
        {
            id: 'O2',
            title: 'objective two',
            dimension: 'transparency',
            expects: 'Control',
            priority: false,
            stale: null,
            linked: true,
            risks: [],
            evidence: 'evidence',
        },
    ],
    tests: [
        {
            key: 'fairness',
            label: 'Fairness',
            dimensions: [],
            stale: null,
            runs: { executed: 1, failed: 0, running: 0, latest_failed: false },
        },
    ],
    controls: [
        {
            key: 'cl1',
            label: 'risk-checklist',
            dimensions: [],
            stale: null,
            submission: { answered: 1, questions: 2, readiness: 75 },
        },
    ],
    links: [
        {
            objective_id: 'O2',
            kind: 'test',
            key: 'fairness',
            note: 'holds',
            created_at: '2026-10-01T00:00:00Z',
            created_by: 'someone-else',
        },
    ],
    coverage: { linked: 1, objectives: 2, gaps: 1 },
    review: null,
    can_edit: true,
    can_review: true,
    read_only: false,
    carried_from: null,
});

let container: HTMLElement;
let root: Root;
let current: EvidenceMap;
let calls: { url: string; method: string; body: unknown }[];

beforeEach(() => {
    current = baseMap();
    calls = [];
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            calls.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            if (method === 'POST') {
                current = { ...current, review: { reviewed_by: 'development', reviewed_by_name: 'development', reviewed_at: '2026-10-02T00:00:00Z' } };
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => current });
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
                <EvidenceMapPage />
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

const text = () => document.body.textContent ?? '';
const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('EvidenceMapPage', () => {
    it('renders the coverage summary, objectives and tiles', async () => {
        await renderPage();
        expect(text()).toContain('1 of 2 objectives linked');
        expect(text()).toContain('1 gaps');
        expect(text()).toContain('objective one');
        expect(text()).toContain('objective two');
        expect(text()).toContain('Fairness');
        expect(text()).toContain('Not covered');
    });

    it('hides linked objectives under Gaps only', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });
        expect(text()).toContain('objective one');
        expect(text()).not.toContain('objective two');
    });

    it('shows only priority objectives under Priority only', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('priority-only') as HTMLInputElement).click();
        });
        expect(text()).toContain('objective one');
        expect(text()).not.toContain('objective two');
    });

    it('links an unlinked cell through the API', async () => {
        await renderPage();
        const cell = byTestId('cell-O1-test-fairness') as HTMLElement;
        const button = cell.querySelector('button') as HTMLButtonElement;
        await act(async () => {
            button.click();
        });
        const put = calls.find((c) => c.method === 'PUT');
        expect(put).toBeTruthy();
        expect(put?.url).toContain('/projects/p1/evidence/links');
        expect((put?.body as { links: unknown[] }).links).toEqual([
            { objective_id: 'O2', kind: 'test', key: 'fairness', note: 'holds' },
            { objective_id: 'O1', kind: 'test', key: 'fairness', note: null },
        ]);
    });

    it('marks the map reviewed', async () => {
        await renderPage();
        await act(async () => {
            (byTestId('mark-reviewed') as HTMLButtonElement).click();
        });
        expect(calls.some((c) => c.method === 'POST' && c.url.includes('/evidence/review'))).toBe(true);
        expect(text()).toContain('Reviewed by development');
    });

    it('offers to copy a carried-forward map', async () => {
        current = { ...baseMap(), links: [], carried_from: 1 };
        await renderPage();
        const copy = byTestId('copy-carried') as HTMLButtonElement;
        expect(copy.textContent).toContain('Copy the v1 map');
    });
});
