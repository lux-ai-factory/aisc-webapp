import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useProject } from '../context/ProjectContext';
import {
    EvidenceControl,
    EvidenceKind,
    EvidenceLink,
    EvidenceLinkInput,
    EvidenceMap,
    EvidenceStatus,
    EvidenceTest,
    getEvidenceMap,
    putEvidenceLinks,
    reviewEvidenceMap,
} from '../lib/evidence';
import '../styles/common.css';

const STATUS_LABEL: Record<EvidenceStatus, string> = {
    'not covered': 'Not covered',
    'no evidence': 'No evidence yet',
    evidence: 'Evidence',
    attention: 'Evidence, attention',
};

interface Column {
    kind: EvidenceKind;
    item: EvidenceTest | EvidenceControl;
}

const day = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/**
 * Versioned evidence map (EVD-01): link tests and checklist answers to the selected control
 * objectives, on one AI-card version. Gaps/priority filters, note editing, independent review and
 * carry-forward from the previous version.
 */
const EvidenceMapPage = () => {
    const { project_name } = useParams();
    const { projectUUID: pid, projectName } = useProject();
    const [searchParams, setSearchParams] = useSearchParams();
    const version = searchParams.get('version') ?? undefined;

    const [data, setData] = useState<EvidenceMap | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [gapsOnly, setGapsOnly] = useState(false);
    const [priorityOnly, setPriorityOnly] = useState(false);
    const [panel, setPanel] = useState<{ objectiveId: string; kind: EvidenceKind; key: string } | null>(null);
    const [note, setNote] = useState('');

    const load = useCallback(
        (versionPid?: string) => {
            if (!pid) return;
            getEvidenceMap(pid, versionPid)
                .then((map) => {
                    setData(map);
                    setError(null);
                })
                .catch((e: Error) => setError(e.message));
        },
        [pid],
    );

    useEffect(() => {
        load(version);
    }, [load, version]);

    const savedLinks = useMemo<EvidenceLink[]>(
        () => (data?.carried_from ? [] : data?.links ?? []),
        [data],
    );

    const linkOf = (objectiveId: string, kind: EvidenceKind, key: string): EvidenceLink | undefined =>
        savedLinks.find((l) => l.objective_id === objectiveId && l.kind === kind && l.key === key);

    const columns = useMemo<Column[]>(() => {
        if (!data) return [];
        const linked = new Set(savedLinks.map((l) => `${l.kind}|${l.key}`));
        const keep = (kind: EvidenceKind) => (item: EvidenceTest | EvidenceControl) =>
            !item.stale || linked.has(`${kind}|${item.key}`);
        return [
            ...data.tests.filter(keep('test')).map((t) => ({ kind: 'test' as const, item: t })),
            ...data.controls.filter(keep('control')).map((c) => ({ kind: 'control' as const, item: c })),
        ];
    }, [data, savedLinks]);

    const canLink = (objective: { stale: string | null; dimension: string }, item: EvidenceTest | EvidenceControl): boolean => {
        if (objective.stale || item.stale) return false;
        if (!objective.dimension || !item.dimensions?.length) return true;
        return item.dimensions.includes(objective.dimension);
    };

    const write = async (links: EvidenceLinkInput[], done?: () => void) => {
        if (!pid || !data?.version) return;
        setMessage('Saving…');
        try {
            const map = await putEvidenceLinks(pid, data.version.pid, links);
            setData(map);
            setMessage('Saved.');
            done?.();
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    const addLink = (objectiveId: string, kind: EvidenceKind, key: string) => {
        write(
            savedLinks
                .map(
                    (l): EvidenceLinkInput => ({
                        objective_id: l.objective_id,
                        kind: l.kind,
                        key: l.key,
                        note: l.note,
                    }),
                )
                .concat([{ objective_id: objectiveId, kind, key, note: null }]),
        );
    };

    const openPanel = (objectiveId: string, kind: EvidenceKind, key: string, link: EvidenceLink) => {
        setPanel({ objectiveId, kind, key });
        setNote(link.note ?? '');
    };

    const markReviewed = async () => {
        if (!pid || !data?.version) return;
        setMessage('Saving…');
        try {
            setData(await reviewEvidenceMap(pid, data.version.pid));
            setMessage('Reviewed.');
        } catch (e) {
            setMessage((e as Error).message);
        }
    };

    const panelItem = panel
        ? columns.find((c) => c.kind === panel.kind && c.item.key === panel.key)?.item
        : undefined;
    const panelLink = panel ? linkOf(panel.objectiveId, panel.kind, panel.key) : undefined;

    const back = project_name ? `/projects/${project_name}/evidence` : '/';

    return (
        <Box>
            <Box className="page-header" sx={{ mb: 2 }}>
                <Typography variant="h4" className="page-header-title">
                    {projectName || project_name}
                </Typography>
                <span className="brand-mono">
                    <Link to={back}>‹ Collect evidence</Link> › Evidence map
                </span>
            </Box>

            {error && (
                <Typography color="error" data-testid="evidence-error">
                    {error}
                </Typography>
            )}
            {!error && data && !data.version && (
                <Typography data-testid="evidence-empty">
                    This project has no AI card version yet: describe the system in step 1, Qualify.
                </Typography>
            )}

            {data?.version && (
                <>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span className="brand-mono">AI card version</span>
                            <Select
                                size="small"
                                value={data.version.pid}
                                onChange={(e) => {
                                    const picked = String(e.target.value);
                                    const params = new URLSearchParams();
                                    if (data.versions[0] && picked !== data.versions[0].pid) {
                                        params.set('version', picked);
                                    }
                                    setSearchParams(params);
                                }}
                                inputProps={{ 'data-testid': 'evidence-version' }}
                            >
                                {data.versions.map((v, i) => (
                                    <MenuItem key={v.pid} value={v.pid}>
                                        Version {v.number}
                                        {i === 0 ? ' (latest)' : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Box>
                        <span className="brand-mono" data-testid="evidence-coverage">
                            {data.coverage.linked} of {data.coverage.objectives} objectives linked ·{' '}
                            {data.coverage.gaps} gaps
                        </span>
                        <label className="brand-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                                type="checkbox"
                                data-testid="gaps-only"
                                checked={gapsOnly}
                                onChange={(e) => setGapsOnly(e.target.checked)}
                            />
                            Gaps only
                        </label>
                        <label className="brand-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <input
                                type="checkbox"
                                data-testid="priority-only"
                                checked={priorityOnly}
                                onChange={(e) => setPriorityOnly(e.target.checked)}
                            />
                            Priority only
                        </label>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 1 }}>
                        <span data-testid="evidence-review">
                            {data.review
                                ? `Reviewed by ${data.review.reviewed_by_name} on ${day(data.review.reviewed_at)}`
                                : data.read_only
                                  ? 'Not reviewed.'
                                  : 'Not reviewed yet.'}
                        </span>
                        {data.can_review && (
                            <Button
                                size="small"
                                variant="outlined"
                                data-testid="mark-reviewed"
                                onClick={markReviewed}
                            >
                                Mark reviewed
                            </Button>
                        )}
                        {data.carried_from != null && data.can_edit && (
                            <Button
                                size="small"
                                variant="outlined"
                                data-testid="copy-carried"
                                onClick={() =>
                                    write(
                                        data.links.map((l) => ({
                                            objective_id: l.objective_id,
                                            kind: l.kind,
                                            key: l.key,
                                            note: l.note,
                                        })),
                                    )
                                }
                            >
                                Copy the v{data.carried_from} map
                            </Button>
                        )}
                        <span className="brand-mono" data-testid="evidence-message">
                            {message}
                        </span>
                    </Box>

                    <Box sx={{ overflow: 'auto', maxHeight: '70vh', mt: 2 }} data-testid="evidence-grid">
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th className="brand-mono" style={{ textAlign: 'left', position: 'sticky', left: 0, background: '#f2f3fd', zIndex: 2 }}>
                                        Control objective
                                    </th>
                                    {columns.map((c) => (
                                        <th key={`${c.kind}-${c.item.key}`} style={{ minWidth: 110, textAlign: 'left' }}>
                                            <span className="brand-mono">{c.kind === 'test' ? 'Test' : 'Checklist'}</span>
                                            <span style={{ display: 'block', fontSize: 12 }}>{c.item.label}</span>
                                            {c.item.stale && (
                                                <span className="brand-mono" style={{ color: '#e30613' }}>
                                                    {c.item.stale}
                                                </span>
                                            )}
                                        </th>
                                    ))}
                                    <th className="brand-mono" style={{ textAlign: 'left' }}>Linked</th>
                                    <th className="brand-mono" style={{ textAlign: 'left' }}>Evidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.objectives
                                    .filter(
                                        (o) =>
                                            (!gapsOnly || (!o.linked && !o.stale)) &&
                                            (!priorityOnly || o.priority),
                                    )
                                    .map((o) => (
                                        <tr
                                            key={o.id}
                                            data-testid={`objective-row-${o.id}`}
                                            style={{ opacity: o.stale ? 0.6 : 1 }}
                                        >
                                            <th
                                                scope="row"
                                                style={{ textAlign: 'left', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}
                                            >
                                                <span className="brand-mono">{o.id}</span>{' '}
                                                <span style={{ fontWeight: 400 }}>{o.title}</span>
                                                {o.priority && (
                                                    <span className="brand-mono" style={{ color: '#ff007e', marginLeft: 6 }}>
                                                        Priority
                                                    </span>
                                                )}
                                                {o.stale && (
                                                    <span className="brand-mono" style={{ color: '#e30613', marginLeft: 6 }}>
                                                        {o.stale}
                                                    </span>
                                                )}
                                            </th>
                                            {columns.map((c) => {
                                                const link = linkOf(o.id, c.kind, c.item.key);
                                                const linkable = canLink(o, c.item) && data.can_edit;
                                                return (
                                                    <td
                                                        key={`${c.kind}-${c.item.key}`}
                                                        style={{ textAlign: 'center' }}
                                                        data-testid={`cell-${o.id}-${c.kind}-${c.item.key}`}
                                                    >
                                                        {link ? (
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                aria-label={link.note || 'Open the link'}
                                                                onClick={() => openPanel(o.id, c.kind, c.item.key, link)}
                                                            >
                                                                ✓
                                                            </Button>
                                                        ) : linkable ? (
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                aria-label={`Link ${c.item.label} to ${o.id}`}
                                                                onClick={() => addLink(o.id, c.kind, c.item.key)}
                                                            >
                                                                ☐
                                                            </Button>
                                                        ) : (
                                                            <span>{canLink(o, c.item) ? '☐' : '·'}</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="brand-mono">{o.linked ? 'Yes' : 'No'}</td>
                                            <td className="brand-mono">{STATUS_LABEL[o.evidence]}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </Box>

                    {panel && panelLink && (
                        <Box
                            data-testid="link-panel"
                            sx={{ mt: 2, maxWidth: 720, border: '1px solid #999ff2', p: 2 }}
                        >
                            <Typography variant="subtitle1">
                                {panel.objectiveId} ← {panelItem?.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Linked on {day(panelLink.created_at)}
                            </Typography>
                            {panel.kind === 'test' && panelItem && 'runs' in panelItem && (
                                <Typography variant="body2" color="text.secondary">
                                    This version: {panelItem.runs.executed} completed · {panelItem.runs.failed}{' '}
                                    failed · {panelItem.runs.running} running
                                </Typography>
                            )}
                            {panel.kind === 'control' && panelItem && 'submission' in panelItem && (
                                <Typography variant="body2" color="text.secondary">
                                    {panelItem.submission
                                        ? `Latest answers: ${panelItem.submission.answered} of ${panelItem.submission.questions} answered`
                                        : 'Not answered yet'}
                                </Typography>
                            )}
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                sx={{ mt: 1 }}
                                inputProps={{ maxLength: 1000, 'data-testid': 'link-note' }}
                                placeholder="Why it is evidence: what result counts as a pass"
                                value={note}
                                disabled={!data.can_edit}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            {data.can_edit && (
                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        data-testid="save-note"
                                        onClick={() =>
                                            write(
                                                savedLinks.map((l) =>
                                                    l.objective_id === panel.objectiveId &&
                                                    l.kind === panel.kind &&
                                                    l.key === panel.key
                                                        ? {
                                                              objective_id: l.objective_id,
                                                              kind: l.kind,
                                                              key: l.key,
                                                              note: note.trim(),
                                                          }
                                                        : {
                                                              objective_id: l.objective_id,
                                                              kind: l.kind,
                                                              key: l.key,
                                                              note: l.note,
                                                          },
                                                ),
                                                () => setPanel(null),
                                            )
                                        }
                                    >
                                        Save note
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        data-testid="unlink"
                                        onClick={() =>
                                            write(
                                                savedLinks
                                                    .filter(
                                                        (l) =>
                                                            !(
                                                                l.objective_id === panel.objectiveId &&
                                                                l.kind === panel.kind &&
                                                                l.key === panel.key
                                                            ),
                                                    )
                                                    .map((l) => ({
                                                        objective_id: l.objective_id,
                                                        kind: l.kind,
                                                        key: l.key,
                                                        note: l.note,
                                                    })),
                                                () => setPanel(null),
                                            )
                                        }
                                    >
                                        Unlink
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}

                    {data.objectives.length === 0 && (
                        <Typography sx={{ mt: 2 }} data-testid="evidence-no-objectives">
                            No control objectives selected for this version yet: select them in step 2,
                            Control objectives.
                        </Typography>
                    )}
                </>
            )}
        </Box>
    );
};

export default EvidenceMapPage;
