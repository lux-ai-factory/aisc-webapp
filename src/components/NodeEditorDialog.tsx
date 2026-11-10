import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AppDialog from './AppDialog';
import type { Json } from '../lib/qualification';

/** One view node editable in place, by its local id. */
export interface EditorNode {
    id: string;
    label: string;
    cls: string | null;
    vair: string | null;
    fullText: string | null;
    reviewNote: string | null;
    termNotApplicable: boolean;
}

function asEditorNode(raw: Json): EditorNode | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, Json>;
    if (typeof r['id'] !== 'string' || typeof r['label'] !== 'string') return null;
    return {
        id: r['id'],
        label: r['label'],
        cls: typeof r['cls'] === 'string' ? r['cls'] : null,
        vair: typeof r['vair'] === 'string' ? r['vair'] : null,
        fullText: typeof r['fullText'] === 'string' ? r['fullText'] : null,
        reviewNote: typeof r['reviewNote'] === 'string' ? r['reviewNote'] : null,
        termNotApplicable: r['termNotApplicable'] === true,
    };
}

export function withStagedChange(node: EditorNode, change: Record<string, Json> | undefined): EditorNode {
    if (!change) return node;
    return {
        ...node,
        label: typeof change['label'] === 'string' ? change['label'] : node.label,
        vair: 'vair' in change ? ((change['vair'] as string | null) ?? null) : node.vair,
        reviewNote: typeof change['note'] === 'string' ? change['note'] : node.reviewNote,
        termNotApplicable:
            typeof change['termNotApplicable'] === 'boolean'
                ? change['termNotApplicable']
                : node.termNotApplicable,
    };
}

/** Find a node anywhere in a card view: system, property rows, risk chains. */
export function findNodeInView(view: Record<string, Json>, id: string): EditorNode | null {
    const direct = asEditorNode(view['system'] ?? {});
    if (direct && direct.id === id) return direct;
    const rows = Array.isArray(view['rows']) ? view['rows'] : [];
    for (const item of rows) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
        const nodes = (item as Record<string, Json>)['nodes'];
        if (!Array.isArray(nodes)) continue;
        for (const n of nodes) {
            const node = asEditorNode(n);
            if (node && node.id === id) return node;
        }
    }
    const chains = Array.isArray(view['chains']) ? view['chains'] : [];
    const chainKeys = [
        'risk',
        'source',
        'vulnerability',
        'consequence',
        'impact',
        'stakeholder',
        'control',
        'followUp',
    ];
    for (const item of chains) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
        const c = item as Record<string, Json>;
        for (const key of chainKeys) {
            const node = asEditorNode(c[key] ?? {});
            if (node && node.id === id) return node;
        }
        const areas = c['areas'];
        if (Array.isArray(areas)) {
            for (const a of areas) {
                const node = asEditorNode(a);
                if (node && node.id === id) return node;
            }
        }
    }
    return null;
}

export default function NodeEditorDialog({
    node,
    vocab,
    busy,
    error,
    onCancel,
    onSave,
}: {
    node: EditorNode;
    vocab: Record<string, string[]>;
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onSave: (change: Record<string, Json>) => void;
}) {
    const [label, setLabel] = useState(node.label);
    const [term, setTerm] = useState('');
    const [note, setNote] = useState(node.reviewNote ?? '');
    const [notApplicable, setNotApplicable] = useState(node.termNotApplicable);
    const terms = (node.cls && vocab[node.cls]) || [];
    const newNote = note.trim() !== '' && note.trim() !== (node.reviewNote ?? '').trim();
    const changed =
        label.trim() !== node.label ||
        term !== '' ||
        newNote ||
        notApplicable !== node.termNotApplicable;
    const save = () => {
        const change: Record<string, Json> = {};
        if (label.trim() !== node.label) change['label'] = label.trim();
        if (term === '__REMOVE__') change['vair'] = null;
        else if (term !== '') change['vair'] = term;
        if (newNote) change['note'] = note.trim();
        if (notApplicable !== node.termNotApplicable) {
            change['termNotApplicable'] = notApplicable;
        }
        onSave(change);
    };
    return (
        <AppDialog
            open
            onClose={onCancel}
            title={`Edit node · ${node.cls ?? 'node'}`}
            maxWidth="sm"
            fullWidth
            actions={
                <>
                    <Button
                        onClick={onCancel}
                        disabled={busy}
                        variant="outlined"
                        sx={{ textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        onClick={save}
                        disabled={busy || !changed || label.trim() === ''}
                        sx={{ textTransform: 'none' }}
                    >
                        Save correction
                    </Button>
                </>
            }
        >
            {node.fullText && (
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label="Full text"
                    value={node.fullText}
                    InputProps={{ readOnly: true }}
                />
            )}
            <TextField
                fullWidth
                label="Label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={busy}
                sx={{ mt: node.fullText ? 1.5 : 0 }}
            />
            {terms.length > 0 && (
                <TextField
                    select
                    fullWidth
                    label="VAIR term"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    disabled={busy}
                    helperText={node.vair ? `Currently: ${node.vair}` : 'Currently: no term'}
                    sx={{ mt: 1.5 }}
                >
                    <MenuItem value="">Keep as is</MenuItem>
                    {terms.map((t) => (
                        <MenuItem key={t} value={t}>
                            {t}
                        </MenuItem>
                    ))}
                    {node.vair && <MenuItem value="__REMOVE__">Remove type</MenuItem>}
                </TextField>
            )}
            <TextField
                fullWidth
                multiline
                minRows={2}
                label="Review note (optional)"
                helperText={
                    node.reviewNote
                        ? 'The saved note is shown; edit it to save a new one.'
                        : undefined
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
                sx={{ mt: 1.5 }}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={notApplicable}
                        onChange={(e) => setNotApplicable(e.target.checked)}
                        disabled={busy}
                    />
                }
                label="No vocabulary term applies to this node"
            />
            {error && <Typography color="error">{error}</Typography>}
        </AppDialog>
    );
}
