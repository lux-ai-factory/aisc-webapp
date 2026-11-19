// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ReportSettings, { ReportSettingsDraft } from './ReportSettings';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const value: ReportSettingsDraft = {
    default_format: 'html',
    default_sections: ['system'],
    report_title: 'Annual assessment',
    subtitle: '2026',
    primary_color: '#112233',
    accent_color: '#445566',
    font: 'roboto',
    font_size_pt: 12,
    header_text: 'ACME internal',
    footer_text: 'Confidential',
    marking: 'confidential',
    show_document_id: true,
    logo: null,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
});

async function renderSettings(onChange = vi.fn()) {
    await act(async () => {
        root.render(<ReportSettings value={value} onChange={onChange} />);
    });
    await act(async () => {});
    return onChange;
}

describe('ReportSettings', () => {
    it('shows the current customisation and defaults', async () => {
        await renderSettings();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Customisation');
        expect(text).toContain('Report title');
        expect(text).toContain('Primary colour');
        expect(text).toContain('Look and page');
        expect(text).toContain('Font');
        expect(text).toContain('Marking');
        expect(text).toContain('Show document id and fingerprint');
        expect(text).toContain('Format and sections');
        expect(text).toContain('system');
        expect(text).toContain('evaluations');
        expect(document.querySelector('input[value="Annual assessment"]')).toBeTruthy();
        expect(document.querySelector('input[value="2026"]')).toBeTruthy();
    });

    it('reports look edits through onChange', async () => {
        const onChange = await renderSettings();
        const marking = Array.from(document.body.querySelectorAll('input')).find(
            (i) => i.value === 'confidential',
        ) as HTMLInputElement | null;
        expect(marking).toBeTruthy();
        expect(marking!.value).toBe('confidential');
        // the show-document-id checkbox toggles the flag in the draft
        const boxes = Array.from(document.body.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        const showId = boxes.find((b) => (b.closest('label')?.textContent ?? '').includes('document id')) as HTMLInputElement;
        expect(showId).toBeTruthy();
        await act(async () => {
            showId.click();
        });
        const calls = onChange.mock.calls;
        const last = calls[calls.length - 1][0] as ReportSettingsDraft;
        expect(last.show_document_id).toBe(false);
        expect(last.font).toBe('roboto');
    });
});
