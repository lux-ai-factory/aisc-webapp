/**
 * One catalogue surface in the UI too (CAT-01).
 *
 * The pilot had a catalogue page, a separate plugin "explore" view built from a
 * second listing, and installs through both. The unified app must have one: one
 * route, one module that reads the listing, one module that installs from it, one
 * component that explores it (reused wherever a catalogue is opened). Everything
 * that could drift is read out of the source tree here, so adding a second
 * catalogue page — or a second listing call — fails this test rather than ships
 * as a parallel path.
 *
 * `/projects/{pid}/control-objectives/catalogue` is a different catalogue (the
 * AI Act objectives, QUAL-01) and is deliberately not counted.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');
/** where the catalogue is opened today; a new site must be a deliberate change */
const OPENING_PAGES = [
    'pages/CataloguePage.tsx',
    'pages/ChecklistsPage.tsx',
    'pages/Plugins.tsx',
];

function sourceFiles(dir: string = SRC): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        if (!/\.tsx?$/.test(entry)) return [];
        if (/\.test\.tsx?$/.test(entry)) return [];
        return [path];
    });
}

const files = sourceFiles().map((path) => ({
    path: relative(SRC, path),
    body: readFileSync(path, 'utf8'),
}));

const paths = (list: typeof files) => list.map((f) => f.path).sort();

describe('the catalogue surface', () => {
    it('lists the catalogue from exactly one module', () => {
        const readers = files.filter((f) => /request<Catalogue>\(\s*['"`]\/catalogue['"`]/.test(f.body));
        expect(paths(readers)).toEqual(['lib/checklists.ts']);
    });

    it('installs through exactly one module', () => {
        const installers = files.filter((f) => /\/catalogue\/installs/.test(f.body));
        expect(paths(installers)).toEqual([
            'components/CatalogueExploreDialog.tsx',
            'lib/checklists.ts',
        ]);
    });

    it('has exactly one route that renders a catalogue', () => {
        const routes = files.filter((f) =>
            /path:\s*['"`]\/projects\/:project_name\/catalogue['"`]/.test(f.body),
        );
        expect(paths(routes)).toEqual(['MyApp.tsx']);
    });

    it('implements the exploration UI in exactly one component', () => {
        // the dialog itself: one component, given the catalogue as a prop
        const implementers = files.filter(
            (f) => f.path.startsWith('components/') && /Catalogue/.test(f.path),
        );
        expect(paths(implementers)).toEqual(['components/CatalogueExploreDialog.tsx']);
        expect(files.find((f) => f.path === 'components/CatalogueExploreDialog.tsx')?.body)
            .toMatch(/export default function CatalogueExploreDialog/);
    });

    it('reuses that component wherever a catalogue is opened', () => {
        const reusers = files.filter((f) => /import CatalogueExploreDialog from/.test(f.body));
        expect(paths(reusers)).toEqual(OPENING_PAGES);
    });
});
