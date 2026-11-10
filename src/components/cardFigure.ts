import type { Json } from '../lib/qualification';

// Figure-3 layout ported from the qualification app (feat/unified-modules,
// src/domain/ontologyFigure.ts): the upper band holds the system and its
// properties in fixed slots, the lower band one risk chain per row. Groups
// start collapsed behind hub nodes; the caller tracks the expanded set.

export interface FigureViewNode {
    id: string;
    label: string;
    cls: string | null;
    vair: string | null;
    fullText: string | null;
}

export interface FigureRow {
    property: string;
    label: string;
    citation: string;
    nodes: FigureViewNode[];
}

export interface FigureChain {
    risk: FigureViewNode;
    source: FigureViewNode | null;
    vulnerability: FigureViewNode | null;
    consequence: FigureViewNode | null;
    impact: FigureViewNode | null;
    stakeholder: FigureViewNode | null;
    areas: FigureViewNode[];
    control: FigureViewNode | null;
    followUp: FigureViewNode | null;
}

export interface FigureView {
    system: FigureViewNode;
    rows: FigureRow[];
    chains: FigureChain[];
}

export const NODE_W = 230;
export const NODE_H = 76;

const COL = NODE_W + 90;
const ROW = NODE_H + 54;

export const BAND_SPLIT = 2.2 * ROW;

const SYSTEM = { col: 0, row: 0 };

type Slot = {
    col: number;
    row: number;
    away: 'up' | 'down' | 'left' | 'right';
};

const UPPER_SLOTS: Record<string, Slot> = {
    hasCapability: { col: -2, row: -2, away: 'up' },
    hasPurpose: { col: -1, row: -2, away: 'up' },
    isAppliedWithinDomain: { col: 0, row: -2, away: 'up' },
    usesTechnique: { col: -2, row: -1, away: 'left' },
    hasModality: { col: -2, row: 0, away: 'left' },
    isUsedWithinLocality: { col: -2, row: 1, away: 'left' },
    hasComponent: { col: 0, row: 1.6, away: 'down' },
    isProvidedBy: { col: 2, row: -2, away: 'right' },
    isDeployedBy: { col: 2, row: -1, away: 'right' },
    hasAIUser: { col: 2, row: 0, away: 'right' },
};

function outward(
    base: { x: number; y: number },
    away: Slot['away'],
    n: number,
): { x: number; y: number } {
    const dx = NODE_W + 40;
    const dy = NODE_H + 26;
    switch (away) {
        case 'up':
            return { x: base.x, y: base.y - n * dy };
        case 'down':
            return { x: base.x, y: base.y + n * dy };
        case 'left':
            return { x: base.x - n * dx, y: base.y };
        case 'right':
            return { x: base.x + n * dx, y: base.y };
    }
}

const AREA_SLOT = { col: 1.2, row: 1.6 };

const CHAIN_SLOTS = {
    source: { col: -2, row: 0 },
    risk: { col: 0, row: 0 },
    consequence: { col: 1.6, row: 0 },
    impact: { col: 3.2, row: 0 },
    vulnerability: { col: -2, row: 1 },
    control: { col: 0, row: 1 },
    followUp: { col: 1.6, row: 1 },
};

const CHAIN_ROW_HEIGHT = 2.5 * ROW;
const COLLAPSED_ROW_HEIGHT = NODE_H + 44;

export interface HubData {
    property: string;
    label: string;
    count: number;
    expanded: boolean;
}

export interface FigureNode {
    id: string;
    type: 'airo' | 'hub';
    band: 'system' | 'risk';
    position: { x: number; y: number };
    data: {
        node?: FigureViewNode;
        hub?: HubData;
        childCount: number;
        expanded: boolean;
    };
}

export interface FigureEdge {
    id: string;
    source: string;
    target: string;
    label: string;
}

export interface FigureBand {
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FigureLayout {
    nodes: FigureNode[];
    edges: FigureEdge[];
    bands: FigureBand[];
}

export function hubId(property: string): string {
    return `hub:${property}`;
}

function asNode(raw: Json): FigureViewNode | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, Json>;
    if (typeof r['id'] !== 'string' || typeof r['label'] !== 'string') return null;
    return {
        id: r['id'],
        label: r['label'],
        cls: typeof r['cls'] === 'string' ? r['cls'] : null,
        vair: typeof r['vair'] === 'string' ? r['vair'] : null,
        fullText: typeof r['fullText'] === 'string' ? r['fullText'] : null,
    };
}

function asNodeOrNull(raw: Json | undefined): FigureViewNode | null {
    return raw === undefined ? null : asNode(raw);
}

/** The card view in FigureView shape, or null for stub/foreign payloads. */
export function toFigureView(view: Record<string, Json>): FigureView | null {
    const system = asNode(view['system'] ?? {});
    if (!system) return null;
    const rows: FigureRow[] = [];
    const rawRows = view['rows'];
    if (Array.isArray(rawRows)) {
        for (const item of rawRows) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
            const r = item as Record<string, Json>;
            if (typeof r['property'] !== 'string') continue;
            const nodes: FigureViewNode[] = [];
            if (Array.isArray(r['nodes'])) {
                for (const n of r['nodes']) {
                    const node = asNode(n);
                    if (node) nodes.push(node);
                }
            }
            if (nodes.length === 0) continue;
            rows.push({
                property: r['property'],
                label: typeof r['label'] === 'string' ? r['label'] : r['property'],
                citation: typeof r['citation'] === 'string' ? r['citation'] : '',
                nodes,
            });
        }
    }
    const chains: FigureChain[] = [];
    const rawChains = view['chains'];
    if (Array.isArray(rawChains)) {
        for (const item of rawChains) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
            const c = item as Record<string, Json>;
            const risk = asNode(c['risk'] ?? {});
            if (!risk) continue;
            const areas: FigureViewNode[] = [];
            if (Array.isArray(c['areas'])) {
                for (const a of c['areas']) {
                    const area = asNode(a);
                    if (area) areas.push(area);
                }
            }
            chains.push({
                risk,
                source: asNodeOrNull(c['source']),
                vulnerability: asNodeOrNull(c['vulnerability']),
                consequence: asNodeOrNull(c['consequence']),
                impact: asNodeOrNull(c['impact']),
                stakeholder: asNodeOrNull(c['stakeholder']),
                areas,
                control: asNodeOrNull(c['control']),
                followUp: asNodeOrNull(c['followUp']),
            });
        }
    }
    return { system, rows, chains };
}

const at = (col: number, row: number) => ({ x: col * COL, y: row * ROW });

export function layoutFigure(view: FigureView, expanded: ReadonlySet<string>): FigureLayout {
    const nodes: FigureNode[] = [];
    const edges: FigureEdge[] = [];
    const placed = new Set<string>();

    const put = (n: FigureNode) => {
        if (placed.has(n.id)) return;
        placed.add(n.id);
        nodes.push(n);
    };
    const airo = (
        n: FigureViewNode,
        p: { x: number; y: number },
        band: 'system' | 'risk',
        childCount = 0,
    ): FigureNode => ({
        id: n.id,
        type: 'airo',
        band,
        position: p,
        data: { node: n, childCount, expanded: expanded.has(n.id) },
    });
    const connect = (source: string, target: string, label: string) => {
        if (!placed.has(source) || !placed.has(target)) return;
        edges.push({ id: `${source}--${label}--${target}`, source, target, label });
    };

    put(airo(view.system, at(SYSTEM.col, SYSTEM.row), 'system'));

    for (const row of view.rows) {
        const slot = UPPER_SLOTS[row.property];
        if (!slot) continue;
        const base = at(slot.col, slot.row);

        if (row.nodes.length === 1) {
            put(airo(row.nodes[0], base, 'system'));
            connect(view.system.id, row.nodes[0].id, row.property);
            continue;
        }

        const id = hubId(row.property);
        const open = expanded.has(id);
        put({
            id,
            type: 'hub',
            band: 'system',
            position: base,
            data: {
                hub: {
                    property: row.property,
                    label: row.label,
                    count: row.nodes.length,
                    expanded: open,
                },
                childCount: row.nodes.length,
                expanded: open,
            },
        });
        connect(view.system.id, id, row.property);

        if (!open) continue;
        row.nodes.forEach((member, i) => {
            put(airo(member, outward(base, slot.away, i + 1), 'system'));
            edges.push({
                id: `${id}--member--${member.id}`,
                source: id,
                target: member.id,
                label: '',
            });
        });
    }

    const systemBottom = Math.max(...nodes.map((n) => n.position.y + NODE_H), BAND_SPLIT);
    let top = Math.max(BAND_SPLIT + 0.7 * ROW, systemBottom + 0.5 * ROW);
    view.chains.forEach((chain) => {
        const rowTop = top;
        top += expanded.has(chain.risk.id) ? CHAIN_ROW_HEIGHT : COLLAPSED_ROW_HEIGHT;
        const slot = (s: { col: number; row: number }) => ({
            x: s.col * COL,
            y: rowTop + s.row * ROW,
        });

        const members = [
            chain.source,
            chain.vulnerability,
            chain.consequence,
            chain.impact,
            chain.stakeholder,
            chain.control,
            chain.followUp,
            ...chain.areas,
        ].filter((n): n is FigureViewNode => Boolean(n));
        const open = expanded.has(chain.risk.id);
        const hidden = open
            ? 0
            : new Set(members.filter((n) => !placed.has(n.id)).map((n) => n.id)).size;

        put(airo(chain.risk, slot(CHAIN_SLOTS.risk), 'risk', hidden));
        connect(view.system.id, chain.risk.id, 'hasRisk');

        if (!open) return;

        if (chain.source) {
            put(airo(chain.source, slot(CHAIN_SLOTS.source), 'risk'));
            connect(chain.source.id, chain.risk.id, 'isRiskSourceFor');
            if (chain.vulnerability) {
                put(airo(chain.vulnerability, slot(CHAIN_SLOTS.vulnerability), 'risk'));
                connect(chain.source.id, chain.vulnerability.id, 'exploitsVulnerability');
            }
        }
        if (chain.consequence) {
            put(airo(chain.consequence, slot(CHAIN_SLOTS.consequence), 'risk'));
            connect(chain.risk.id, chain.consequence.id, 'hasConsequence');
            if (chain.impact) {
                put(airo(chain.impact, slot(CHAIN_SLOTS.impact), 'risk'));
                connect(chain.consequence.id, chain.impact.id, 'hasImpact');
                if (chain.stakeholder) {
                    put(
                        airo(
                            chain.stakeholder,
                            at(UPPER_SLOTS.hasAIUser.col, UPPER_SLOTS.hasAIUser.row),
                            'system',
                        ),
                    );
                    connect(chain.impact.id, chain.stakeholder.id, 'hasImpactOnStakeholder');
                }
                chain.areas.forEach((area, i) => {
                    put(airo(area, at(AREA_SLOT.col + i * 0.9, AREA_SLOT.row), 'system'));
                    connect(chain.impact!.id, area.id, 'hasImpactOnArea');
                });
            }
        }
        if (chain.control) {
            put(airo(chain.control, slot(CHAIN_SLOTS.control), 'risk'));
            connect(chain.control.id, chain.risk.id, 'modifiesRiskConcept');
            if (chain.followUp) {
                put(airo(chain.followUp, slot(CHAIN_SLOTS.followUp), 'risk'));
                connect(chain.control.id, chain.followUp.id, 'isFollowedByControl');
            }
        }
    });

    return { nodes, edges, bands: bands(nodes) };
}

function bands(nodes: FigureNode[]): FigureBand[] {
    const pad = 46;
    const box = (subset: FigureNode[]) => {
        const xs = subset.map((n) => n.position.x);
        const ys = subset.map((n) => n.position.y);
        return {
            x: Math.min(...xs) - pad,
            y: Math.min(...ys) - pad,
            width: Math.max(...xs) + NODE_W - Math.min(...xs) + pad * 2,
            height: Math.max(...ys) + NODE_H - Math.min(...ys) + pad * 2,
        };
    };
    const upper = nodes.filter((n) => n.band === 'system');
    const lower = nodes.filter((n) => n.band === 'risk');
    const out: FigureBand[] = [];
    if (upper.length) {
        out.push({ label: 'Concepts regarding AI system and its use', ...box(upper) });
    }
    if (lower.length) {
        out.push({ label: 'Concepts regarding risk', ...box(lower) });
    }
    return out;
}
