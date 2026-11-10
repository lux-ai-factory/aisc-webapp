// Pure logic tests for the catalogue fuzzy search + tag filter helpers.
import { describe, it, expect } from 'vitest';
import {
    fuzzyScore,
    normalise,
    filterCatalogue,
    allTags,
    Catalogue,
} from './catalogue';

const cat: Catalogue = {
    plugins: [
        { package_name: 'strongreject', version: '1.0', source: 'registry', tags: ['red-team', 'jailbreak'] },
        { package_name: 'factcheck', version: '0.9', source: 'local', tags: ['accuracy', 'nlp'] },
    ],
    controls: [
        {
            catalogue_id: 'data-governance-checklist',
            title: 'Data Governance Checklist',
            source: 'AESIA',
            control_topic: 'Data Governance',
            question_count: 30,
            tags: ['Data Governance', 'AESIA', 'EU', 'ai-act'],
        },
        {
            catalogue_id: 'human-oversight-checklist',
            title: 'Human Oversight Checklist',
            source: 'AESIA',
            control_topic: 'Human Oversight',
            question_count: 25,
            tags: ['Human Oversight', 'AESIA', 'ES', 'ai-act'],
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
