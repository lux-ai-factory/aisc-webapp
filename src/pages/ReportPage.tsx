import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';
import AppDialog from '../components/AppDialog';
import AppCard from '../components/AppCard';
import ReportSettings, { ReportSettingsDraft } from '../components/ReportSettings';
import {
    BlockType,
    BlockTypeGroup,
    LayoutPreview,
    PastReport,
    ReportBlock,
    ReportLayout,
    cleanSections,
    createReportLayout,
    deleteReport,
    deleteReportLayout,
    downloadReportDocument,
    duplicateReportLayout,
    generateReport,
    getReportBlockTypes,
    getReportSettings,
    listReportLayouts,
    listReports,
    listSystemVersions,
    openReportDocument,
    previewReportLayout,
    setReportSettings,
    updateReportLayout,
} from '../lib/report';
import type { SystemVersion } from '../lib/qualification';
import { SandboxRun, listAllRuns } from '../lib/sandbox';
import toast from 'react-hot-toast';

/** Report (WP8 W10): pick evaluations, format, sections, layout, AI-card version
 *  and cover customisation in the generate dialog, then browse past reports as
 *  cards. The composer (REP-02) also lists the five built-in layouts and the
 *  project's own, edits their ordered blocks and previews them as HTML. The
 *  backend owns the data; the report service draws the snapshot it assembles. */

interface DraftLayout {
    id?: string;
    name: string;
    description: string;
    blocks: ReportBlock[];
    show_index: boolean;
    numbering: boolean;
}

const newInstanceId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** What a run executed, in place of its UUID: plugin names + status + date. */
function runLabel(run: SandboxRun) {
    const plugins = (run.evaluation_plugins ?? [])
        .map((plugin) => plugin.display_name || plugin.name)
        .filter((name): name is string => Boolean(name));
    return (
        <Box>
            <Typography variant="body2">
                {plugins.length > 0 ? plugins.join(', ') : run.task || 'Evaluation'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {run.status}
                {run.created_at ? ` · ${run.created_at.replace('T', ' ').slice(0, 16)}` : ''}
            </Typography>
        </Box>
    );
}

export default function ReportPage() {
    const { projectUUID: pid } = useProject();
    const [runs, setRuns] = useState<SandboxRun[]>([]);
    const [reports, setReports] = useState<PastReport[] | null>(null);
    const [settings, setSettings] = useState<ReportSettingsDraft | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [period, setPeriod] = useState('');
    const [generating, setGenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<PastReport | null>(null);
    const loadId = useRef(0);

    // the composer (REP-02): layouts, the palette, versions and the draft being edited
    const [layouts, setLayouts] = useState<ReportLayout[]>([]);
    const [groups, setGroups] = useState<BlockTypeGroup[]>([]);
    const [versions, setVersions] = useState<SystemVersion[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [versionPid, setVersionPid] = useState('');
    const [draft, setDraft] = useState<DraftLayout | null>(null);
    const [preview, setPreview] = useState<LayoutPreview | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        const id = ++loadId.current;
        if (!pid) return;
        try {
            const [allRuns, allReports, reportSettings] = await Promise.all([
                listAllRuns(pid),
                listReports(pid),
                getReportSettings(pid),
            ]);
            // a response for a project the user already left must not land here
            if (id !== loadId.current) return;
            setRuns(allRuns);
            setReports(allReports);
            const fmt = reportSettings?.default_format;
            setSettings({
                default_format: fmt === 'docx' || fmt === 'html' ? fmt : 'pdf',
                default_sections: cleanSections(reportSettings?.default_sections ?? []),
                report_title: reportSettings?.report_title ?? '',
                subtitle: reportSettings?.subtitle ?? '',
                primary_color: reportSettings?.primary_color ?? '#000fdf',
                accent_color: reportSettings?.accent_color ?? '#ff007e',
                font: reportSettings?.font ?? 'inter',
                font_size_pt: reportSettings?.font_size_pt ?? 11,
                header_text: reportSettings?.header_text ?? '',
                footer_text: reportSettings?.footer_text ?? '',
                marking: reportSettings?.marking ?? 'none',
                show_document_id: reportSettings?.show_document_id ?? false,
                logo: reportSettings?.logo ?? null,
            });
        } catch (e) {
            if (id !== loadId.current) return;
            setError(e instanceof Error ? e.message : 'failed to load reports');
        }
        // the composer's own data is best-effort: a project without layouts or
        // versions still generates the built-in default.
        listReportLayouts(pid)
            .then((ls) => setLayouts(Array.isArray(ls) ? ls : []))
            .catch(() => {});
        getReportBlockTypes(pid)
            .then((b) => setGroups(Array.isArray(b?.groups) ? b.groups : []))
            .catch(() => {});
        listSystemVersions(pid)
            .then((v) => {
                if (!Array.isArray(v)) return;
                setVersions(v);
                if (v[0]) setVersionPid((current) => current || v[0]!.pid);
            })
            .catch(() => {});
    }, [pid]);

    useEffect(() => {
        // everything below is project-scoped: never carry one project's fields into another
        setRuns([]);
        setReports(null);
        setPicked([]);
        setSettings(null);
        setPeriod('');
        setError(null);
        setMessage(null);
        setLayouts([]);
        setSelectedId('');
        setDraft(null);
        setPreview(null);
        setVersionPid('');
        void refresh();
    }, [refresh]);

    // a generated report is created 'pending' and finalized in the background:
    // keep refreshing while any card is still generating
    const hasPending = (reports ?? []).some((r) => r.status === 'pending');
    useEffect(() => {
        if (!hasPending) return;
        const timer = setInterval(() => {
            void refresh();
        }, 2000);
        return () => clearInterval(timer);
    }, [hasPending, refresh]);

    useEffect(() => {
        if (!selectedId && layouts.length > 0) {
            setSelectedId(layouts[0]!.id);
        }
    }, [layouts, selectedId]);

    const blockTypes = useMemo(() => {
        const map = new Map<string, BlockType>();
        groups.forEach((g) => g.types.forEach((t) => map.set(t.type_id, t)));
        return map;
    }, [groups]);

    const selected = useMemo(
        () => layouts.find((l) => l.id === selectedId) ?? null,
        [layouts, selectedId],
    );

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open reports.</Typography>;
    }

    const toggle = (id: string) => {
        setPicked((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    // a report only documents evaluations that actually ran (Done); pending or
    // failed runs have no measurements to report
    const doneRuns = runs.filter((run) => run.status === 'Done');

    const generate = async () => {
        if (!settings) return;
        setGenerating(true);
        setError(null);
        try {
            // the form's current values become the defaults the next report starts from
            const saved = await setReportSettings(pid, settings);
            await generateReport(pid, {
                period,
                format: saved.default_format,
                evaluation_pids: picked,
                sections: cleanSections(saved.default_sections),
                layout_id: selectedId || undefined,
                version_pid: versionPid || undefined,
            });
            await refresh();
            setGenerateOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const remove = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            await deleteReport(pid, pendingDelete.pid);
            setPendingDelete(null);
            toast.success('Report deleted.', { position: 'bottom-right' });
            await refresh();
        } catch {
            toast.error('Could not delete report.', { position: 'bottom-right' });
        } finally {
            setDeleting(false);
        }
    };

    // --- the composer (REP-02) -------------------------------------------------

    const editLayout = (layout: ReportLayout) => {
        setSelectedId(layout.id);
        setPreview(null);
        setDraft({
            id: layout.id,
            name: layout.name,
            description: layout.description,
            blocks: layout.blocks.map((b) => ({ ...b, options: { ...b.options } })),
            show_index: layout.show_index,
            numbering: layout.numbering,
        });
    };

    const startNewLayout = () => {
        const cover = blockTypes.get('cover');
        setSelectedId('');
        setPreview(null);
        setDraft({
            name: 'New layout',
            description: '',
            blocks: cover
                ? [{ instance_id: newInstanceId(), block_type: 'cover', options: { ...cover.default_options } }]
                : [],
            show_index: true,
            numbering: true,
        });
    };

    const saveDraft = async () => {
        if (!draft) return;
        setBusy(true);
        setMessage(null);
        try {
            const body = {
                name: draft.name,
                description: draft.description,
                blocks: draft.blocks,
                show_index: draft.show_index,
                numbering: draft.numbering,
            };
            const saved = draft.id
                ? await updateReportLayout(pid, draft.id, body)
                : await createReportLayout(pid, body);
            setMessage('Layout saved.');
            setDraft(null);
            setSelectedId(saved.id);
            await refresh();
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'could not save the layout');
        } finally {
            setBusy(false);
        }
    };

    const removeLayout = async (layout: ReportLayout) => {
        try {
            await deleteReportLayout(pid, layout.id);
            if (selectedId === layout.id) setSelectedId('');
            await refresh();
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'could not delete the layout');
        }
    };

    const duplicate = async (layout: ReportLayout) => {
        try {
            const copy = await duplicateReportLayout(pid, layout.id);
            setMessage(`Duplicated as “${copy.name}”.`);
            await refresh();
            editLayout(copy);
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'could not duplicate the layout');
        }
    };

    const showPreview = async () => {
        setBusy(true);
        setPreview(null);
        try {
            const result = await previewReportLayout(pid, selectedId || 'draft', {
                version_pid: versionPid || undefined,
                period,
                blocks: draft ? draft.blocks : undefined,
            });
            setPreview(result);
        } catch (e) {
            setMessage(e instanceof Error ? e.message : 'preview failed');
        } finally {
            setBusy(false);
        }
    };

    const addBlock = (typeId: string) => {
        if (!draft) return;
        const type = blockTypes.get(typeId);
        setDraft({
            ...draft,
            blocks: [
                ...draft.blocks,
                { instance_id: newInstanceId(), block_type: typeId, options: { ...(type?.default_options ?? {}) } },
            ],
        });
    };

    const moveBlock = (index: number, delta: number) => {
        if (!draft) return;
        const next = [...draft.blocks];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        setDraft({ ...draft, blocks: next });
    };

    const removeBlock = (index: number) => {
        if (!draft) return;
        setDraft({ ...draft, blocks: draft.blocks.filter((_, i) => i !== index) });
    };

    const setBlockOption = (index: number, key: string, value: unknown) => {
        if (!draft) return;
        const blocks = draft.blocks.map((b, i) =>
            i === index ? { ...b, options: { ...b.options, [key]: value } } : b,
        );
        setDraft({ ...draft, blocks });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Report
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        startIcon={<Icon>add</Icon>}
                        onClick={startNewLayout}
                        sx={{ textTransform: 'none' }}
                    >
                        New layout
                    </Button>
                    <Button
                        variant="contained"
                        className="gradient-btn"
                        startIcon={<Icon>report</Icon>}
                        disabled={generating}
                        onClick={() => setGenerateOpen(true)}
                        sx={{ textTransform: 'none' }}
                    >
                        Generate
                    </Button>
                </Stack>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {message && <Typography color="text.secondary">{message}</Typography>}

            {reports === null && <CircularProgress size={24} />}
            {reports !== null && reports.length === 0 && (
                <Typography color="text.secondary">No reports generated yet.</Typography>
            )}
            {reports !== null && reports.length > 0 && (
                <Grid container spacing={2} className="plugins-grid">
                    {reports.map((report) => {
                        const pending = report.status === 'pending';
                        const failed = report.status === 'failed';
                        const openable = !pending && !failed;
                        return (
                            <Grid key={report.pid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                                <AppCard
                                    active
                                    onClick={
                                        openable
                                            ? () => {
                                                void openReportDocument(pid, report.pid).catch(() => {
                                                    toast.error('Could not open report.', {
                                                        position: 'bottom-right',
                                                    });
                                                });
                                            }
                                            : undefined
                                    }
                                    header={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                                                {report.period || 'Report'}
                                            </Typography>
                                            {pending && <CircularProgress size={18} />}
                                            {!pending && (
                                                <Tooltip title="Download">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        aria-label={`Download ${report.period || 'report'}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void downloadReportDocument(
                                                                pid,
                                                                report.pid,
                                                                report.format,
                                                            ).catch(() => {
                                                                toast.error('Could not download report.', {
                                                                    position: 'bottom-right',
                                                                });
                                                            });
                                                        }}
                                                    >
                                                        <Icon fontSize="small">file_download</Icon>
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`Delete ${report.period || 'report'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPendingDelete(report);
                                                    }}
                                                >
                                                    <Icon fontSize="small">delete</Icon>
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                    footer={
                                        <>
                                            {typeof report.version === 'number' && (
                                                <Chip
                                                    label={`v${report.version}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="filled"
                                                />
                                            )}
                                            <Chip
                                                label={report.format.toUpperCase()}
                                                size="small"
                                                color="info"
                                                variant="filled"
                                            />
                                            {pending && (
                                                <Chip
                                                    size="small"
                                                    color="warning"
                                                    label="Generating…"
                                                />
                                            )}
                                            {failed && (
                                                <Chip
                                                    size="small"
                                                    color="error"
                                                    label="Failed"
                                                />
                                            )}
                                            <Chip
                                                label={(report.created_at ?? '').replace('T', ' ').slice(0, 16)}
                                                size="small"
                                                variant="filled"
                                                title={report.created_at}
                                            />
                                        </>
                                    }
                                >
                                    {report.evaluations && report.evaluations.length > 0 && (
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            {report.evaluations.slice(0, 4).map((ev) => (
                                                <Chip
                                                    key={ev.pid}
                                                    size="small"
                                                    variant="filled"
                                                    color="info"
                                                    label={`#${ev.pid.slice(0, 8)}`}
                                                    title={`${ev.pid}${ev.status ? ` · ${ev.status}` : ''}`}
                                                />
                                            ))}
                                            {report.evaluations.length > 4 && (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    color="info"
                                                    label={`+${report.evaluations.length - 4}`}
                                                />
                                            )}
                                        </Stack>
                                    )}
                                </AppCard>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            <Box className="brand-block">
                <Typography className="brand-block-title">Layouts</Typography>
                <Box className="brand-steps">
                    {layouts.map((layout) => (
                        <Box
                            key={layout.id}
                            className="brand-step"
                            data-testid={`layout-${layout.id}`}
                            onClick={() => {
                                setSelectedId(layout.id);
                                setDraft(null);
                                setPreview(null);
                            }}
                            sx={{ cursor: 'pointer', outline: layout.id === selectedId ? '2px solid var(--primary)' : 'none' }}
                        >
                            <Typography className="brand-step-title">{layout.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {layout.description}
                            </Typography>
                            <Typography className="brand-mono">
                                {layout.built_in ? 'Built-in' : `Revision ${layout.revision}`} · {layout.blocks.length} blocks
                            </Typography>
                            <Stack direction="row" spacing={1} className="brand-step-open">
                                <Button
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void duplicate(layout);
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Duplicate
                                </Button>
                                {!layout.built_in && (
                                    <>
                                        <Button
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editLayout(layout);
                                            }}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void removeLayout(layout);
                                            }}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                )}
                            </Stack>
                        </Box>
                    ))}
                    {layouts.length === 0 && (
                        <Typography color="text.secondary">Loading layouts…</Typography>
                    )}
                </Box>
            </Box>

            {draft ? (
                <Box className="brand-block">
                    <Typography className="brand-block-title">
                        {draft.id ? `Edit “${draft.name}”` : 'New layout'}
                    </Typography>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <TextField
                                label="Name"
                                size="small"
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={draft.show_index}
                                        onChange={(e) => setDraft({ ...draft, show_index: e.target.checked })}
                                    />
                                }
                                label="Index"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={draft.numbering}
                                        onChange={(e) => setDraft({ ...draft, numbering: e.target.checked })}
                                    />
                                }
                                label="Numbering"
                            />
                        </Stack>

                        <Box data-testid="block-outline">
                            {draft.blocks.map((block, index) => {
                                const type = blockTypes.get(block.block_type);
                                return (
                                    <Box
                                        key={block.instance_id}
                                        className="brand-block"
                                        data-testid={`block-${index}`}
                                        sx={{ border: '1px solid var(--border)', background: 'var(--panel)', p: 1.5 }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography className="brand-mono" sx={{ minWidth: 28 }}>
                                                {index + 1}
                                            </Typography>
                                            <Typography sx={{ flexGrow: 1 }} fontWeight={600}>
                                                {type?.label ?? block.block_type}
                                            </Typography>
                                            <IconButton size="small" aria-label="Move up" onClick={() => moveBlock(index, -1)}>
                                                <Icon fontSize="small">arrow_upward</Icon>
                                            </IconButton>
                                            <IconButton size="small" aria-label="Move down" onClick={() => moveBlock(index, 1)}>
                                                <Icon fontSize="small">arrow_downward</Icon>
                                            </IconButton>
                                            <IconButton size="small" aria-label="Remove" onClick={() => removeBlock(index)}>
                                                <Icon fontSize="small">delete</Icon>
                                            </IconButton>
                                        </Stack>
                                        {type && (
                                            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                                                {Object.entries(type.options_schema.properties).map(([key, spec]) => {
                                                    const value = block.options[key] ?? spec.default;
                                                    const label = spec.label ?? key;
                                                    if (spec.type === 'boolean') {
                                                        return (
                                                            <FormControlLabel
                                                                key={key}
                                                                control={
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={Boolean(value)}
                                                                        onChange={(e) => setBlockOption(index, key, e.target.checked)}
                                                                    />
                                                                }
                                                                label={label}
                                                            />
                                                        );
                                                    }
                                                    if (spec.enum) {
                                                        return (
                                                            <TextField
                                                                key={key}
                                                                select
                                                                size="small"
                                                                label={label}
                                                                value={String(value ?? '')}
                                                                onChange={(e) => setBlockOption(index, key, e.target.value)}
                                                                sx={{ minWidth: 160 }}
                                                            >
                                                                {spec.enum.map((option) => (
                                                                    <MenuItem key={option} value={option}>
                                                                        {option}
                                                                    </MenuItem>
                                                                ))}
                                                            </TextField>
                                                        );
                                                    }
                                                    return (
                                                        <TextField
                                                            key={key}
                                                            size="small"
                                                            label={label}
                                                            multiline={key === 'text'}
                                                            value={String(value ?? '')}
                                                            onChange={(e) => setBlockOption(index, key, e.target.value)}
                                                        />
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField
                                select
                                size="small"
                                label="Add block"
                                value=""
                                onChange={(e) => addBlock(e.target.value)}
                                sx={{ minWidth: 240 }}
                            >
                                {groups.map((group) => [
                                    <MenuItem key={group.group} disabled value={`__${group.group}`}>
                                        {group.group}
                                    </MenuItem>,
                                    ...group.types.map((t) => (
                                        <MenuItem key={t.type_id} value={t.type_id}>
                                            {t.label}
                                        </MenuItem>
                                    )),
                                ])}
                            </TextField>
                            <Button variant="outlined" disabled={busy} onClick={() => void saveDraft()} sx={{ textTransform: 'none' }}>
                                Save layout
                            </Button>
                            <Button onClick={() => setDraft(null)} sx={{ textTransform: 'none' }}>
                                Cancel
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            ) : (
                selected && (
                    <Box className="brand-block">
                        <Typography className="brand-block-title">{selected.name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Button variant="outlined" disabled={busy} onClick={() => void showPreview()} sx={{ textTransform: 'none' }}>
                                Preview
                            </Button>
                            <Button variant="outlined" onClick={() => editLayout(selected)} sx={{ textTransform: 'none' }}>
                                Duplicate &amp; edit
                            </Button>
                        </Stack>
                        <Box data-testid="block-outline">
                            {selected.blocks.map((block, index) => (
                                <Typography key={block.instance_id} className="brand-mono" sx={{ display: 'block' }}>
                                    {index + 1}. {blockTypes.get(block.block_type)?.label ?? block.block_type}
                                </Typography>
                            ))}
                        </Box>
                    </Box>
                )
            )}

            {preview && (
                <Box className="brand-block">
                    <Typography className="brand-block-title">Preview</Typography>
                    <Box
                        component="iframe"
                        title="Report preview"
                        data-testid="report-preview"
                        srcDoc={preview.html}
                        sx={{ width: '100%', height: 480, border: '1px solid var(--border)', background: '#fff' }}
                    />
                </Box>
            )}

            <AppDialog
                open={generateOpen}
                onClose={() => setGenerateOpen(false)}
                maxWidth="md"
                fullWidth
                title="Generate report"
                actions={
                    <>
                        <Button
                            onClick={() => setGenerateOpen(false)}
                            variant="outlined"
                            disabled={generating}
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={generating || settings === null}
                            onClick={() => void generate()}
                            sx={{ textTransform: 'none' }}
                        >
                            {generating ? 'Generating...' : 'Generate'}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2.5}>
                    <Box component="section" sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Icon sx={{ color: 'primary.main', fontSize: 20 }}>dashboard_customize</Icon>
                            <Typography variant="subtitle1" fontWeight={600}>Layout &amp; version</Typography>
                        </Stack>
                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <TextField
                                select
                                size="small"
                                label="Layout"
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value)}
                                sx={{ minWidth: 240 }}
                            >
                                {layouts.map((layout) => (
                                    <MenuItem key={layout.id} value={layout.id}>
                                        {layout.name}
                                        {layout.built_in ? ' (built-in)' : ''}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                size="small"
                                label="AI card version"
                                value={versionPid}
                                onChange={(e) => setVersionPid(e.target.value)}
                                sx={{ minWidth: 240 }}
                            >
                                {versions.map((v) => (
                                    <MenuItem key={v.pid} value={v.pid}>
                                        Version {v.number}
                                        {v.name ? ` · ${v.name}` : ''}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Box>

                    <Box component="section" sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Icon sx={{ color: 'primary.main', fontSize: 20 }}>science</Icon>
                            <Typography variant="subtitle1" fontWeight={600}>Evaluations</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            None selected means the whole project.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto', pr: 1 }}>
                            {doneRuns.map((run) => (
                                <FormControlLabel
                                    key={run.pid}
                                    sx={{ alignItems: 'flex-start' }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={picked.includes(run.pid)}
                                            onChange={() => toggle(run.pid)}
                                        />
                                    }
                                    label={runLabel(run)}
                                />
                            ))}
                            {doneRuns.length === 0 && (
                                <Typography color="text.secondary" variant="body2">
                                    No completed evaluations yet.
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    <Box component="section" sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Icon sx={{ color: 'primary.main', fontSize: 20 }}>palette</Icon>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Report look, format &amp; sections
                            </Typography>
                        </Stack>
                        {settings === null ? (
                            <CircularProgress size={24} />
                        ) : (
                            <ReportSettings value={settings} onChange={setSettings} />
                        )}
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <TextField
                            label="Period"
                            size="small"
                            value={period}
                            placeholder="2026-Q3"
                            onChange={(e) => setPeriod(e.target.value)}
                            sx={{ alignSelf: 'flex-start', minWidth: 220 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            The settings are saved when you generate, so the next report starts from them.
                        </Typography>
                    </Stack>
                </Stack>
            </AppDialog>

            <AppDialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                maxWidth="xs"
                fullWidth
                title="Delete report"
                actions={
                    <>
                        <Button
                            onClick={() => setPendingDelete(null)}
                            variant="outlined"
                            disabled={deleting}
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={deleting}
                            onClick={() => void remove()}
                            sx={{ textTransform: 'none' }}
                        >
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </>
                }
            >
                <Typography>
                    Delete “{pendingDelete?.period || 'Report'}”? This cannot be undone.
                </Typography>
            </AppDialog>
        </Box>
    );
}
