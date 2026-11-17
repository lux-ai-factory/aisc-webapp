import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    cleanSections,
    generateReport,
    getReportSettings,
    listReportLayouts,
    previewReportLayout,
    reportDownloadUrl,
    REPORT_FORMATS,
    REPORT_SECTIONS,
    setReportSettings,
    updateReportLayout,
} from './report';

function mockFetchOnce(payload: unknown, status = 200) {
    const fn = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('report settings api', () => {
    it('reads settings with GET', async () => {
        const fetch = mockFetchOnce({ default_format: 'html', default_sections: ['system'] });
        const out = await getReportSettings('p1');
        expect(out?.default_format).toBe('html');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/report-settings'),
            expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
        );
    });

    it('returns null when no settings exist yet', async () => {
        mockFetchOnce({ detail: 'missing' }, 404);
        await expect(getReportSettings('p1')).resolves.toBeNull();
    });

    it('rethows non-404 errors', async () => {
        mockFetchOnce({ detail: 'denied' }, 403);
        await expect(getReportSettings('p1')).rejects.toThrow('403');
    });

    it('saves settings with PUT', async () => {
        const fetch = mockFetchOnce({ default_format: 'pdf', default_sections: [] });
        await setReportSettings('p1', { default_format: 'pdf', default_sections: ['controls'] });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/report-settings');
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body as string)).toEqual({
            default_format: 'pdf',
            default_sections: ['controls'],
        });
    });
});

describe('cleanSections', () => {
    it('drops unknown section keys', () => {
        expect(cleanSections(['system', 'nope', 'evaluations'])).toEqual(['system', 'evaluations']);
        expect(REPORT_SECTIONS).toEqual(['system', 'controls', 'objectives', 'evaluations']);
    });
});

describe('report layouts api', () => {
    it('lists layouts with GET', async () => {
        const fetch = mockFetchOnce([{ id: 'builtin-summary', name: 'Summary', built_in: true }]);
        const out = await listReportLayouts('p1');
        expect(out[0]!.id).toBe('builtin-summary');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/projects/p1/report-layouts'),
            expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
        );
    });

    it('updates a layout with PUT and its blocks', async () => {
        const fetch = mockFetchOnce({ id: 'L1', revision: 2 });
        await updateReportLayout('p1', 'L1', { name: 'Mine', blocks: [] });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/report-layouts/L1');
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body as string)).toMatchObject({ name: 'Mine', blocks: [] });
    });

    it('previews a layout with POST', async () => {
        const fetch = mockFetchOnce({ html: '<html></html>', outline: [], layout: {} });
        await previewReportLayout('p1', 'builtin-summary', { version_pid: 'v1' });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/report-layouts/builtin-summary/preview');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toMatchObject({ version_pid: 'v1' });
    });
});

describe('report generation api', () => {
    it('sends the layout and version on generate', async () => {
        const fetch = mockFetchOnce({ pid: 'r1' });
        await generateReport('p1', {
            period: '2026-Q3',
            format: 'docx',
            evaluation_pids: [],
            sections: ['system'],
            layout_id: 'builtin-summary',
            version_pid: 'v1',
        });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/reports/generate');
        expect(JSON.parse(init.body as string)).toMatchObject({
            format: 'docx',
            layout_id: 'builtin-summary',
            version_pid: 'v1',
        });
    });

    it('downloads through the /download endpoint and offers PDF and Word', () => {
        expect(reportDownloadUrl('p1', 'r1')).toContain('/projects/p1/reports/r1/download');
        expect(REPORT_FORMATS).toEqual(['pdf', 'docx']);
    });
});
