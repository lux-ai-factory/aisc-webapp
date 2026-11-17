/**
 * Catalogue item shapes + client-side fuzzy search and tag filtering.
 *
 * The backend's `GET /catalogue` already returns the items with their `tags`
 * (control_topic/source/scope codes from the seeded templates, plugin source);
 * this module does the user-facing matching on the client — fuzzy matching on
 * name/title/source and filtering by selected tags — so the whole catalogue
 * stays useful without hammering the API per keystroke.
 */

export interface CataloguePlugin {
    package_name: string;
    /** The BaseEvaluationPlugin class inside the package (empty = package-level). */
    plugin_name?: string;
    /** The plugin's user-facing display name (empty = falls back to class/package name). */
    display_name?: string;
    /** The plugin's own material-icon name (empty = default shown). */
    display_icon?: string;
    version: string;
    source: string;
    tags?: string[];
    /**
     * The dimensions the package's catalogue test item is tagged with. The
     * loader carries none, so the backend reads them from the hosted
     * catalogue's `type: test` item; empty for a package it does not list.
     */
    dimensions?: string[];
    /** The item's own sub-dimensions (the tree's children). */
    subdimensions?: string[];
}

export interface CatalogueControl {
    catalogue_id: string;
    title: string;
    source: string;
    control_topic: string;
    country_ids?: string[];
    regulation_ids?: string[];
    question_count: number;
    tags?: string[];
    /**
     * The catalogue's trustworthiness-dimension slugs this item is tagged with.
     * A sub-dimension is folded into the dimension it belongs to, so an item
     * tagged only `purpose-limitation` still carries `privacy-data-governance`.
     */
    dimensions?: string[];
    /** The item's own sub-dimensions (the tree's children). */
    subdimensions?: string[];
}

/** One trustworthiness dimension: the objective requirement it comes from. */
export interface CatalogueDimension {
    requirement: string; // REQ1 .. REQ11
    slug: string;
    label: string;
}

/** One child of a dimension in the catalogue's own tree (its sidebar). */
export interface CatalogueSubdimension {
    slug: string;
    label: string;
    /** the dimension slug it hangs under */
    parent: string;
}

export interface Catalogue {
    plugins: CataloguePlugin[];
    controls: CatalogueControl[];
    /** the dimension vocabulary, REQ order, so the filter can label its chips */
    dimensions?: CatalogueDimension[];
    /** the catalogue's own sub-dimension tree, read from the catalogue */
    subdimensions?: CatalogueSubdimension[];
    /** the catalogue's own published site (independently published, I9) */
    app_catalog_url?: string;
}

/** Normalise a string for matching (lowercase, fold punctuation). */
export function normalise(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Fuzzy-match a query against a haystack. Returns a score (0 = no match,
 * higher = better match). Matches consecutive characters in order anywhere in
 * the string (the "fuzzy" part) and boosts exact/substring wins.
 */
export function fuzzyScore(query: string, haystack: string): number {
    const q = normalise(query);
    const h = normalise(haystack);
    if (!q) return 0;
    if (h === q) return 100;
    if (h.startsWith(q)) return 80;
    if (h.includes(q)) return 70;
    // ordered subsequence match: 'dgov' -> 'data governance'
    let qi = 0;
    for (let hi = 0; hi < h.length && qi < q.length; hi++) {
        if (h[hi] === q[qi]) qi++;
    }
    if (qi === q.length) return 40 + Math.min(15, q.length);
    return 0;
}

/** Every distinct tag across a set of catalogue items, sorted. */
export function allTags(plugins: CataloguePlugin[], controls: CatalogueControl[]): string[] {
    const seen = new Set<string>();
    const push = (t?: string[]) => t?.forEach((x) => x && seen.add(x));
    plugins.forEach((p) => push(p.tags?.length ? p.tags : [p.source]));
    controls.forEach((c) => push(c.tags?.length ? c.tags : [c.control_topic, c.source]));
    return Array.from(seen).sort();
}

/** Does this item carry one of the dimensions we are filtering by? */
export function inDimensions(
    item: { dimensions?: string[] },
    dimensions: string[],
): boolean {
    if (dimensions.length === 0) return true;
    return (item.dimensions ?? []).some((d) => dimensions.includes(d));
}

/** The catalogue's own children of a dimension: the pilot's sidebar's leaves. */
export function childrenOf(
    tree: CatalogueSubdimension[] | undefined,
    parent: string,
): CatalogueSubdimension[] {
    return (tree ?? []).filter((child) => child.parent === parent);
}

/**
 * Keep the items that match the query (fuzzy) and every selected tag.
 * Items rank by best fuzzy score across their searchable fields.
 *
 * `dimensions` narrows both kinds to those the project's objectives are about
 * ("For this project"): a checklist through its own tags, a plugin through the
 * tags of the catalogue's test item naming its package. A plugin the hosted
 * catalogue does not list carries no dimension and so is hidden by a project
 * filter — the same rule the pilot applies, where the catalogue is the only
 * source of a plugin's dimension.
 */
export function filterCatalogue(
    catalogue: Catalogue,
    query: string,
    selectedTags: string[],
    kind: 'plugins' | 'controls' | 'all' = 'all',
    dimensions: string[] = [],
): Catalogue {
    const tagHit = (tags?: string[]) =>
        selectedTags.length === 0 ||
        selectedTags.every((t) => (tags ?? []).some((x) => normalise(x) === normalise(t)));

    const scorePlugin = (p: CataloguePlugin): number => {
        if (kind === 'controls') return 0;
        return Math.max(
            fuzzyScore(query, p.package_name),
            fuzzyScore(query, p.source),
            ...(p.tags ?? []).map((t) => fuzzyScore(query, t)),
        );
    };
    const scoreControl = (c: CatalogueControl): number => {
        if (kind === 'plugins') return 0;
        return Math.max(
            fuzzyScore(query, c.title),
            fuzzyScore(query, c.catalogue_id),
            fuzzyScore(query, c.source),
            fuzzyScore(query, c.control_topic),
            ...(c.tags ?? []).map((t) => fuzzyScore(query, t)),
        );
    };

    const plugins = catalogue.plugins
        .filter((p) => kind !== 'controls' && tagHit(p.tags?.length ? p.tags : [p.source]))
        .filter((p) => inDimensions(p, dimensions))
        .filter((p) => !query || scorePlugin(p) > 0)
        .sort((a, b) => scorePlugin(b) - scorePlugin(a));
    const controls = catalogue.controls
        .filter((c) => kind !== 'plugins' && tagHit(c.tags))
        .filter((c) => inDimensions(c, dimensions))
        .filter((c) => !query || scoreControl(c) > 0)
        .sort((a, b) => scoreControl(b) - scoreControl(a));

    return { plugins, controls };
}
