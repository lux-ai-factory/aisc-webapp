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
    type ObjectiveSetRow,
} from '../lib/qualification';

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
    const [rowOpen, setRowOpen] = useState<ObjectiveSet | null>(null);
    const [rowId, setRowId] = useState('');
    const [rowMacro, setRowMacro] = useState('');
    const [rowText, setRowText] = useState('');

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

    const addRow = async (set: ObjectiveSet) => {
        const objective_id = rowId.trim();
        if (!objective_id || !rowMacro.trim() || !rowText.trim()) {
            setError('a row needs an ID, a macro requirement and its text');
            return;
        }
        const row: ObjectiveSetRow = {
            objective_id,
            macro_requirement: rowMacro.trim(),
            text: rowText.trim(),
            legal_basis: '',
            sub_requirement_label: '',
            assessment_mode: '',
            target: '',
            standards_grounding: '',
            grounding_tier_flag: '',
            notes: '',
        };
        await run(() =>
            updateObjectiveSet(pid, set.pid, {
                name: set.name,
                code_prefix: set.code_prefix,
                draft: [...set.draft, row],
            }),
        );
        setRowId('');
        setRowMacro('');
        setRowText('');
        setRowOpen(null);
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
                                    onClick={() => {
                                        setRowId('');
                                        setRowMacro('');
                                        setRowText('');
                                        setRowOpen(set);
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Add a row
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
                open={rowOpen !== null}
                onClose={() => setRowOpen(null)}
                title={`Add a row to ${rowOpen?.name ?? ''}`}
                maxWidth="sm"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={() => setRowOpen(null)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy}
                            onClick={() => rowOpen && void addRow(rowOpen)}
                            sx={{ textTransform: 'none' }}
                        >
                            Add
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Objective ID"
                        inputProps={{ 'aria-label': 'Row objective ID' }}
                        value={rowId}
                        onChange={(e) => setRowId(e.target.value)}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Macro requirement"
                        inputProps={{ 'aria-label': 'Row macro requirement' }}
                        value={rowMacro}
                        onChange={(e) => setRowMacro(e.target.value)}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        label="Text"
                        inputProps={{ 'aria-label': 'Row text' }}
                        value={rowText}
                        onChange={(e) => setRowText(e.target.value)}
                    />
                </Box>
            </AppDialog>
        </AppCard>
    );
}
