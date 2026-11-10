import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    type Edge,
    type Node,
    type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/common.css';
import type { Json } from '../lib/qualification';
import {
    NODE_W,
    layoutFigure,
    toFigureView,
    type FigureViewNode,
    type HubData,
} from './cardFigure';

function localName(iri: string): string {
    const m = iri.match(/[#/:]([^#/:]+)$/);
    return m ? m[1] : iri;
}

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const QUAL = 'https://lux-ai-factory.github.io/qualification/ns#';
const QUAL_TEXT = `${QUAL}text`;
const QUAL_CITATION = `${QUAL}citation`;
const QUAL_QUESTION_ID = `${QUAL}questionId`;

function firstLiteral(n: Record<string, unknown>, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = n[k];
        if (typeof v === 'string' && v) return v;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (typeof item === 'string' && item) return item;
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const val = (item as Record<string, unknown>)['@value'];
                    if (typeof val === 'string' && val) return val;
                }
            }
        }
    }
    return null;
}

function flatText(text: string): string {
    return text.split(/\s+/).join(' ').trim();
}

function tripleNodeLabel(n: Record<string, unknown>): string {
    const label = firstLiteral(n, RDFS_LABEL, 'rdfs:label', 'label');
    if (label) return label;
    const questionId = firstLiteral(n, QUAL_QUESTION_ID, 'qual:questionId');
    const text = firstLiteral(n, QUAL_TEXT, 'qual:text');
    if (questionId && text) return `answer ${questionId}: ${flatText(text)}`;
    if (questionId) return `answer ${questionId}`;
    if (text) return flatText(text);
    const id = String(n['@id'] ?? 'node');
    if (id.startsWith('_:')) return firstLiteral(n, QUAL_CITATION, 'qual:citation') ?? 'answer';
    return localName(id);
}

function tripleNodeType(n: Record<string, unknown>): string {
    const t = n['@type'];
    if (Array.isArray(t) && t.length > 0) {
        return (t as unknown[]).map((x) => localName(String(x))).join(',');
    }
    if (typeof t === 'string' && t) return localName(t);
    if (firstLiteral(n, QUAL_QUESTION_ID, 'qual:questionId', QUAL_TEXT, 'qual:text')) {
        return 'Answer';
    }
    return '';
}

function parseTripleGraph(jsonld: string): Record<string, unknown>[] {
    try {
        const parsed = JSON.parse(jsonld) as unknown;
        if (Array.isArray(parsed)) {
            return parsed.filter(
                (n): n is Record<string, unknown> => typeof n === 'object' && n !== null,
            );
        }
        if (parsed && typeof parsed === 'object') {
            const record = parsed as Record<string, unknown>;
            if (Array.isArray(record['@graph'])) {
                return (record['@graph'] as unknown[]).filter(
                    (n): n is Record<string, unknown> => typeof n === 'object' && n !== null,
                );
            }
            if (typeof record['@id'] === 'string') return [record];
        }
    } catch {
        /* fall through */
    }
    return [];
}

interface AiroData {
    node: FigureViewNode;
    band: 'system' | 'risk';
    childCount: number;
    expanded: boolean;
    onToggle: () => void;
    onNodeClick?: (id: string) => void;
}

interface HubNodeData {
    hub: HubData;
    onToggle: () => void;
}

function AiroFlowNode({ data }: NodeProps) {
    const d = data as unknown as AiroData;
    const sub = d.node.vair ?? d.node.cls;
    return (
        <>
            <Handle type="target" position={Position.Left} isConnectable={false} />
            <div
                className={`graph-node${d.band === 'risk' ? ' risk' : ''}${d.onNodeClick ? ' clickable' : ''}`}
                title={d.onNodeClick ? `${d.node.fullText ?? d.node.label} (click to edit)` : (d.node.fullText ?? d.node.label)}
                onClick={d.onNodeClick ? () => d.onNodeClick!(d.node.id) : undefined}
            >
                <div className="graph-node-label">{d.node.label}</div>
                {sub && <div className="graph-node-sub">{sub}</div>}
                {d.childCount > 0 && (
                    <button
                        type="button"
                        className="graph-expander"
                        onClick={(e) => {
                            e.stopPropagation();
                            d.onToggle();
                        }}
                        aria-expanded={d.expanded}
                        title={d.expanded ? "Hide this risk's chain" : `Show ${d.childCount} hidden nodes`}
                    >
                        {d.expanded ? '−' : '+'} {d.childCount}
                    </button>
                )}
            </div>
            <Handle type="source" position={Position.Right} isConnectable={false} />
        </>
    );
}

function HubFlowNode({ data }: NodeProps) {
    const d = data as unknown as HubNodeData;
    return (
        <>
            <Handle type="target" position={Position.Left} isConnectable={false} />
            <button
                type="button"
                className="graph-hub"
                onClick={() => d.onToggle()}
                aria-expanded={d.hub.expanded}
                title={d.hub.expanded ? `Hide the ${d.hub.count} ${d.hub.label}` : `Show the ${d.hub.count} ${d.hub.label}`}
            >
                {d.hub.label} · {d.hub.count}
            </button>
            <Handle type="source" position={Position.Right} isConnectable={false} />
        </>
    );
}

const NODE_TYPES = { airo: AiroFlowNode, hub: HubFlowNode };

/** The AI card's graph: the Figure-3 layout from the card view when present,
 *  raw JSON-LD triples otherwise. */
export default function CardGraph({
    view,
    jsonld,
    onNodeClick,
    height = 560,
}: {
    view?: Record<string, Json> | null;
    jsonld?: string | null;
    onNodeClick?: (id: string) => void;
    height?: number | string;
}) {
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const toggle = useCallback((id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const figure = useMemo(() => {
        if (!view || typeof view !== 'object') return null;
        const fv = toFigureView(view);
        return fv ? layoutFigure(fv, expanded) : null;
    }, [view, expanded]);

    const fallback = useMemo(() => {
        if (figure || !jsonld) return null;
        const graph = parseTripleGraph(jsonld);
        if (graph.length === 0) return null;

        const ids = graph.map((n) => String(n['@id'] ?? '')).filter(Boolean);
        const idSet = new Set(ids);
        const edgesRaw: { source: string; target: string; label: string }[] = [];
        for (const n of graph) {
            const source = String(n['@id'] ?? '');
            for (const [k, v] of Object.entries(n)) {
                if (k.startsWith('@')) continue;
                const targets = Array.isArray(v) ? (v as unknown[]) : [v];
                for (const t of targets) {
                    if (t && typeof t === 'object' && typeof (t as { '@id'?: unknown })['@id'] === 'string') {
                        const target = String((t as { '@id': unknown })['@id']);
                        if (idSet.has(target) && source !== target) {
                            edgesRaw.push({ source, target, label: localName(k) });
                        }
                    }
                }
            }
        }
        const start =
            graph.find((n) => {
                const t = tripleNodeType(n);
                return t === 'AISystem' || t.includes('AISystem');
            }) ?? graph[0];
        const startId = String(start?.['@id'] ?? '');
        const depth = new Map<string, number>();
        const queue: string[] = [startId];
        depth.set(startId, 0);
        while (queue.length) {
            const cur = queue.shift()!;
            const d = depth.get(cur) ?? 0;
            for (const e of edgesRaw.filter((x) => x.source === cur)) {
                if (!depth.has(e.target)) {
                    depth.set(e.target, d + 1);
                    queue.push(e.target);
                }
            }
        }
        const byDepth = new Map<number, number>();
        const rfNodes: Node[] = graph.map((n) => {
            const id = String(n['@id'] ?? '');
            const d = depth.has(id) ? (depth.get(id) ?? 0) : 0;
            const i = byDepth.get(d) ?? 0;
            byDepth.set(d, i + 1);
            const label = tripleNodeLabel(n);
            const type = tripleNodeType(n);
            return {
                id,
                position: { x: (d + 1.2) * 260, y: i * 110 },
                data: { label: type ? `${type}\n${label}` : label },
            } as Node;
        });
        const rfEdges: Edge[] = edgesRaw
            .filter((e) => idSet.has(e.source) && idSet.has(e.target))
            .map((e) => ({
                id: `${e.source}->${e.label}->${e.target}`,
                source: e.source,
                target: e.target,
                label: e.label,
            }));
        return { nodes: rfNodes, edges: rfEdges };
    }, [figure, jsonld]);

    const rfGraph = useMemo(() => {
        if (!figure) return fallback;
        const nodes: Node[] = figure.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data:
                n.type === 'hub'
                    ? { hub: n.data.hub, onToggle: () => toggle(n.id) }
                    : {
                          node: n.data.node,
                          band: n.band,
                          childCount: n.data.childCount,
                          expanded: n.data.expanded,
                          onToggle: () => toggle(n.data.node!.id),
                          onNodeClick,
                      },
            style: { width: NODE_W },
            draggable: true,
        }));
        const edges: Edge[] = figure.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'smoothstep',
            label: e.label || undefined,
            labelStyle: { fontSize: 10, fontWeight: 600, fill: '#4a5265' },
            labelBgStyle: { fill: '#fff', fillOpacity: 0.95 },
            labelBgPadding: [4, 2] as [number, number],
            style: { stroke: e.label ? '#7b8499' : '#aab2c2', strokeWidth: e.label ? 1.6 : 1.2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#7b8499' },
        }));
        return { nodes, edges };
    }, [figure, fallback, toggle, onNodeClick]);

    if (!rfGraph || rfGraph.nodes.length === 0) {
        return <Typography color="text.secondary">No graph to show.</Typography>;
    }
    return (
        <Box sx={{ width: '100%', height, border: '1px solid #e5e7eb', borderRadius: 1 }}>
            <ReactFlow
                nodes={rfGraph.nodes}
                edges={rfGraph.edges}
                nodeTypes={NODE_TYPES}
                fitView
                fitViewOptions={{ padding: 0.08, minZoom: 0.5, maxZoom: 1 }}
                minZoom={0.1}
                maxZoom={1.8}
            >
                <Background gap={26} size={1.4} color="#c8cfdd" />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable style={{ width: 110, height: 80 }} />
            </ReactFlow>
        </Box>
    );
}
