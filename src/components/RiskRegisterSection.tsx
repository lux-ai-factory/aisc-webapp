import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SecurityIcon from '@mui/icons-material/Security';
import toast from 'react-hot-toast';
import AppDialog from './AppDialog';
import AppCard from './AppCard';
import VersionSelect from './VersionSelect';
import '../styles/common.css';
import {
    addRiskMapping,
    deleteRisk,
    deleteRiskMapping,
    getObjectiveProfile,
    importCardRisks,
    latestCardHasRisks,
    listObjectiveCatalogue,
    listRiskMappings,
    listRiskRegister,
    listRiskVersions,
    rateRisk,
    riskVersionEntries,
    type ObjectiveCatalogueItem,
    type ObjectiveMapping,
    type ObjectiveRisk,
    type RiskVersion,
} from '../lib/qualification';

function ratingBand(rating: number): {
    label: string;
    color: 'default' | 'success' | 'info' | 'warning' | 'error';
} {
    if (rating <= 0) return { label: 'unrated', color: 'default' };
    if (rating <= 4) return { label: 'Low', color: 'success' };
    if (rating <= 9) return { label: 'Medium', color: 'info' };
    if (rating <= 16) return { label: 'High', color: 'warning' };
    return { label: 'Critical', color: 'error' };
}

const RATINGS = [1, 2, 3, 4, 5];
const toNumber = (v: string) => (v === '' ? null : Number(v));

export default function RiskRegisterSection({
    pid,
    onChanged,
}: {
    pid: string;
    onChanged?: () => void;
}) {
    const [risks, setRisks] = useState<ObjectiveRisk[] | null>(null);
    const [mappings, setMappings] = useState<ObjectiveMapping[]>([]);
    const [catalogue, setCatalogue] = useState<ObjectiveCatalogueItem[]>([]);
    const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [editor, setEditor] = useState<{
        open: boolean;
        pid: string | null;
        name: string;
        impact: string;
        likelihood: string;
        comment: string;
        mapped: string[];
    }>({ open: false, pid: null, name: '', impact: '', likelihood: '', comment: '', mapped: [] });
    const [riskVersions, setRiskVersions] = useState<RiskVersion[]>([]);
    const [versionSel, setVersionSel] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [riskList, mappingList, cat, profile] = await Promise.all([
                listRiskRegister(pid),
                listRiskMappings(pid),
                listObjectiveCatalogue(pid),
                getObjectiveProfile(pid),
            ]);
            setRisks(riskList);
            setMappings(mappingList);
            setCatalogue(cat);
            setEnabledIds(new Set(profile?.objectives ?? []));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load the risk register');
        }
    }, [pid]);

    useEffect(() => {
        setRisks(null);
        void load();
    }, [load]);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            await load();
            onChanged?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(false);
        }
    };

    const refreshEnabled = async () => {
        try {
            const [cat, profile] = await Promise.all([
                listObjectiveCatalogue(pid),
                getObjectiveProfile(pid),
            ]);
            setCatalogue(cat);
            setEnabledIds(new Set(profile?.objectives ?? []));
        } catch {
            // keep the current catalogue/enabled set on failure
        }
    };

    const mappedObjectives = (riskPid: string) =>
        mappings.filter((m) => m.risk_pid === riskPid).map((m) => m.objective_id);

    const importFromCard = async () => {
        setBusy(true);
        try {
            if (!(await latestCardHasRisks(pid))) {
                toast('No risks in the AI card to load.', {
                    position: 'bottom-right',
                    icon: 'ℹ️',
                });
                return;
            }
            await importCardRisks(pid);
            await load();
            onChanged?.();
            toast.success('risks reloaded from AI card', { position: 'bottom-right' });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not import risks from the AI card', {
                position: 'bottom-right',
            });
        } finally {
            setBusy(false);
        }
    };

    const openEdit = (risk: ObjectiveRisk) => {
        setRiskVersions([]);
        setVersionSel(null);
        setEditor({
            open: true,
            pid: risk.pid,
            name: risk.name || `Risk ${risk.position}`,
            impact: risk.impact == null ? '' : String(risk.impact),
            likelihood: risk.likelihood == null ? '' : String(risk.likelihood),
            comment: risk.comment,
            mapped: mappedObjectives(risk.pid),
        });
        void refreshEnabled();
        void listRiskVersions(pid, risk.pid)
            .then((versions) => {
                setRiskVersions(versions);
                setVersionSel(versions.length > 0 ? String(versions[versions.length - 1].number) : null);
            })
            .catch(() => setRiskVersions([]));
    };

    const navigateRiskVersion = (v: { id?: string }) => {
        if (!editor.pid || !v.id || v.id === 'current') {
            if (v.id) setVersionSel(v.id);
            return;
        }
        const version = riskVersions.find((x) => x.number === Number(v.id));
        if (!version) return;
        setVersionSel(String(version.number));
        setEditor((p) => ({
            ...p,
            impact: version.impact == null ? '' : String(version.impact),
            likelihood: version.likelihood == null ? '' : String(version.likelihood),
            comment: version.comment,
        }));
    };

    const toggleMap = (objectiveId: string) =>
        setEditor((p) => ({
            ...p,
            mapped: p.mapped.includes(objectiveId)
                ? p.mapped.filter((id) => id !== objectiveId)
                : [...p.mapped, objectiveId],
        }));

    const saveEditor = () =>
        run(async () => {
            // Risks are declared in the AI card, never created by hand here, so
            // the dialog only ever edits an existing risk's rating/mapping.
            if (!editor.pid) return;
            const riskPid = editor.pid;
            const ratings = {
                impact: toNumber(editor.impact),
                likelihood: toNumber(editor.likelihood),
                comment: editor.comment,
            };
            await rateRisk(pid, riskPid, ratings);
            const current = new Set(
                mappings.filter((m) => m.risk_pid === riskPid).map((m) => m.objective_id),
            );
            const selected = new Set(editor.mapped);
            for (const id of selected) {
                if (!current.has(id)) {
                    await addRiskMapping(pid, riskPid, id);
                }
            }
            for (const id of current) {
                if (!selected.has(id)) {
                    const mapping = mappings.find(
                        (m) => m.risk_pid === riskPid && m.objective_id === id,
                    );
                    if (mapping) await deleteRiskMapping(pid, mapping.pid);
                }
            }
            setEditor((e) => ({ ...e, open: false }));
        });

    const removeRisk = (risk: ObjectiveRisk) =>
        run(async () => {
            await deleteRisk(pid, risk.pid);
        });

    const objectivesById = new Map(catalogue.map((c) => [c.id, c]));
    const offered = catalogue.filter((c) => enabledIds.has(c.id) || editor.mapped.includes(c.id));

    const loading = risks === null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
            <Box className="page-header">
                <SecurityIcon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }} />
                <Typography variant="h6" className="page-header-title">
                    Risk register
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    size="small"
                    startIcon={<Icon fontSize="small">refresh</Icon>}
                    disabled={busy}
                    onClick={() => void importFromCard()}
                    sx={{ textTransform: 'none' }}
                >
                    Reload risks
                </Button>
            </Box>

            {error && <Typography color="error">{error}</Typography>}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : risks.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    No risks yet — load them from the AI card. Each risk is rated
                    impact × likelihood (1–5), and ratings drive the control
                    objectives&apos; scores.
                </Typography>
            ) : (
                <Grid container spacing={2} className="plugins-grid">
                    {risks.map((risk) => {
                        const rating = (risk.impact ?? 0) * (risk.likelihood ?? 0);
                        const band = ratingBand(rating);
                        const mapped = mappedObjectives(risk.pid);
                        return (
                            <Grid key={risk.pid} size={{ xs: 12, md: 6, lg: 4 }}>
                                <AppCard
                                    active
                                    header={
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1 }}>
                                            <Tooltip title={risk.name || `Risk ${risk.position}`} placement="top">
                                                <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                                                    {risk.name || `Risk ${risk.position}`}
                                                </Typography>
                                            </Tooltip>
                                            <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                                                <Chip
                                                    label={`${rating > 0 ? rating : '—'} · ${band.label}`}
                                                    size="small"
                                                    color={band.color}
                                                    variant={band.color === 'default' ? 'outlined' : 'filled'}
                                                />
                                                <Tooltip title="Edit risk" placement="top">
                                                    <IconButton size="small" aria-label="Edit risk" onClick={() => openEdit(risk)}>
                                                        <Icon fontSize="small">edit</Icon>
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete risk" placement="top">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            disabled={busy}
                                                            onClick={() => void removeRisk(risk)}
                                                        >
                                                            <Icon fontSize="small">delete</Icon>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Stack>
                                        </Stack>
                                    }
                                >
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mt: 1,
                                                whiteSpace: 'pre-wrap',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {risk.comment || 'No comment yet.'}
                                        </Typography>

                                        <Box sx={{ mt: 'auto', pt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                                                <Chip label={`Impact: ${risk.impact ?? '—'}`} size="small" sx={{ height: 22, fontWeight: 600, bgcolor: '#7c3aed', color: '#fff' }} />
                                                <Chip label={`Likelihood: ${risk.likelihood ?? '—'}`} size="small" sx={{ height: 22, fontWeight: 600, bgcolor: '#ea580c', color: '#fff' }} />
                                                <Chip label={`${mapped.length} objective${mapped.length === 1 ? '' : 's'}`} size="small" variant="outlined" sx={{ height: 22, fontWeight: 600 }} />
                                            </Stack>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                                {mapped.map((id) => (
                                                    <Chip key={id} label={objectivesById.get(id)?.id ?? id} size="small" color="primary" variant="outlined" />
                                                ))}
                                            </Box>
                                        </Box>
                                </AppCard>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            <AppDialog
                open={editor.open}
                onClose={() => setEditor((e) => ({ ...e, open: false }))}
                maxWidth="md"
                fullWidth
                title={`Edit risk — ${editor.name}`}
                actions={
                    <>
                        <Button
                            onClick={() => setEditor((e) => ({ ...e, open: false }))}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy}
                            onClick={() => void saveEditor()}
                            sx={{ textTransform: 'none' }}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <Stack spacing={2}>
                    {editor.pid !== null && riskVersionEntries(riskVersions).length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                History
                            </Typography>
                            <VersionSelect
                                options={riskVersionEntries(riskVersions)}
                                value={versionSel}
                                fallbackLabel={
                                    riskVersionEntries(riskVersions)[riskVersionEntries(riskVersions).length - 1]
                                        ?.label ?? 'Version'
                                }
                                onSelect={(id) => {
                                    const entry = riskVersionEntries(riskVersions).find((v) => v.id === id);
                                    if (entry) navigateRiskVersion(entry);
                                }}
                            />
                        </Box>
                    )}
                    <Stack direction="row" spacing={1.5}>
                        <TextField
                            select
                            label="Impact"
                            value={editor.impact}
                            onChange={(e) => setEditor((p) => ({ ...p, impact: e.target.value }))}
                            sx={{ flexGrow: 1, minWidth: 0 }}
                        >
                            <MenuItem value="">Unrated</MenuItem>
                            {RATINGS.map((v) => (
                                <MenuItem key={v} value={String(v)}>
                                    {v}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Likelihood"
                            value={editor.likelihood}
                            onChange={(e) => setEditor((p) => ({ ...p, likelihood: e.target.value }))}
                            sx={{ flexGrow: 1, minWidth: 0 }}
                        >
                            <MenuItem value="">Unrated</MenuItem>
                            {RATINGS.map((v) => (
                                <MenuItem key={v} value={String(v)}>
                                    {v}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                    <TextField
                        label="Comment (optional)"
                        multiline
                        minRows={3}
                        value={editor.comment}
                        onChange={(e) => setEditor((p) => ({ ...p, comment: e.target.value }))}
                        placeholder="Why this rating?"
                        inputProps={{ 'aria-label': 'Comment' }}
                    />

                    <Box>
                        <Typography variant="subtitle2">Control objectives that mitigate this risk</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Only the project&apos;s selected control objectives are offered; they
                            appear as chips on the risk&apos;s card.
                        </Typography>
                        <Grid container spacing={1} sx={{ mt: 0.5 }}>
                            {offered.length === 0 ? (
                                <Grid size={12}>
                                    <Typography color="text.secondary">
                                        No control objectives selected yet — enable some in the
                                        Control objectives section above.
                                    </Typography>
                                </Grid>
                            ) : (
                                offered.map((c) => {
                                    const selected = editor.mapped.includes(c.id);
                                    return (
                                        <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                            <AppCard
                                                active={selected}
                                                onClick={() => toggleMap(c.id)}
                                                header={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Chip label={c.id} size="small" color="primary" variant={selected ? 'filled' : 'outlined'} />
                                                    <Typography variant="subtitle2" fontWeight={600}>
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
                                            </AppCard>
                                        </Grid>
                                    );
                                })
                            )}
                        </Grid>
                    </Box>
                </Stack>
            </AppDialog>
        </Box>
    );
}
