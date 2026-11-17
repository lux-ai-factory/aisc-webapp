// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import EvidenceHub from './EvidenceHub';

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

vi.mock('../lib/overview', () => ({
    getOverview: async () => ({ latestCardVersion: 3 }),
}));

// two reports, out of order on purpose: the page sorts newest first
const reports = [
    {
        pid: 'r-old',
        project_id: 'p1',
        period: '',
        format: 'docx',
        file_ref: 'x',
        status: 'generated',
        created_at: '2026-09-01T10:00:00Z',
        system_version: { pid: 'v1', number: 2, name: 'v2' },
    },
    {
        pid: 'r-new',
        project_id: 'p1',
        period: '',
        format: 'pdf',
        file_ref: 'x',
        status: 'generated',
        created_at: '2026-10-02T10:00:00Z',
        system_version: { pid: 'v2', number: 3, name: 'v3' },
    },
];

function ok(json: unknown, status = 200) {
    return Promise.resolve({ ok: status < 300, status, json: async () => json });
}

function installFetch(payload: unknown = reports) {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('/projects/p1/reports')) return ok(payload);
            return ok({});
        }),
    );
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    installFetch();
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
            <MemoryRouter initialEntries={['/projects/demo/evidence']}>
                <Routes>
                    <Route path="/projects/:project_name/evidence" element={<EvidenceHub />} />
                </Routes>
            </MemoryRouter>,
        );
    });
    await act(async () => {});
}

const text = () => document.body.textContent ?? '';
const historyCards = () =>
    Array.from(
        (container.querySelector('[data-testid="report-history"]') ?? container).querySelectorAll(
            '.brand-step-svc',
        ),
    ).map((el) => el.textContent);

describe('EvidenceHub report history', () => {
    it('lists past reports with the AI-card version each snapshotted, newest first', async () => {
        await renderPage();
        expect(container.querySelector('[data-testid="report-history"]')).not.toBeNull();
        expect(historyCards()).toEqual(['AI card v3', 'AI card v2']);
        expect(text()).toContain('PDF · 2026-10-02');
        expect(text()).toContain('DOCX · 2026-09-01');
    });

    it('says so when the project has no report yet', async () => {
        installFetch([]);
        await renderPage();
        expect(container.querySelector('[data-testid="report-history-empty"]')).not.toBeNull();
        expect(text()).toContain('No report has been generated');
    });

    it('shows the latest card version in the header', async () => {
        await renderPage();
        expect(text()).toContain('AI card v3');
    });
});
