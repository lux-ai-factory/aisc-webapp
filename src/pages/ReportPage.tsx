import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
    BlockType,
    BlockTypeGroup,
    LayoutPreview,
    PastReport,
    REPORT_FORMATS,
    REPORT_SECTIONS,
    ReportBlock,
    ReportLayout,
    cleanSections,
    createReportLayout,
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
    updateReportLayout,
} from '../lib/report';
import type { SystemVersion } from '../lib/qualification';
import { SandboxRun, listAllRuns } from '../lib/sandbox';
import toast from 'react-hot-toast';

/** Report composer (REP-02): pick a layout (the five built-ins or a project
 *  one), edit its ordered blocks, preview it as HTML, generate a real PDF or
 *  Word document for a version, and browse past reports. The pilot look is the
 *  brand classes (`.brand-block`, `.brand-step`, `.brand-mono`). */

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

export default function ReportPage() {
    const { projectUUID: pid } = useProject();
    const [runs, setRuns] = useState<SandboxRun[]>([]);
    const [reports, setReports] = useState<PastReport[] | null>(null);
    const [layouts, setLayouts] = useState<ReportLayout[]>([]);
    const [groups, setGroups] = useState<BlockTypeGroup[]>([]);
    const [versions, setVersions] = useState<SystemVersion[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [draft, setDraft] = useState<DraftLayout | null>(null);
    const [preview, setPreview] = useState<LayoutPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // generate dialog
    const [picked, setPicked] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [format, setFormat] = useState('pdf');
    const [period, setPeriod] = useState('');
    const [versionPid, setVersionPid] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);

    const refresh = useCallback(async () => {
        if (!pid) return;
        try {
            const [allRuns, allReports, settings] = await Promise.all([
                listAllRuns(pid),
                listReports(pid),
                getReportSettings(pid),
            ]);
            setRuns(allRuns);
            setReports(allReports);
            if (settings) {
                if (REPORT_FORMATS.includes(settings.default_format as 'pdf' | 'docx')) {
                    setFormat(settings.default_format);
                }
                setSections(cleanSections(settings.default_sections));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load reports');
        }
        // The composer's own data is best-effort: a project without layouts or
        // versions still generates the built-in default.
        listReportLayouts(pid).then(setLayouts).catch(() => {});
        getReportBlockTypes(pid)
            .then((b) => setGroups(b.groups))
            .catch(() => {});
        listSystemVersions(pid)
            .then((v) => {
                setVersions(v);
                if (v[0]) setVersionPid(v[0].pid);
            })
            .catch(() => {});
    }, [pid]);

    useEffect(() => {
        setReports(null);
        void refresh();
    }, [refresh]);

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

    const toggle = (list: string[], id: string, set: (next: string[]) => void) => {
        set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    };

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

    const generate = async () => {
        setGenerating(true);
        setError(null);
        try {
            await generateReport(pid, {
                period,
                format,
                evaluation_pids: picked,
                sections: cleanSections(sections),
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

            {reports === null && <CircularProgress size={24} />}
            {reports !== null && reports.length === 0 && (
                <Typography color="text.secondary">No reports generated yet.</Typography>
            )}
            {reports !== null && reports.length > 0 && (
                <Grid container spacing={2} className="plugins-grid">
                    {reports.map((report) => (
                        <Grid key={report.pid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                            <AppCard
                                active
                                onClick={() => {
                                    void openReportDocument(pid, report.pid).catch(() => {
                                        toast.error('Could not open report.', { position: 'bottom-right' });
                                    });
                                }}
                                header={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                                            {report.period || 'Report'}
                                        </Typography>
                                        <Tooltip title="Download">
                                            <IconButton
                                                size="small"
                                                aria-label={`Download ${report.period || 'report'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void downloadReportDocument(pid, report.pid, report.format).catch(() => {
                                                        toast.error('Could not download report.', { position: 'bottom-right' });
                                                    });
                                                }}
                                            >
                                                <Icon fontSize="small">file_download</Icon>
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                }
                                footer={
                                    <>
                                        <Chip label={report.format.toUpperCase()} size="small" color="info" variant="outlined" />
                                        <Chip label={report.created_at} size="small" variant="outlined" />
                                    </>
                                }
                            />
                        </Grid>
                    ))}
                </Grid>
            )}

            <AppDialog
                open={generateOpen}
                onClose={() => setGenerateOpen(false)}
                maxWidth="md"
                fullWidth
                title="Generate report"
                actions={
                    <>
                        <Button onClick={() => setGenerateOpen(false)} variant="outlined" disabled={generating} sx={{ textTransform: 'none' }}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={generating}
                            onClick={() => void generate()}
                            sx={{ textTransform: 'none' }}
                        >
                            {generating ? 'Generating...' : 'Generate'}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="subtitle1">Layout</Typography>
                        <TextField
                            select
                            size="small"
                            fullWidth
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            {layouts.map((layout) => (
                                <MenuItem key={layout.id} value={layout.id}>
                                    {layout.name}
                                    {layout.built_in ? ' (built-in)' : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    <Box>
                        <Typography variant="subtitle1">AI card version</Typography>
                        <TextField
                            select
                            size="small"
                            fullWidth
                            value={versionPid}
                            onChange={(e) => setVersionPid(e.target.value)}
                        >
                            {versions.map((v) => (
                                <MenuItem key={v.pid} value={v.pid}>
                                    Version {v.number}
                                    {v.name ? ` · ${v.name}` : ''}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    <Box>
                        <Typography variant="subtitle1">Evaluations</Typography>
                        <Typography variant="caption" color="text.secondary">
                            None selected means the whole project.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
                            {runs.map((run) => (
                                <FormControlLabel
                                    key={run.pid}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={picked.includes(run.pid)}
                                            onChange={() => toggle(picked, run.pid, setPicked)}
                                        />
                                    }
                                    label={`${run.pid.slice(0, 8)} · ${run.status}`}
                                />
                            ))}
                            {runs.length === 0 && (
                                <Typography color="text.secondary" variant="body2">
                                    No evaluations yet.
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    <Box>
                        <Typography variant="subtitle1">Sections</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {REPORT_SECTIONS.map((section) => (
                                <FormControlLabel
                                    key={section}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={sections.includes(section)}
                                            onChange={() => toggle(sections, section, setSections)}
                                        />
                                    }
                                    label={section}
                                />
                            ))}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            label="Period"
                            size="small"
                            value={period}
                            placeholder="2026-Q3"
                            onChange={(e) => setPeriod(e.target.value)}
                        />
                        <TextField
                            select
                            label="Format"
                            size="small"
                            value={format}
                            sx={{ minWidth: 140 }}
                            onChange={(e) => setFormat(e.target.value)}
                        >
                            <MenuItem value="pdf">PDF</MenuItem>
                            <MenuItem value="docx">Word</MenuItem>
                        </TextField>
                    </Box>
                </Stack>
            </AppDialog>
        </Box>
    );
}
