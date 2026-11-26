import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanSections, getReportSettings, REPORT_SECTIONS, setReportSettings, uploadReportChart } from './report';

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

describe('chart upload errors', () => {
    it.each([
        [413, { detail: 'Report chart limit reached' }, 'HTTP 413): Report chart limit reached'],
        [502, { detail: 'Chart upload failed' }, 'HTTP 502): Chart upload failed'],
        [500, null, 'HTTP 500)'],
        [422, { detail: [{ msg: 'invalid' }] }, 'HTTP 422)'],
    ])('explains an HTTP %s failure', async (status, payload, message) => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ blob: async () => new Blob(['png']) })
            .mockResolvedValueOnce({ ok: false, status, json: async () => {
                if (payload === null) throw new SyntaxError('Not JSON');
                return payload;
            } }));
        await expect(uploadReportChart('p', 'r', 'data:image/png;base64,AA=='))
            .rejects.toThrow(`Could not upload report chart (${message}`);
    });
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
        await setReportSettings('p1', {
            default_format: 'pdf',
            default_sections: ['controls'],
            report_title: 'Report',
            subtitle: '2026',
            primary_color: '#000fdf',
            accent_color: '#ff007e',
            font: 'inter',
            font_size_pt: 11,
            header_text: '',
            footer_text: '',
            marking: 'none',
            show_document_id: false,
            logo: null,
        });
        const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/projects/p1/report-settings');
        expect(init.method).toBe('PUT');
        expect(JSON.parse(init.body as string)).toEqual({
            default_format: 'pdf',
            default_sections: ['controls'],
            report_title: 'Report',
            subtitle: '2026',
            primary_color: '#000fdf',
            accent_color: '#ff007e',
            font: 'inter',
            font_size_pt: 11,
            header_text: '',
            footer_text: '',
            marking: 'none',
            show_document_id: false,
            logo: null,
        });
    });
});

describe('cleanSections', () => {
    it('drops unknown section keys', () => {
        expect(cleanSections(['system', 'nope', 'evaluations'])).toEqual(['system', 'evaluations']);
        expect(REPORT_SECTIONS).toEqual(['system', 'controls', 'objectives', 'evaluations', 'dashboard']);
    });
});
