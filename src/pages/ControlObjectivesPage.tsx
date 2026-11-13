import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';
import toast from 'react-hot-toast';
import '../styles/common.css';
import AppDialog from '../components/AppDialog';
import AppCard from '../components/AppCard';
import SideDrawer from '../components/SideDrawer';
import RiskRegisterSection from '../components/RiskRegisterSection';
import {
    addObjectiveCatalogueItem,
    deleteObjectiveCatalogueItem,
    getObjectiveProfile,
    getObjectivesMatrix,
    listObjectiveCatalogue,
    parseObjectiveImport,
    setObjectiveProfile,
    updateObjectiveCatalogueItem,
    type ObjectiveCatalogueIn,
    type ObjectiveCatalogueItem,
    type ObjectiveMapping,
    type ObjectivePriority,
    type ObjectiveRisk,
} from '../lib/qualification';

function objectiveTagsOf(c: ObjectiveCatalogueItem): string[] {
    const tags = [c.assessment_mode, c.macro_requirement.split(/\s+/)[0]].filter(Boolean);
    if (c.custom) tags.push('custom');
    return tags;
}

/** Control objectives, as their own step: the risk & control matrix behind the
 *  scores, the key-objective selection and the catalogue behind each objective.
 *  Scores are computed on every read, so a changed risk rating can never leave
 *  a stale score. */
export default function ControlObjectivesPage() {
    const { projectUUID: pid } = useProject();
    const [objectives, setObjectives] = useState<ObjectivePriority[] | null>(null);
    const [objectiveSel, setObjectiveSel] = useState<ObjectivePriority | null>(null);
    const [objectiveDetail, setObjectiveDetail] = useState<ObjectiveCatalogueItem | null>(null);
    const [objectiveBusy, setObjectiveBusy] = useState(false);
    const [objectiveCatalogueList, setObjectiveCatalogueList] = useState<ObjectiveCatalogueItem[]>([]);
    const [objectiveQuery, setObjectiveQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<ObjectiveCatalogueIn>({
        objective_id: '',
        macro_requirement: '',
        legal_basis: '',
        sub_requirement_label: '',
        text: '',
        assessment_mode: 'Control',
        target: '',
        standards_grounding: '',
        grounding_tier_flag: '',
        notes: '',
    });
    const [objectiveIdError, setObjectiveIdError] = useState<string | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);

    const [objectiveExploreOpen, setObjectiveExploreOpen] = useState(false);
    const [risks, setRisks] = useState<ObjectiveRisk[]>([]);
    const [mappings, setMappings] = useState<ObjectiveMapping[]>([]);
    const [enabledIds, setEnabledIds] = useState<string[]>([]);
    const [objectiveTags, setObjectiveTags] = useState<string[]>([]);
    const [selectedObjectiveTags, setSelectedObjectiveTags] = useState<string[]>([]);

    const refresh = useCallback(async () => {
        if (!pid) return;
        setError(null);
        try {
            const matrix = await getObjectivesMatrix(pid);
            setObjectives(matrix.priorities);
            setRisks(matrix.risks ?? []);
            setMappings(matrix.mappings ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load control objectives');
        }
        try {
            const cat = await listObjectiveCatalogue(pid);
            setObjectiveCatalogueList(cat);
            setObjectiveTags(
                Array.from(new Set(cat.flatMap(objectiveTagsOf))).sort(),
            );
            const profile = await getObjectiveProfile(pid);
            setEnabledIds(profile?.objectives ?? []);
        } catch {
            setObjectiveCatalogueList([]);
        }
    }, [pid]);

    useEffect(() => {
        setObjectives(null);
        void refresh();
    }, [refresh]);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open control objectives.</Typography>;
    }

    const openObjective = async (o: ObjectivePriority) => {
        setObjectiveSel(o);
        setObjectiveDetail(null);
        try {
            const list = await listObjectiveCatalogue(pid);
            setObjectiveDetail(list.find((x) => x.id === o.objective_id) ?? null);
        } catch {
            setObjectiveDetail(null);
        }
    };

    const setKeyObjective = async (objectiveId: string, key: boolean) => {
        setObjectiveBusy(true);
        try {
            const profile = await getObjectiveProfile(pid);
            const current =
                profile?.key_objectives ??
                objectives?.filter((x) => x.key).map((x) => x.objective_id) ??
                [];
            const next = key
                ? [...current.filter((id) => id !== objectiveId), objectiveId]
                : current.filter((id) => id !== objectiveId);
            await setObjectiveProfile(pid, {
                objectives: enabledIds,
                key_objectives: next,
            });
            await refresh();
            setObjectiveSel((prev) =>
                prev && prev.objective_id === objectiveId ? { ...prev, key } : prev,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to update objective');
        } finally {
            setObjectiveBusy(false);
        }
    };

    const toggleKeyObjective = async (o: ObjectivePriority) => {
        await setKeyObjective(o.objective_id, !o.key);
    };

    const setEnabledObjective = async (objectiveId: string, enabled: boolean) => {
        if (!enabled && mappings.some((m) => m.objective_id === objectiveId)) {
            toast.error(
                'This control objective is used by at least one risk — remove the risk mapping before disabling it.',
            );
            return;
        }
        setObjectiveBusy(true);
        try {
            const next = enabled
                ? [...enabledIds.filter((id) => id !== objectiveId), objectiveId]
                : enabledIds.filter((id) => id !== objectiveId);
            const keys = (objectives ?? [])
                .filter((o) => o.key && o.objective_id !== objectiveId)
                .map((o) => o.objective_id);
            await setObjectiveProfile(pid, {
                objectives: next,
                key_objectives: keys,
            });
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to update objective');
        } finally {
            setObjectiveBusy(false);
        }
    };

    /** Next catalogue ID: the highest existing `O<n>` plus one. */
    const nextObjectiveId = (): string => {
        let max = 0;
        for (const c of objectiveCatalogueList) {
            const m = /^O(\d+)$/i.exec(c.id);
            if (m) max = Math.max(max, Number(m[1]));
        }
        return `O${max + 1}`;
    };

    const openAddObjective = () => {
        setEditingId(null);
        setObjectiveIdError(null);
        setEditFields({
            objective_id: nextObjectiveId(),
            macro_requirement: '',
            legal_basis: '',
            sub_requirement_label: '',
            text: '',
            assessment_mode: 'Control',
            target: '',
            standards_grounding: '',
            grounding_tier_flag: '',
            notes: '',
        });
        setEditOpen(true);
    };

    const openEditObjective = (item: ObjectiveCatalogueItem) => {
        setEditingId(item.id);
        setObjectiveIdError(null);
        setEditFields({
            objective_id: item.id,
            macro_requirement: item.macro_requirement,
            legal_basis: item.legal_basis,
            sub_requirement_label: item.sub_requirement_label,
            text: item.text,
            assessment_mode: item.assessment_mode || 'Control',
            target: '',
            standards_grounding: '',
            grounding_tier_flag: '',
            notes: '',
        });
        setEditOpen(true);
    };

    const saveObjectiveEdit = async () => {
        const trimmed = {
            objective_id: (editFields.objective_id ?? '').trim(),
            macro_requirement: (editFields.macro_requirement ?? '').trim(),
            text: (editFields.text ?? '').trim(),
        };
        if (!trimmed.objective_id || !trimmed.macro_requirement || !trimmed.text) {
            setError('ID, macro requirement and text are required.');
            return;
        }
        if (!editingId && objectiveCatalogueList.some((c) => c.id === trimmed.objective_id)) {
            setObjectiveIdError(`ID '${trimmed.objective_id}' already exists in the catalogue.`);
            return;
        }
        setError(null);
        setBusy(true);
        try {
            if (editingId) {
                await updateObjectiveCatalogueItem(pid, editingId, {
                    ...editFields,
                    objective_id: editFields.objective_id.trim(),
                });
            } else {
                await addObjectiveCatalogueItem(pid, {
                    ...editFields,
                    objective_id: editFields.objective_id.trim(),
                });
            }
            setEditOpen(false);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(false);
        }
    };

    const removeObjective = async (id: string) => {
        setError(null);
        setBusy(true);
        try {
            await deleteObjectiveCatalogueItem(pid, id);
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(false);
        }
    };

    const importObjectives = async (file: File) => {
        let items: ObjectiveCatalogueIn[];
        try {
            items = parseObjectiveImport(await file.text());
        } catch {
            setError('that file is not a valid objective import');
            return;
        }
        if (items.length === 0) {
            setError('that file contains no objectives');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            for (const item of items) {
                await addObjectiveCatalogueItem(pid, item);
            }
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(false);
        }
    };

    const loading = objectives === null;

    const objectiveRisks = objectiveSel
        ? mappings
              .filter((m) => m.objective_id === objectiveSel.objective_id)
              .map((m) => risks.find((r) => r.pid === m.risk_pid))
              .filter((r): r is ObjectiveRisk => r !== undefined)
        : [];

    // Live ID validation: pure client-side against the already-loaded list.
    const creating = editingId === null;
    const typedId = (editFields.objective_id ?? '').trim();
    const idExists = creating && typedId !== '' && objectiveCatalogueList.some((c) => c.id === typedId);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Control objectives
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon>storefront</Icon>}
                    onClick={() => setObjectiveExploreOpen(true)}
                    sx={{ textTransform: 'none' }}
                >
                    Explore catalogue
                </Button>
            </Box>

            <Typography variant="body2" color="text.secondary">
                Which objectives matter most is decided by the project&apos;s own risks:
                each risk is rated impact × likelihood, an objective scores the sum of
                the ratings of the risks it mitigates, and key objectives default to the
                ones driven by a High or Critical risk.
            </Typography>

            <RiskRegisterSection pid={pid} onChanged={() => void refresh()} />

            {error && <Typography color="error">{error}</Typography>}
            {loading && <CircularProgress size={24} />}

            <AppDialog
                open={objectiveExploreOpen}
                onClose={() => setObjectiveExploreOpen(false)}
                title="Select control objectives"
                maxWidth="lg"
                fullWidth
                actions={
                    <>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            startIcon={<Icon>add</Icon>}
                            onClick={() => {
                                setObjectiveExploreOpen(false);
                                openAddObjective();
                            }}
                            sx={{ textTransform: 'none' }}
                        >
                            Add a control objective
                        </Button>
                        <Button
                            onClick={() => setObjectiveExploreOpen(false)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Close
                        </Button>
                    </>
                }
                actionsSx={{ justifyContent: 'space-between' }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search catalogue..."
                        value={objectiveQuery}
                        onChange={(e) => setObjectiveQuery(e.target.value)}
                    />
                    {objectiveTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {objectiveTags.map((tag) => (
                                <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    color={selectedObjectiveTags.includes(tag) ? 'primary' : 'default'}
                                    variant={selectedObjectiveTags.includes(tag) ? 'filled' : 'outlined'}
                                    onClick={() =>
                                        setSelectedObjectiveTags((prev) =>
                                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                                        )
                                    }
                                />
                            ))}
                        </Box>
                    )}
                    <Typography variant="body2" color="text.secondary">
                        The matrix works on every catalogue row: flip a row&apos;s
                        switch to mark it key or not. The seeded catalogue (O1–O50) is
                        read-only; rows your project adds carry a custom badge.
                    </Typography>
                    <Grid container spacing={1.5} className="plugins-grid">
                        {objectiveCatalogueList
                            .filter(
                                (c) =>
                                    (objectiveQuery === '' ||
                                        c.id.toLowerCase().includes(objectiveQuery.toLowerCase()) ||
                                        c.text.toLowerCase().includes(objectiveQuery.toLowerCase()) ||
                                        c.macro_requirement.toLowerCase().includes(objectiveQuery.toLowerCase())) &&
                                    (selectedObjectiveTags.length === 0 ||
                                        objectiveTagsOf(c).some((t) => selectedObjectiveTags.includes(t))),
                            )
                            .map((c) => {
                                const standing = objectives?.find((o) => o.objective_id === c.id);
                                const enabled = enabledIds.includes(c.id);
                                const usedByRisks = mappings.filter(
                                    (m) => m.objective_id === c.id,
                                ).length;
                                return (
                                    <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                        <AppCard
                                            theme="catalogue"
                                            active={enabled}
                                            onClick={() => {
                                                if (enabled && usedByRisks > 0) {
                                                    toast.error(
                                                        'This control objective is used by at least one risk — remove the risk mapping before disabling it.',
                                                    );
                                                    return;
                                                }
                                                void setEnabledObjective(c.id, !enabled);
                                            }}
                                            header={
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                    <Chip
                                                        label={c.id}
                                                        size="small"
                                                        variant="outlined"
                                                        color="primary"
                                                        sx={{ flexShrink: 0 }}
                                                    />
                                                    <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 0, flexGrow: 1 }}>
                                                        {c.text || c.macro_requirement || c.id}
                                                    </Typography>
                                                </Box>
                                            }
                                        >
                                                {c.macro_requirement && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {c.macro_requirement}
                                                    </Typography>
                                                )}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto', pt: 1 }}>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {c.assessment_mode && (
                                                            <Chip label={c.assessment_mode} size="small" color="info" variant="outlined" />
                                                        )}
                                                        {c.custom && <Chip label="custom" size="small" color="primary" />}
                                                        {usedByRisks > 0 && (
                                                            <Chip
                                                                label={`used by ${usedByRisks} risk${usedByRisks === 1 ? '' : 's'}`}
                                                                size="small"
                                                                color="error"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Typography variant="caption">Key</Typography>
                                                        <Switch
                                                            size="small"
                                                            checked={standing?.key ?? false}
                                                            disabled={objectiveBusy || !enabled}
                                                            onChange={(_, checked) =>
                                                                void setKeyObjective(c.id, checked)
                                                            }
                                                        />
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    {c.custom && (
                                                        <>
                                                            <Button
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditObjective(c);
                                                                }}
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                color="error"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void removeObjective(c.id);
                                                                }}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </>
                                                    )}
                                                </Box>
                                        </AppCard>
                                    </Grid>
                                );
                            })}
                    </Grid>
                </Box>
            </AppDialog>

            <AppDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title={editingId ? `Edit objective — ${editingId}` : 'Add control objective'}
                maxWidth="md"
                fullWidth
                actions={
                    <>
                        {!editingId && (
                            <>
                                <Button
                                    onClick={() => importFileRef.current?.click()}
                                    variant="outlined"
                                    startIcon={<Icon>file_upload</Icon>}
                                    disabled={busy}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Import
                                </Button>
                                <input
                                    ref={importFileRef}
                                    type="file"
                                    accept="application/json,.json"
                                    hidden
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = '';
                                        if (file) void importObjectives(file);
                                    }}
                                />
                            </>
                        )}
                        <Button
                            onClick={() => setEditOpen(false)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy}
                            onClick={() => void saveObjectiveEdit()}
                            sx={{ textTransform: 'none' }}
                        >
                            Save objective
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                        size="small"
                        fullWidth
                        required
                        label="ID (must be unique, e.g. CX-1)"
                        value={editFields.objective_id}
                        onChange={(e) => {
                            setEditFields((p) => ({ ...p, objective_id: e.target.value }));
                            setObjectiveIdError(null);
                        }}
                        disabled={busy || editingId !== null}
                        error={Boolean(objectiveIdError) || idExists}
                        FormHelperTextProps={
                            creating && typedId !== '' && !idExists
                                ? { sx: { color: 'success.main' } }
                                : undefined
                        }
                        helperText={
                            objectiveIdError ??
                            (creating && typedId !== ''
                                ? idExists
                                    ? `ID '${typedId}' already exists — suggested: ${nextObjectiveId()}`
                                    : 'available'
                                : !editingId
                                  ? `Suggested: ${nextObjectiveId()}`
                                  : undefined)
                        }
                    />
                    <TextField
                        size="small"
                        fullWidth
                        required
                        label="Macro requirement"
                        value={editFields.macro_requirement}
                        onChange={(e) => setEditFields((p) => ({ ...p, macro_requirement: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Legal basis (optional)"
                        value={editFields.legal_basis}
                        onChange={(e) => setEditFields((p) => ({ ...p, legal_basis: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Sub-requirement (optional)"
                        value={editFields.sub_requirement_label}
                        onChange={(e) => setEditFields((p) => ({ ...p, sub_requirement_label: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        multiline
                        minRows={3}
                        fullWidth
                        required
                        label="Text"
                        value={editFields.text}
                        onChange={(e) => setEditFields((p) => ({ ...p, text: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        select
                        size="small"
                        fullWidth
                        label="Assessment mode"
                        value={editFields.assessment_mode || 'Control'}
                        onChange={(e) => setEditFields((p) => ({ ...p, assessment_mode: e.target.value }))}
                        disabled={busy}
                    >
                        {['Control', 'Test', 'Control + Test'].map((m) => (
                            <MenuItem key={m} value={m}>
                                {m}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        size="small"
                        fullWidth
                        label="Target (optional)"
                        value={editFields.target}
                        onChange={(e) => setEditFields((p) => ({ ...p, target: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Standards grounding (optional)"
                        value={editFields.standards_grounding}
                        onChange={(e) => setEditFields((p) => ({ ...p, standards_grounding: e.target.value }))}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Notes (VOLUNTARY… marks a non-binding objective)"
                        value={editFields.notes}
                        onChange={(e) => setEditFields((p) => ({ ...p, notes: e.target.value }))}
                        disabled={busy}
                    />
                </Box>
            </AppDialog>


            <SideDrawer
                open={objectiveSel !== null}
                onClose={() => setObjectiveSel(null)}
                title={objectiveSel?.objective_id ?? 'Control objective'}
                mode="view"
                headerAction={
                    objectiveSel ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption">Key objective</Typography>
                            <Switch
                                size="small"
                                checked={objectiveSel.key}
                                disabled={objectiveBusy}
                                onChange={() => void toggleKeyObjective(objectiveSel)}
                            />
                        </Box>
                    ) : undefined
                }
            >
                {objectiveDetail && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Typography variant="body2">
                            <strong>Macro requirement:</strong> {objectiveDetail.macro_requirement}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Legal basis:</strong> {objectiveDetail.legal_basis}
                        </Typography>
                        <Typography variant="body2">{objectiveDetail.text}</Typography>
                    </Box>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
                    <Chip label={`score ${objectiveSel?.score}`} size="small" color="info" variant="outlined" />
                    {objectiveSel?.likelihood != null && (
                        <Chip label={`likelihood ${objectiveSel.likelihood}`} size="small" color="success" variant="outlined" />
                    )}
                    <Chip label={`rank ${objectiveSel?.rank}`} size="small" color="secondary" variant="outlined" />
                    <Chip label={`top rating ${objectiveSel?.top_rating}`} size="small" color="success" variant="outlined" />
                    {objectiveSel?.key && <Chip label="key" size="small" color="primary" variant="filled" />}
                </Box>
                {objectiveSel?.comment && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {objectiveSel.comment}
                    </Typography>
                )}
                {objectiveRisks.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                            Associated risks ({objectiveRisks.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {objectiveRisks.map((risk) => (
                                <Chip
                                    key={risk.pid}
                                    size="small"
                                    variant="outlined"
                                    label={`${risk.name || `Risk ${risk.position}`} · rating ${risk.rating || 'unrated'}`}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
                {(objectiveSel?.reasons ?? []).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">Reasons</Typography>
                        {objectiveSel!.reasons.map((r, i) => (
                            <Typography key={i} variant="body2" color="text.secondary">
                                {r}
                            </Typography>
                        ))}
                    </Box>
                )}
            </SideDrawer>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icon sx={{ color: 'primary.main' }}>check_circle</Icon>
                <Typography variant="h6">Selected control objectives</Typography>
            </Box>
            {!loading && enabledIds.length === 0 && (
                <Typography color="text.secondary">
                    No objectives selected yet — pick a subset to configure.
                </Typography>
            )}
            {!loading && enabledIds.length > 0 && (
                <Grid container spacing={2} className="plugins-grid">
                    {objectiveCatalogueList
                        .filter((c) => enabledIds.includes(c.id))
                        .map((c) => ({
                            c,
                            standing: objectives?.find((o) => o.objective_id === c.id) ?? null,
                        }))
                        .sort(
                            (a, b) =>
                                (b.standing?.score ?? 0) - (a.standing?.score ?? 0) ||
                                (a.standing?.rank ?? 0) - (b.standing?.rank ?? 0),
                        )
                        .map(({ c, standing }) => (
                            <Grid key={c.id} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                                <AppCard
                                    active
                                    onClick={() => {
                                        if (standing) void openObjective(standing);
                                    }}
                                    header={
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {c.text || c.macro_requirement || c.id}
                                        </Typography>
                                    }
                                >
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: 0.5 }}>
                                            <Chip
                                                label={c.id}
                                                size="small"
                                                color={standing?.key ? 'primary' : 'default'}
                                                variant={standing?.key ? 'filled' : 'outlined'}
                                            />
                                            {standing && (
                                                <Chip label={`score ${standing.score}`} size="small" color="info" variant="outlined" />
                                            )}
                                            {standing?.likelihood != null && (
                                                <Chip label={`likelihood ${standing.likelihood}`} size="small" color="success" variant="outlined" />
                                            )}
                                            {standing && (
                                                <Chip label={`rank ${standing.rank}`} size="small" color="secondary" variant="outlined" />
                                            )}
                                        </Box>
                                </AppCard>
                            </Grid>
                        ))}
                </Grid>
            )}
        </Box>
    );
}
