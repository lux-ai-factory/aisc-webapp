// Pure logic tests for the catalogue fuzzy search + tag filter helpers.
import { describe, it, expect } from 'vitest';
import {
    fuzzyScore,
    normalise,
    filterCatalogue,
    allTags,
    inDimensions,
    unmatchedByDimensions,
    childrenOf,
    Catalogue,
    CatalogueControl,
    CatalogueSubdimension,
} from './catalogue';

const cat: Catalogue = {
    plugins: [
        {
            package_name: 'strongreject',
            version: '1.0',
            source: 'registry',
            tags: ['red-team', 'jailbreak'],
            // the catalogue's test item names the package and its dimension
            dimensions: ['technical-robustness-safety'],
        },
        {
            package_name: 'factcheck',
            version: '0.9',
            source: 'local',
            tags: ['accuracy', 'nlp'],
            dimensions: ['diversity-non-discrimination-fairness'],
        },
    ],
    controls: [
        {
            catalogue_id: 'data-governance-checklist',
            title: 'Data Governance Checklist',
            source: 'AESIA',
            control_topic: 'Data Governance',
            question_count: 30,
            tags: ['Data Governance', 'AESIA', 'EU', 'ai-act'],
            dimensions: ['privacy-data-governance'],
        },
        {
            catalogue_id: 'human-oversight-checklist',
            title: 'Human Oversight Checklist',
            source: 'AESIA',
            control_topic: 'Human Oversight',
            question_count: 25,
            tags: ['Human Oversight', 'AESIA', 'ES', 'ai-act'],
            // a sub-dimension is folded into the dimension it belongs to
            dimensions: ['human-agency-oversight', 'supervisory-control'],
        },
    ],
};

describe('normalise', () => {
    it('lowercases and collapses punctuation', () => {
        expect(normalise('Data-Governance!')).toBe('data governance');
    });
});

describe('fuzzyScore', () => {
    it('scores exact and prefix wins higher than subsequence', () => {
        expect(fuzzyScore('data governance', 'Data Governance Checklist')).toBe(80); // startsWith
        expect(fuzzyScore('dgov', 'Data Governance Checklist')).toBeGreaterThan(0); // subsequence
        expect(fuzzyScore('zzz', 'Data Governance Checklist')).toBe(0); // no match
    });

    it('empty query matches nothing', () => {
        expect(fuzzyScore('', 'anything')).toBe(0);
    });

    it('matches ACL-style acronyms fuzzily', () => {
        expect(fuzzyScore('hr', 'Human Oversight')).toBeGreaterThan(0);
    });
});

describe('filterCatalogue', () => {
    it('keeps nothing with an empty query and no tags', () => {
        const out = filterCatalogue({ plugins: [], controls: [] }, '', []);
        expect(out.plugins).toEqual([]);
        expect(out.controls).toEqual([]);
    });

    it('fuzzy matches controls by title across punctation', () => {
        const out = filterCatalogue(cat, 'data governance', []);
        expect(out.controls.map((c) => c.catalogue_id)).toEqual(['data-governance-checklist']);
    });

    it('fuzzy matches plugins by fuzzy acronym', () => {
        const out = filterCatalogue(cat, 'reject', [], 'plugins');
        expect(out.plugins.map((p) => p.package_name)).toEqual(['strongreject']);
    });

    it('filters by selected tag', () => {
        const out = filterCatalogue(cat, '', ['ai-act'], 'controls');
        expect(out.controls).toHaveLength(2);
    });

    it('requires ALL selected tags to hit', () => {
        const out = filterCatalogue(cat, '', ['ai-act', 'Human Oversight'], 'controls');
        expect(out.controls.map((c) => c.catalogue_id)).toEqual(['human-oversight-checklist']);
    });

    it('only returns the requested kind', () => {
        const pluginsOnly = filterCatalogue(cat, '', [], 'plugins');
        expect(pluginsOnly.plugins).not.toHaveLength(0);
        expect(pluginsOnly.controls).toHaveLength(0);
    });
});

describe('allTags', () => {
    it('collects distinct tags from both kinds, deduped and sorted', () => {
        const tags = allTags(cat.plugins, cat.controls);
        expect(tags).toContain('red-team');
        expect(tags).toContain('Data Governance');
        // dedup: AIES appears once, sorted case-insensitively-ish
        expect(tags.filter((t) => normalise(t) === normalise('AESIA'))).toHaveLength(1);
    });
});

describe('inDimensions', () => {
    const item = (dimensions?: string[]): CatalogueControl => ({
        catalogue_id: 'c', title: 'C', source: 'S', control_topic: 'T',
        question_count: 1, dimensions,
    });

    it('no filter keeps everything', () => {
        expect(inDimensions(item([]), [])).toBe(true);
    });

    it('matches any of the item\'s dimensions', () => {
        expect(inDimensions(item(['risk-management']), ['transparency', 'risk-management'])).toBe(true);
        expect(inDimensions(item(['transparency']), ['risk-management'])).toBe(false);
    });

    it('an item with no dimension at all never matches', () => {
        expect(inDimensions(item(undefined), ['transparency'])).toBe(false);
    });
});

describe('filterCatalogue by dimension', () => {
    it('keeps the controls of the project\'s dimensions', () => {
        const out = filterCatalogue(cat, '', [], 'controls', ['privacy-data-governance']);
        expect(out.controls.map((c) => c.catalogue_id)).toEqual(['data-governance-checklist']);
    });

    it('a sub-dimension counts for its parent', () => {
        const out = filterCatalogue(
            cat, '', [], 'controls', ['human-agency-oversight'],
        );
        expect(out.controls.map((c) => c.catalogue_id)).toEqual(['human-oversight-checklist']);
    });

    it('narrows plugins by their catalogue test item\'s dimensions', () => {
        const out = filterCatalogue(cat, '', [], 'all', ['privacy-data-governance']);
        expect(out.controls).toHaveLength(1);
        expect(out.plugins).toHaveLength(0);
    });

    it('a plugin the catalogue does not list is kept under a filter and marked', () => {
        const unlisted: Catalogue = {
            ...cat,
            plugins: [{ package_name: 'ours', version: '1.0', source: 'local' }],
        };
        const filtered = filterCatalogue(
            unlisted, '', [], 'plugins', ['privacy-data-governance'],
        ).plugins;
        expect(filtered).toHaveLength(1);
        expect(unmatchedByDimensions(filtered[0], ['privacy-data-governance'])).toBe(true);
        expect(filterCatalogue(unlisted, '', [], 'plugins', []).plugins).toHaveLength(1);
        expect(unmatchedByDimensions(filtered[0], [])).toBe(false);
    });

    it('no dimensions means no narrowing', () => {
        const out = filterCatalogue(cat, '', [], 'controls', []);
        expect(out.controls).toHaveLength(2);
    });
});

describe('childrenOf', () => {
    const tree: CatalogueSubdimension[] = [
        { slug: 'supervisory-control', label: 'Supervisory control', parent: 'human-agency-oversight' },
        { slug: 'bias-auditing', label: 'Bias auditing', parent: 'diversity-non-discrimination-fairness' },
        { slug: 'human-fallback', label: 'Human fallback', parent: 'human-agency-oversight' },
    ];

    it('returns the children of one dimension, in the catalogue\'s order', () => {
        expect(childrenOf(tree, 'human-agency-oversight').map((c) => c.slug))
            .toEqual(['supervisory-control', 'human-fallback']);
    });

    it('a dimension with no children, or no tree at all, yields nothing', () => {
        expect(childrenOf(tree, 'transparency')).toEqual([]);
        expect(childrenOf(undefined, 'transparency')).toEqual([]);
    });
});
