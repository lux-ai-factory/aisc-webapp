// @vitest-environment jsdom
// CAT-01: "For this project" — the catalogue the project is offered is the one
// about its own objectives' dimensions. On by default, and a project that has
// selected nothing yet is told it is seeing everything.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import CatalogueExploreDialog from './CatalogueExploreDialog';
import { Catalogue } from '../lib/catalogue';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOGUE: Catalogue = {
    plugins: [],
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
    app_catalog_url: '',
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => [],
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

function render(projectDimensions?: string[]) {
    act(() => {
        root.render(
            <CatalogueExploreDialog
                open
                onClose={() => {}}
                projectPid="p1"
                kind="control"
                catalogue={CATALOGUE}
                loading={false}
                projectDimensions={projectDimensions}
            />,
        );
    });
}

const titles = () =>
    Array.from(document.body.querySelectorAll('.MuiTypography-subtitle1')).map(
        (el) => el.textContent,
    );

describe('CatalogueExploreDialog "For this project"', () => {
    it('is on by default and keeps only the project\'s dimensions', () => {
        render(['human-agency-oversight']);
        expect(document.body.textContent).toContain('For this project');
        expect(titles()).toEqual(['Human Oversight Checklist']);
    });

    it('off, it shows the whole catalogue again', () => {
        render(['human-agency-oversight']);
        const toggle = document.body.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        act(() => toggle.click());
        expect(titles()).toEqual([
            'Human Oversight Checklist',
            'Risk Management Checklist',
        ]);
    });

    it('says so when the project has selected no objectives yet', () => {
        render([]);
        expect(document.body.textContent).toContain(
            'No control objectives selected yet: showing everything.',
        );
        expect(titles()).toHaveLength(2);
    });

    it('offers no switch when the caller has no project', () => {
        render(undefined);
        expect(document.body.textContent).not.toContain('For this project');
    });

    it('the dimension chips narrow the list on their own', () => {
        render([]);
        const chip = Array.from(document.body.querySelectorAll('.MuiChip-label')).find(
            (el) => el.textContent === 'Risk Management',
        ) as HTMLElement;
        act(() => chip.click());
        expect(titles()).toEqual(['Risk Management Checklist']);
    });
});
