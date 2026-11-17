import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import AppCard from './AppCard';
import AppDialog from './AppDialog';
import {
    applyObjectiveSet,
    chooseBuiltinProfile,
    createObjectiveSet,
    deleteObjectiveSet,
    describeSuggestion,
    describeSetDiff,
    getObjectiveSetDiff,
    listObjectiveProfiles,
    listObjectiveSets,
    publishObjectiveSet,
    setRowsFromCatalogue,
    setObjectiveProfile,
    suggestMappings,
    updateObjectiveSet,
    type BuiltinProfiles,
    type ObjectiveCatalogueItem,
    type ObjectiveSet,
    type ObjectiveSetDiff,
    type ObjectiveSetRow,
} from '../lib/qualification';

/** Every column of a set row, in the catalogue's own order. */
const SET_ROW_FIELDS: {
    key: keyof ObjectiveSetRow;
    label: string;
    aria: string;
    multiline?: boolean;
}[] = [
    { key: 'objective_id', label: 'Objective ID', aria: 'Row objective ID' },
    { key: 'macro_requirement', label: 'Macro requirement', aria: 'Row macro requirement' },
    { key: 'text', label: 'Text', aria: 'Row text', multiline: true },
    { key: 'legal_basis', label: 'Legal basis', aria: 'Row legal basis' },
    { key: 'sub_requirement_label', label: 'Sub-requirement label', aria: 'Row sub-requirement label' },
    { key: 'assessment_mode', label: 'Assessment mode', aria: 'Row assessment mode' },
    { key: 'target', label: 'Target', aria: 'Row target' },
    { key: 'standards_grounding', label: 'Standards grounding', aria: 'Row standards grounding' },
    { key: 'grounding_tier_flag', label: 'Grounding tier flag', aria: 'Row grounding tier flag' },
    { key: 'notes', label: 'Notes', aria: 'Row notes', multiline: true },
];

const EMPTY_ROW: ObjectiveSetRow = {
    objective_id: '',
    macro_requirement: '',
    text: '',
    legal_basis: '',
    sub_requirement_label: '',
    assessment_mode: '',
    target: '',
    standards_grounding: '',
    grounding_tier_flag: '',
    notes: '',
};

/**
 * Step 2's profile and the project's own objective set.
 *
 * The pilot ships two profiles a project starts from — Full AI Act (every
 * objective) and Fairness and oversight (the objectives of the fairness and
 * oversight dimensions), a first assessment starting on the latter — and a
 * project may keep its own set: edited as a draft, published as fixed numbered
 * versions, applied so its rows become the project's own objectives.
 *
 * "Suggest with AI" (the risk mapper) is here too: it proposes, for the risks
 * nobody linked by hand, which profile objectives mitigate them, quoting the
 * risk's chain. It only runs when asked, and says so when no model is configured.
 */
export default function ObjectiveProfileSection({
    pid,
    catalogue,
    onChanged,
}: {
    pid: string;
    catalogue: ObjectiveCatalogueItem[];
    onChanged: () => void;
}) {
    const [profiles, setProfiles] = useState<BuiltinProfiles | null>(null);
    const [sets, setSets] = useState<ObjectiveSet[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [suggesting, setSuggesting] = useState(false);
    const [suggestLine, setSuggestLine] = useState('');
    const [alsoReplace, setAlsoReplace] = useState(false);
    const [newSetOpen, setNewSetOpen] = useState(false);
    const [newSetName, setNewSetName] = useState('');
    const [newSetPrefix, setNewSetPrefix] = useState('');
    // The row editor: `rowSet` is the set being edited, `rowOriginal` the code the
    // row had (null when the row is new), `rowForm` every field the catalogue
    // carries.
    const [rowSet, setRowSet] = useState<ObjectiveSet | null>(null);
    const [rowOriginal, setRowOriginal] = useState<string | null>(null);
    const [rowForm, setRowForm] = useState<ObjectiveSetRow>(EMPTY_ROW);
    // The history view, per set: absent = not asked for yet.
    const [diffs, setDiffs] = useState<Record<string, ObjectiveSetDiff>>({});

    const load = useCallback(async () => {
        try {
            const body = await listObjectiveProfiles(pid);
            // only a real answer is a profile list; anything else means "unknown"
            setProfiles(Array.isArray(body?.profiles) ? body : null);
        } catch {
            setProfiles(null);
        }
        try {
            const rows = await listObjectiveSets(pid);
            setSets(Array.isArray(rows) ? rows : []);
        } catch {
            setSets([]);
        }
    }, [pid]);

    useEffect(() => {
        void load();
    }, [load]);

    const run = async (work: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await work();
            await load();
            onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'the request failed');
        } finally {
            setBusy(false);
        }
    };

    const suggest = async () => {
        setSuggesting(true);
        setError('');
        try {
            const result = await suggestMappings(pid, alsoReplace);
            setSuggestLine(describeSuggestion(result));
            onChanged();
        } catch (e) {
            setSuggestLine('');
            setError(e instanceof Error ? e.message : 'the risk mapper could not run');
        } finally {
            setSuggesting(false);
        }
    };

    const openRow = (set: ObjectiveSet, row?: ObjectiveSetRow) => {
        setRowOriginal(row ? row.objective_id : null);
        setRowForm(row ? { ...row } : { ...EMPTY_ROW });
        setRowSet(set);
    };

    /** Save the edited row into the draft: replacing the row it came from. */
    const saveRow = async (set: ObjectiveSet) => {
        const row: ObjectiveSetRow = {
            ...rowForm,
            objective_id: rowForm.objective_id.trim(),
            macro_requirement: rowForm.macro_requirement.trim(),
            text: rowForm.text.trim(),
        };
        if (!row.objective_id || !row.macro_requirement || !row.text) {
            setError('a row needs an ID, a macro requirement and its text');
            return;
        }
        if (
            row.objective_id !== rowOriginal &&
            set.draft.some((r) => r.objective_id === row.objective_id)
        ) {
            setError(`objective ${row.objective_id} is already in the draft`);
            return;
        }
        const draft = rowOriginal
            ? set.draft.map((r) => (r.objective_id === rowOriginal ? row : r))
            : [...set.draft, row];
        await run(() =>
            updateObjectiveSet(pid, set.pid, {
                name: set.name,
                code_prefix: set.code_prefix,
                draft,
            }),
        );
        setRowSet(null);
        setRowOriginal(null);
    };

    /** The history view: what this draft would change of the published version. */
    const loadDiff = async (set: ObjectiveSet) => {
        try {
            const diff = await getObjectiveSetDiff(pid, set.pid);
            setDiffs((all) => ({ ...all, [set.pid]: diff }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'the comparison failed');
        }
    };

    const enableSetObjectives = async (set: ObjectiveSet) => {
        // Applying copies the published rows into the project's objectives; the
        // matrix then works on them like any other, so select them in the profile.
        const applied = await applyObjectiveSet(pid, set.pid);
        await setObjectiveProfile(pid, {
            objectives: applied.selected,
            key_objectives: [],
        });
    };

    return (
        <AppCard
            active
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon fontSize="small" sx={{ color: 'primary.main' }}>
                        tune
                    </Icon>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Profile and objective sets
                    </Typography>
                    {profiles && (
                        <Chip
                            size="small"
                            variant="outlined"
                            color="primary"
                            label={profiles.current_name || profiles.current || 'custom'}
                        />
                    )}
                </Box>
            }
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <TextField
                        select
                        size="small"
                        label="Profile"
                        inputProps={{ 'aria-label': 'Profile' }}
                        value={profiles?.current ?? ''}
                        disabled={busy || !profiles}
                        onChange={(e) => {
                            const key = e.target.value;
                            const chosen = profiles?.profiles.find((p) => p.key === key);
                            if (!chosen) return;
                            void run(() => chooseBuiltinProfile(pid, chosen.key, chosen.name));
                        }}
                        sx={{ minWidth: 220 }}
                    >
                        {(profiles?.profiles ?? []).map((profile) => (
                            <MenuItem key={profile.key} value={profile.key}>
                                {profile.name} ({profile.objectives.length})
                            </MenuItem>
                        ))}
                        {profiles && !profiles.profiles.some((p) => p.key === profiles.current) && (
                            <MenuItem value={profiles.current}>Custom</MenuItem>
                        )}
                    </TextField>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 420 }}>
                        {(profiles?.profiles ?? []).find((p) => p.key === profiles?.current)
                            ?.description ?? 'This project’s objectives are its own.'}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        startIcon={suggesting ? <CircularProgress size={14} /> : <Icon>auto_awesome</Icon>}
                        disabled={suggesting || busy}
                        onClick={() => void suggest()}
                        sx={{ textTransform: 'none' }}
                    >
                        Suggest with AI
                    </Button>
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={alsoReplace}
                                onChange={(e) => setAlsoReplace(e.target.checked)}
                            />
                        }
                        label={
                            <Typography variant="body2">
                                Also replace objectives I linked by hand
                            </Typography>
                        }
                    />
                    {suggestLine && (
                        <Typography variant="body2" color="text.secondary">
                            {suggestLine}
                        </Typography>
                    )}
                </Box>
                {error && <Typography color="error">{error}</Typography>}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                            This project&apos;s objective sets
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Icon fontSize="small">add</Icon>}
                            disabled={busy}
                            onClick={() => {
                                setNewSetName('');
                                setNewSetPrefix('');
                                setNewSetOpen(true);
                            }}
                            sx={{ textTransform: 'none' }}
                        >
                            New set from the catalogue
                        </Button>
                    </Box>
                    {sets.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                            No set yet. A set starts as a draft, is published as a numbered version,
                            and applying a version copies its rows into this project&apos;s objectives.
                        </Typography>
                    )}
                    {sets.map((set) => (
                        <Box
                            key={set.pid}
                            sx={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                                    {set.name}
                                    {set.code_prefix ? ` · ${set.code_prefix}` : ''}
                                </Typography>
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${set.draft.length} in the draft`}
                                />
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    color={set.published_version ? 'success' : 'default'}
                                    label={
                                        set.published_version
                                            ? `published v${set.published_version}`
                                            : 'not published'
                                    }
                                />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {set.draft.slice(0, 12).map((row) => (
                                    <Chip
                                        key={row.objective_id}
                                        size="small"
                                        label={row.objective_id}
                                        onClick={busy ? undefined : () => openRow(set, row)}
                                        onDelete={
                                            busy
                                                ? undefined
                                                : () =>
                                                      void run(() =>
                                                          updateObjectiveSet(pid, set.pid, {
                                                              name: set.name,
                                                              code_prefix: set.code_prefix,
                                                              draft: set.draft.filter(
                                                                  (r) => r.objective_id !== row.objective_id,
                                                              ),
                                                          }),
                                                      )
                                        }
                                    />
                                ))}
                                {set.draft.length > 12 && (
                                    <Chip size="small" variant="outlined" label={`+${set.draft.length - 12}`} />
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button
                                    size="small"
                                    disabled={busy}
                                    onClick={() => openRow(set)}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Add a row
                                </Button>
                                <Button
                                    size="small"
                                    disabled={busy || set.published_version === null}
                                    onClick={() => void loadDiff(set)}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Changes since v{set.published_version ?? 1}
                                </Button>
                                <Button
                                    size="small"
                                    disabled={busy || set.draft.length === 0}
                                    onClick={() => void run(() => publishObjectiveSet(pid, set.pid))}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Publish
                                </Button>
                                <Button
                                    size="small"
                                    disabled={busy || set.published_version === null}
                                    onClick={() => void run(() => enableSetObjectives(set))}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Apply to this project
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    disabled={busy}
                                    onClick={() => void run(() => deleteObjectiveSet(pid, set.pid))}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Delete
                                </Button>
                            </Box>
                            {diffs[set.pid] && (
                                <Box
                                    data-testid={`set-diff-${set.pid}`}
                                    sx={{
                                        borderTop: '1px dashed #e2e8f0',
                                        pt: 0.5,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 0.25,
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary">
                                        {diffs[set.pid].from_version === null
                                            ? 'Nothing published yet; the draft holds:'
                                            : `v${diffs[set.pid].from_version} → the draft:`}
                                    </Typography>
                                    <Typography variant="body2" className="brand-mono">
                                        {describeSetDiff(diffs[set.pid])}
                                    </Typography>
                                    {diffs[set.pid].changed.map((row) => (
                                        <Typography
                                            key={row.objective_id}
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {row.objective_id}:{' '}
                                            {row.fields
                                                .map(
                                                    (f) =>
                                                        `${f.field} “${f.before}” → “${f.after}”`,
                                                )
                                                .join('; ')}
                                        </Typography>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>

            <AppDialog
                open={newSetOpen}
                onClose={() => setNewSetOpen(false)}
                title="New objective set"
                maxWidth="sm"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={() => setNewSetOpen(false)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy || newSetName.trim() === ''}
                            onClick={() =>
                                void run(async () => {
                                    await createObjectiveSet(pid, {
                                        name: newSetName.trim(),
                                        code_prefix: newSetPrefix.trim(),
                                        draft: setRowsFromCatalogue(catalogue),
                                    });
                                    setNewSetOpen(false);
                                })
                            }
                            sx={{ textTransform: 'none' }}
                        >
                            Create
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Name"
                        inputProps={{ 'aria-label': 'Set name' }}
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Code prefix (e.g. CX)"
                        inputProps={{ 'aria-label': 'Set code prefix' }}
                        value={newSetPrefix}
                        onChange={(e) => setNewSetPrefix(e.target.value)}
                    />
                    <Typography variant="caption" color="text.secondary">
                        The draft starts from the {catalogue.length} objectives of this project&apos;s
                        catalogue; remove or add rows before publishing.
                    </Typography>
                </Box>
            </AppDialog>

            <AppDialog
                open={rowSet !== null}
                onClose={() => setRowSet(null)}
                title={`${rowOriginal ? 'Edit' : 'Add'} a row in ${rowSet?.name ?? ''}`}
                maxWidth="sm"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={() => setRowSet(null)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy}
                            onClick={() => rowSet && void saveRow(rowSet)}
                            sx={{ textTransform: 'none' }}
                        >
                            {rowOriginal ? 'Save' : 'Add'}
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {SET_ROW_FIELDS.map((field) => (
                        <TextField
                            key={field.key}
                            size="small"
                            fullWidth
                            multiline={field.multiline}
                            minRows={field.multiline ? 2 : undefined}
                            label={field.label}
                            inputProps={{ 'aria-label': field.aria }}
                            value={rowForm[field.key]}
                            onChange={(e) =>
                                setRowForm((row) => ({ ...row, [field.key]: e.target.value }))
                            }
                        />
                    ))}
                </Box>
            </AppDialog>
        </AppCard>
    );
}
