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
    // Four objectives, as the map really returns them, so each filter is pinned by
    // the row set it leaves rather than by one row surviving both: O1 a priority
    // gap, O2 covered and not priority, O3 covered and priority, and O4 no longer
    // selected by this version yet still named by a saved link (so it is on the map
    // marked stale, and the pilot does not count it as a gap either).
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
        {
            id: 'O3',
            title: 'objective three',
            dimension: 'transparency',
            expects: 'Test',
            priority: true,
            stale: null,
            linked: true,
            risks: [],
            evidence: 'evidence',
        },
        {
            id: 'O4',
            title: 'objective four',
            dimension: 'transparency',
            expects: 'Control',
            priority: false,
            stale: 'not selected',
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
        {
            objective_id: 'O3',
            kind: 'control',
            key: 'cl1',
            note: 'the checklist holds it',
            created_at: '2026-10-01T00:00:00Z',
            created_by: 'development',
        },
        {
            objective_id: 'O4',
            kind: 'test',
            key: 'fairness',
            note: 'kept from the version above',
            created_at: '2026-10-01T00:00:00Z',
            created_by: 'development',
        },
    ],
    coverage: { linked: 3, objectives: 4, gaps: 1 },
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

/** The objective rows on screen, in order — what the two filters leave. */
const rows = () =>
    Array.from(container.querySelectorAll('[data-testid^="objective-row-"]')).map((row) =>
        (row.getAttribute('data-testid') ?? '').replace('objective-row-', ''),
    );

describe('EvidenceMapPage', () => {
    it('renders the coverage summary, every objective and the tiles', async () => {
        await renderPage();
        expect(text()).toContain('3 of 4 objectives linked');
        expect(text()).toContain('1 gaps');
        expect(rows()).toEqual(['O1', 'O2', 'O3', 'O4']);
        expect(text()).toContain('objective four');
        expect(text()).toContain('Fairness');
        expect(text()).toContain('Not covered');
    });

    it('hides everything but the gaps under Gaps only', async () => {
        await renderPage();

        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });

        // O1 is unlinked and still selected: the one gap. O2 and O3 are linked,
        // and O4 is stale (the version no longer selects it), so the pilot does not
        // count it as a gap even though a saved link still names it.
        expect(rows()).toEqual(['O1']);
        expect(byTestId('objective-row-O4')).toBeNull();
    });

    it('leaves only the priority objectives under Priority only', async () => {
        await renderPage();

        await act(async () => {
            (byTestId('priority-only') as HTMLInputElement).click();
        });

        // The priority objectives, covered or not: O1 and O3, not O2/O4.
        expect(rows()).toEqual(['O1', 'O3']);
    });

    it('narrows to the priority gaps under both filters', async () => {
        await renderPage();

        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });
        await act(async () => {
            (byTestId('priority-only') as HTMLInputElement).click();
        });
        expect(rows()).toEqual(['O1']);

        // and turning Gaps only back off leaves the priority objectives again
        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });
        expect(rows()).toEqual(['O1', 'O3']);
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
            { objective_id: 'O3', kind: 'control', key: 'cl1', note: 'the checklist holds it' },
            { objective_id: 'O4', kind: 'test', key: 'fairness', note: 'kept from the version above' },
            { objective_id: 'O1', kind: 'test', key: 'fairness', note: null },
        ]);
    });

    it('saves a note on a link and can unlink it', async () => {
        await renderPage();

        await act(async () => {
            (byTestId('cell-O2-test-fairness')!.querySelector('button') as HTMLButtonElement).click();
        });
        const note = byTestId('link-note') as HTMLTextAreaElement;
        expect(byTestId('link-panel')).not.toBeNull();
        expect(note.value).toBe('holds');

        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        await act(async () => {
            setter.call(note, 'a pass is recall above 0.9');
            note.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            (byTestId('save-note') as HTMLButtonElement).click();
        });
        let put = calls.filter((c) => c.method === 'PUT').pop();
        expect((put?.body as { links: { objective_id: string; note: string }[] }).links).toContainEqual(
            { objective_id: 'O2', kind: 'test', key: 'fairness', note: 'a pass is recall above 0.9' },
        );

        // saving closes the panel, so open it again to unlink
        await act(async () => {
            (byTestId('cell-O2-test-fairness')!.querySelector('button') as HTMLButtonElement).click();
        });
        await act(async () => {
            (byTestId('unlink') as HTMLButtonElement).click();
        });
        put = calls.filter((c) => c.method === 'PUT').pop();
        const links = (put?.body as { links: { objective_id: string }[] }).links;
        expect(links.map((l) => l.objective_id)).toEqual(['O3', 'O4']);
    });

    it('shows what the platform refused, and keeps the map as it was', async () => {
        await renderPage();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                json: async () => ({ detail: 'no installed test fairness' }),
            }),
        );
        await act(async () => {
            (byTestId('cell-O1-test-fairness')!.querySelector('button') as HTMLButtonElement).click();
        });
        expect((byTestId('evidence-message') as HTMLElement).textContent).toContain(
            'no installed test fairness',
        );
        expect(rows()).toEqual(['O1', 'O2', 'O3', 'O4']);
    });

    it('lets a viewer read the map and the filters, but write nothing', async () => {
        current = { ...baseMap(), can_edit: false, can_review: false };
        await renderPage();

        // the filters are read-only tools: they still narrow the map
        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });
        expect(rows()).toEqual(['O1']);
        await act(async () => {
            (byTestId('gaps-only') as HTMLInputElement).click();
        });

        // a linked cell opens the panel, with the note readable and no writes
        await act(async () => {
            (byTestId('cell-O2-test-fairness')!.querySelector('button') as HTMLButtonElement).click();
        });
        expect(byTestId('link-panel')).not.toBeNull();
        expect((byTestId('link-note') as HTMLTextAreaElement).disabled).toBe(true);
        expect(byTestId('save-note')).toBeNull();
        expect(byTestId('unlink')).toBeNull();

        // an unlinked cell is not a button at all, and nothing is sent
        expect(byTestId('cell-O1-test-fairness')!.querySelector('button')).toBeNull();
        expect(byTestId('mark-reviewed')).toBeNull();
        expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
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
