import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardGraph from './CardGraph';
import NodeEditorDialog, { findNodeInView, withStagedChange } from './NodeEditorDialog';
import '../styles/common.css';
import { Json } from '../lib/qualification';

function CardSection({
    title,
    defaultOpen = true,
    action,
    children,
}: {
    title: string;
    defaultOpen?: boolean;
    action?: ReactNode;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Box>
            <Box
                onClick={() => setOpen((o) => !o)}
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
                <Icon fontSize="small" color="primary">
                    {open ? 'expand_less' : 'expand_more'}
                </Icon>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    {title}
                </Typography>
                {action && (
                    <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex' }}>
                        {action}
                    </Box>
                )}
            </Box>
            <Collapse in={open}>{children}</Collapse>
        </Box>
    );
}

function downloadText(filename: string, text: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface AICardSource {
    system_card?: Record<string, unknown> | null;
    system_card_jsonld?: string | null;
    system_version?: { number?: number } | null;
}

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const QUAL = 'https://lux-ai-factory.github.io/qualification/ns#';
const QUAL_TEXT = `${QUAL}text`;
const QUAL_CITATION = `${QUAL}citation`;
const QUAL_QUESTION_ID = `${QUAL}questionId`;

function literal(n: Record<string, Json>, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = n[k];
        if (typeof v === 'string' && v) return v;
        if (Array.isArray(v)) {
            for (const item of v) {
                if (typeof item === 'string' && item) return item;
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const val = (item as Record<string, Json>)['@value'];
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

function localName(iri: string): string {
    const m = iri.match(/[#/:]([^#/:]+)$/);
    return m ? m[1] : iri;
}

function nodeLabel(n: Record<string, Json>): string {
    const label = literal(n, RDFS_LABEL, 'rdfs:label', 'label');
    if (label) return label;
    const questionId = literal(n, QUAL_QUESTION_ID, 'qual:questionId');
    const text = literal(n, QUAL_TEXT, 'qual:text');
    if (questionId && text) return `answer ${questionId}: ${flatText(text)}`;
    if (questionId) return `answer ${questionId}`;
    if (text) return flatText(text);
    const id = String(n['@id'] ?? 'node');
    if (id.startsWith('_:')) return literal(n, QUAL_CITATION, 'qual:citation') ?? 'answer';
    return localName(id);
}

function nodeType(n: Record<string, Json>): string {
    const t = n['@type'];
    if (Array.isArray(t) && t.length > 0) return (t as Json[]).map((x) => localName(String(x))).join(', ');
    if (typeof t === 'string' && t) return localName(t);
    if (literal(n, QUAL_QUESTION_ID, 'qual:questionId', QUAL_TEXT, 'qual:text')) return 'Answer';
    return 'node';
}

/** rdflib serialises the graph as a top-level array; older payloads wrap it in
 *  `@graph` or inline a single node. Accept all three. */
function parseGraphNodes(raw: string | null): Record<string, Json>[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        const list: unknown[] = Array.isArray(parsed)
            ? parsed
            : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>)['@graph'])
              ? ((parsed as Record<string, unknown>)['@graph'] as unknown[])
              : parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>)['@id'] === 'string'
                ? [parsed]
                : [];
        return list.filter(
            (n): n is Record<string, Json> => typeof n === 'object' && n !== null && !Array.isArray(n),
        );
    } catch {
        return [];
    }
}

/** The AI card, rendered as a readable document from the headless payload. */
export default function AICardView({
    card,
    editable,
    vocab,
    onPatchNode,
    staged,
}: {
    card: AICardSource | null;
    editable?: boolean;
    vocab?: Record<string, string[]>;
    onPatchNode?: (nodeId: string, change: Record<string, Json>) => Promise<void>;
    staged?: Record<string, Record<string, Json>>;
}) {
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [patchBusy, setPatchBusy] = useState(false);
    const [patchError, setPatchError] = useState<string | null>(null);
    const sc = (card?.system_card ?? null) as Record<string, Json> | null;
    if (!sc || Object.keys(sc).length === 0) {
        return (
            <Typography color="text.secondary">
                No AI card built for this qualification yet.
            </Typography>
        );
    }

    const view = (sc['view'] ?? {}) as Record<string, Json>;
    const summary = (view['summary'] ?? {}) as Record<string, Json>;
    const system = (view['system'] ?? {}) as Record<string, Json>;
    const counts = (view['counts'] ?? {}) as Record<string, Json>;
    const form = (view['form'] ?? {}) as Record<string, Json>;
    const coverage = (view['coverage'] ?? {}) as Record<string, Json>;
    const problems = Array.isArray(sc['problems']) ? (sc['problems'] as Json[]) : [];
    const answersCount =
        typeof view['answers_count'] === 'number'
            ? view['answers_count']
            : Array.isArray(view['answers'])
              ? (view['answers'] as Json[]).length
              : null;
    const title =
        (typeof summary['label'] === 'string' && summary['label']) ||
        (typeof system['label'] === 'string' && system['label']) ||
        'AI card';
    const questionnaireId =
        (typeof summary['questionnaire_id'] === 'string' && summary['questionnaire_id']) ||
        (typeof form['name'] === 'string' && form['name'] ? String(form['name']) : null);

    const jsonldRaw =
        typeof sc['jsonld'] === 'string'
            ? sc['jsonld']
            : typeof card?.system_card_jsonld === 'string'
              ? card.system_card_jsonld
              : null;
    const turtle = typeof sc['turtle'] === 'string' ? sc['turtle'] : null;

    let digest = typeof sc['digest'] === 'string' ? sc['digest'] : null;
    if (!digest && jsonldRaw) {
        try {
            const parsed = JSON.parse(jsonldRaw) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const d = (parsed as Record<string, Json>)['digest'];
                if (typeof d === 'string') digest = d;
            }
        } catch {
            /* keep raw jsonld below */
        }
    }
    const graphNodes = parseGraphNodes(jsonldRaw);
    const rows = Array.isArray(view['rows']) ? (view['rows'] as Json[]) : [];
    const chains = Array.isArray(view['chains']) ? (view['chains'] as Json[]) : [];
    const annexAnswers = Array.isArray(view['answers']) ? (view['answers'] as Json[]) : [];
    const prettyJsonld = jsonldRaw
        ? (() => {
              try {
                  return JSON.stringify(JSON.parse(jsonldRaw), null, 2);
              } catch {
                  return jsonldRaw;
              }
          })()
        : null;

    const canEdit = Boolean(editable && onPatchNode);
    const editingNode =
        editingNodeId && canEdit
            ? (() => {
                  const found = findNodeInView(view, editingNodeId);
                  return found ? withStagedChange(found, staged?.[editingNodeId]) : null;
              })()
            : null;

    const saveNodePatch = async (change: Record<string, Json>) => {
        if (!editingNodeId || !onPatchNode) return;
        setPatchBusy(true);
        setPatchError(null);
        try {
            await onPatchNode(editingNodeId, change);
            setEditingNodeId(null);
        } catch (e) {
            setPatchError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setPatchBusy(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box className="gradient-card" sx={{ p: 1.5 }}>
                <Typography variant="h6">{title}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {questionnaireId && (
                        <Chip label={questionnaireId} size="small" variant="outlined" />
                    )}
                    {typeof answersCount === 'number' && (
                        <Chip label={`${answersCount} answers`} size="small" variant="outlined" />
                    )}
                    {typeof counts['risks'] === 'number' && (counts['risks'] as number) > 0 && (
                        <Chip label={`${String(counts['risks'])} risks`} size="small" variant="outlined" />
                    )}
                    {typeof counts['nodes'] === 'number' && (
                        <Chip
                            label={`${String(counts['nodes'])} nodes · ${String(counts['triples'] ?? 0)} triples`}
                            size="small"
                            variant="outlined"
                        />
                    )}
                    {typeof coverage['summary'] === 'string' && coverage['summary'] && (
                        <Chip label={coverage['summary']} size="small" variant="outlined" color="info" />
                    )}
                    {typeof card?.system_version?.number === 'number' && (
                        <Chip label={`v${card.system_version.number}`} size="small" variant="outlined" />
                    )}
                    {digest && (
                        <Chip label={`digest ${digest.slice(0, 12)}`} size="small" variant="outlined" color="primary" />
                    )}
                </Box>
            </Box>

            {jsonldRaw && (
                <Box>
                    <Typography variant="subtitle2">
                        Card graph
                        {canEdit && (
                            <Typography component="span" variant="caption" color="text.secondary">
                                {' '}· click a node to correct it
                            </Typography>
                        )}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                        <CardGraph
                            view={view}
                            jsonld={jsonldRaw}
                            onNodeClick={
                                canEdit
                                    ? (id) => {
                                          setEditingNodeId(id);
                                          setPatchError(null);
                                      }
                                    : undefined
                            }
                        />
                    </Box>
                </Box>
            )}
            {editingNode && (
                <NodeEditorDialog
                    key={editingNode.id}
                    node={editingNode}
                    vocab={vocab ?? {}}
                    busy={patchBusy}
                    error={patchError}
                    onCancel={() => setEditingNodeId(null)}
                    onSave={(change) => void saveNodePatch(change)}
                />
            )}

            {problems.length > 0 && (
                <Box>
                    <Typography variant="subtitle2">Problems</Typography>
                    {problems.map((p, i) => (
                        <Typography key={i} variant="body2" color="error">
                            {String(p)}
                        </Typography>
                    ))}
                </Box>
            )}

            {rows.length > 0 && (
                <Box>
                    <Typography variant="subtitle2">About the system</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                        {rows.map((r) => {
                            const row = r as Record<string, Json>;
                            const nodes = Array.isArray(row['nodes'])
                                ? (row['nodes'] as Json[]).filter(
                                      (n): n is Record<string, Json> =>
                                          typeof n === 'object' && n !== null,
                                  )
                                : [];
                            return (
                                <Box
                                    key={String(row['label'] ?? row['property'])}
                                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                                >
                                    <Typography
                                        variant="body2"
                                        fontWeight={600}
                                        sx={{ minWidth: 160 }}
                                    >
                                        {String(row['label'] ?? row['property'])}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {nodes.map((n, i) => {
                                            const vair = typeof n['vair'] === 'string' && n['vair'] ? String(n['vair']) : null;
                                            const cls = typeof n['cls'] === 'string' && n['cls'] ? String(n['cls']) : null;
                                            const tag = vair ?? cls;
                                            const full = typeof n['fullText'] === 'string' && n['fullText'] ? String(n['fullText']) : nodeLabel(n);
                                            return (
                                                <Chip
                                                    key={i}
                                                    size="small"
                                                    variant="outlined"
                                                    className="wrap-chip"
                                                    title={full}
                                                    label={`${full}${tag ? ` · ${tag}` : ''}`}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}

            {chains.length > 0 && (
                <Box>
                    <Typography variant="subtitle2">Risks</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                        {chains.map((c, idx) => {
                            const chain = c as Record<string, Json>;
                            const risk = (chain['risk'] ?? {}) as Record<string, Json>;
                            const steps: Array<[string, string]> = [
                                ['caused by', 'source'],
                                ['exploiting', 'vulnerability'],
                                ['leading to', 'consequence'],
                                ['impact', 'impact'],
                                ['affecting', 'stakeholder'],
                                ['controlled by', 'control'],
                                ['then', 'followUp'],
                            ];
                            return (
                                <Box
                                    key={idx}
                                    sx={{
                                        p: 1,
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 1,
                                    }}
                                >
                                    <Typography variant="body2" fontWeight={600}>
                                        Risk {idx + 1}: {String(risk['fullText'] ?? risk['label'] ?? risk['id'] ?? '')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                        {steps.map(([label, key]) => {
                                            const n = chain[key];
                                            if (typeof n !== 'object' || n === null || Array.isArray(n)) return null;
                                            const nn = n as Record<string, Json>;
                                            const vair = typeof nn['vair'] === 'string' && nn['vair'] ? ` · ${String(nn['vair'])}` : '';
                                            const full = typeof nn['fullText'] === 'string' && nn['fullText'] ? String(nn['fullText']) : String(nn['label'] ?? nn['id'] ?? '');
                                            return (
                                                <Chip
                                                    key={key}
                                                    size="small"
                                                    variant="outlined"
                                                    className="wrap-chip"
                                                    title={full}
                                                    label={`${label}: ${full}${vair}`}
                                                />
                                            );
                                        })}
                                        {Array.isArray(chain['areas'])
                                            ? (chain['areas'] as Json[]).map((a, i) => {
                                                  if (typeof a !== 'object' || a === null) return null;
                                                  const aa = a as Record<string, Json>;
                                                  const full = typeof aa['fullText'] === 'string' && aa['fullText'] ? String(aa['fullText']) : String(aa['label'] ?? aa['id']);
                                                  return (
                                                      <Chip
                                                          key={`area-${i}`}
                                                          size="small"
                                                          variant="outlined"
                                                          className="wrap-chip"
                                                          title={full}
                                                          label={`areas: ${full}`}
                                                      />
                                                  );
                                              })
                                            : null}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}

            {graphNodes.length > 0 && (
                <Box>
                    <Typography variant="subtitle2">
                        Card graph ({graphNodes.length} nodes)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {graphNodes.slice(0, 24).map((n, i) => (
                            <Chip
                                key={i}
                                label={`${nodeLabel(n)} · ${nodeType(n)}`}
                                size="small"
                                variant="outlined"
                                className="wrap-chip"
                                title={nodeLabel(n)}
                            />
                        ))}
                    </Box>
                </Box>
            )}

            {annexAnswers.length > 0 && (
                <CardSection title="Annex IV documentation" defaultOpen={false}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                        {annexAnswers.map((a, i) => {
                            const aa = a as Record<string, Json>;
                            const text = typeof aa['text'] === 'string' ? aa['text'] : '';
                            if (!text) return null;
                            const citation =
                                typeof aa['citation'] === 'string' && aa['citation']
                                    ? aa['citation']
                                    : typeof aa['questionId'] === 'string'
                                      ? String(aa['questionId'])
                                      : '';
                            return (
                                <Box key={i}>
                                    <Typography variant="caption" color="text.secondary">
                                        {citation}
                                    </Typography>
                                    <Typography variant="body2">{text}</Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </CardSection>
            )}

                {prettyJsonld && (
                    <CardSection
                        title="JSON-LD"
                        defaultOpen={false}
                        action={
                            <IconButton
                                size="small"
                                title="Download JSON-LD"
                                aria-label="Download JSON-LD"
                                onClick={() =>
                                    downloadText(
                                        'ai-card.jsonld',
                                        prettyJsonld,
                                        'application/ld+json',
                                    )
                                }
                            >
                                <Icon fontSize="small">download</Icon>
                            </IconButton>
                        }
                    >
                        <Box
                            component="pre"
                            sx={{
                                mt: 0.5,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: 'grey.50',
                                border: '1px solid #e5e7eb',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                            }}
                        >
                            {prettyJsonld}
                        </Box>
                    </CardSection>
                )}

                {turtle && (
                    <CardSection
                        title="Turtle"
                        defaultOpen={false}
                        action={
                            <IconButton
                                size="small"
                                title="Download Turtle"
                                aria-label="Download Turtle"
                                onClick={() => downloadText('ai-card.ttl', turtle, 'text/turtle')}
                            >
                                <Icon fontSize="small">download</Icon>
                            </IconButton>
                        }
                    >
                        <Box
                            component="pre"
                            sx={{
                                mt: 0.5,
                                p: 1,
                                borderRadius: 1,
                                bgcolor: 'grey.50',
                                border: '1px solid #e5e7eb',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                            }}
                        >
                            {turtle}
                        </Box>
                    </CardSection>
                )}
        </Box>
    );
}
