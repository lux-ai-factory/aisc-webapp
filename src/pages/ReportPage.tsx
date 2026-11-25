import { startReportGeneration, useReportGeneration } from '../lib/reportGeneration';
import { fetchDashboard } from '../lib/dashboardStorage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import SearchIcon from '@mui/icons-material/Search';
import { useProject } from '../context/ProjectContext';
import AppDialog from '../components/AppDialog';
import AppCard from '../components/AppCard';
import ReportSettings, { ReportSettingsDraft } from '../components/ReportSettings';
import DashboardWidgetPicker, {
    type DashboardWidgetPickerHandle,
} from '../components/dashboard/DashboardWidgetPicker';
import {
    PastReport,
    cleanSections,
    deleteReport,
    downloadReportDocument,
    getReportSettings,
    listReports,
    openReportDocument,
} from '../lib/report';
import { SandboxRun, evalTitle, listAllRuns } from '../lib/sandbox';
import { type GridWidget } from '../lib/dashboardCharts';
import toast from 'react-hot-toast';

/** Report (WP8 W10): pick evaluations, format, sections and cover customisation in the
 *  generate dialog, then browse past reports as cards. The chosen settings are saved on
 *  generate, so the next report starts from them. The backend owns the data; the report
 *  service draws the snapshot it assembles. */
export default function ReportPage() {
    const { projectUUID: pid } = useProject();
    const [runs, setRuns] = useState<SandboxRun[]>([]);
    const [reports, setReports] = useState<PastReport[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    // evaluations picker — search + plugin-tag filter, like the catalogue dialog
    const [evalQuery, setEvalQuery] = useState('');
    const [evalTags, setEvalTags] = useState<string[]>([]);
    const [evalTagOpen, setEvalTagOpen] = useState(false);
    const [settings, setSettings] = useState<ReportSettingsDraft | null>(null);
    const [period, setPeriod] = useState('');
    const job = useReportGeneration(pid);
    const generating = job?.running ?? false;
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<PastReport | null>(null);
    // the dashboard's current widgets, and which of them the report collects
    const [widgets, setWidgets] = useState<GridWidget[]>([]);
    const [pickedWidgetKeys, setPickedWidgetKeys] = useState<Set<string>>(new Set());
    const pickerRef = useRef<DashboardWidgetPickerHandle>(null);
    const loadId = useRef(0);
    const activeProject = useRef(pid);
    activeProject.current = pid;
    const operationId = useRef(0);
    useEffect(() => () => { ++operationId.current; }, [pid]);

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
            setSettings({
                default_format:
                    reportSettings?.default_format === 'html' ? 'html' : 'pdf',
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
    }, [pid]);

    useEffect(() => {
        // everything below is project-scoped: never carry one project's fields into another
        setGenerateOpen(false);
        setPendingDelete(null);
        setRuns([]);
        setReports(null);
        setPicked([]);
        setSettings(null);
        setPeriod('');
        setEvalQuery('');
        setEvalTags([]);
        setEvalTagOpen(false);
        setWidgets([]);
        setPickedWidgetKeys(new Set());
        setError(null);
        void refresh();
    }, [refresh]);

    useEffect(() => { if (job) void refresh(); }, [job, refresh]);

    // a generated report is created 'pending' and finalized in the background:
    // keep refreshing while any card is still generating
    const hasPending = (reports ?? []).some((r) => ['preparing', 'pending'].includes(r.status));
    useEffect(() => {
        if (!hasPending) return;
        const timer = setInterval(() => {
            void refresh();
        }, 2000);
        return () => clearInterval(timer);
    }, [hasPending, refresh]);

    // a report only documents evaluations that actually ran (Done); pending or
    // failed runs have no measurements to report
    const doneRuns = runs.filter((run) => run.status === 'Done');

    // Plugin names across the done runs, as toggleable filter chips (the tag
    // filter of the catalogue dialog: pick a plugin to keep only its runs).
    const pluginTags = useMemo(() => {
        const set = new Set<string>();
        doneRuns.forEach((run) =>
            (run.evaluation_plugins ?? []).forEach((p) => {
                const label = p.display_name || p.name;
                if (label) set.add(label);
            }),
        );
        return Array.from(set).sort();
    }, [doneRuns]);

    const filteredRuns = useMemo(() => {
        const q = evalQuery.trim().toLowerCase();
        return doneRuns.filter((run) => {
            if (q && !evalTitle(run).toLowerCase().includes(q)) return false;
            if (evalTags.length === 0) return true;
            const plugins = (run.evaluation_plugins ?? []).map((p) => p.display_name || p.name);
            return evalTags.some((tag) => plugins.includes(tag));
        });
    }, [doneRuns, evalQuery, evalTags]);

    const toggleEvalTag = (tag: string) =>
        setEvalTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open reports.</Typography>;
    }

    const toggle = (id: string) => {
        setPicked((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    // load the dashboard's widgets (and pre-select them all) when the dialog
    // opens, so the report reflects the dashboard at generation time
    const openGenerate = async () => {
        const operation = ++operationId.current;
        const isCurrent = () => activeProject.current === pid && operationId.current === operation;
        let current: GridWidget[];
        try { current = (await fetchDashboard(pid)).widgets; }
        catch { if (isCurrent()) setError('Could not load dashboard'); return; }
        if (!isCurrent()) return;
        setWidgets(current);
        setPickedWidgetKeys(new Set(current.map((w) => w.key)));
        setGenerateOpen(true);
    };

    const toggleWidget = (key: string) => {
        setPickedWidgetKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // names of the current runs, so past-report chips can show them too
    const titleByPid = new Map(runs.map((r) => [r.pid, evalTitle(r)]));

    const generate = () => {
        if (!settings || generating) return;
        setError(null);
        const exporter = pickerRef.current;
        startReportGeneration(pid, { settings, period, evaluations: picked },
            () => exporter?.exportSelected() ?? Promise.resolve([]));
        setGenerateOpen(false);
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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Report
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon>report</Icon>}
                    disabled={generating}
                    onClick={openGenerate}
                    sx={{ textTransform: 'none' }}
                >
                    Generate
                </Button>
            </Box>
            {(error || job?.error) && <Typography color="error">{error || job?.error}</Typography>}

            {reports === null && <CircularProgress size={24} />}
            {reports !== null && reports.length === 0 && (
                <Typography color="text.secondary">No reports generated yet.</Typography>
            )}
            {reports !== null && reports.length > 0 && (
                <Grid container spacing={2} className="plugins-grid">
                    {reports.map((report) => {
                        const pending = ['preparing', 'pending'].includes(report.status);
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
                                                    disabled={report.status === 'preparing'}
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
                                                    label={titleByPid.get(ev.pid) ?? ev.pid.slice(0, 8)}
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

            <AppDialog
                open={generateOpen}
                onClose={() => setGenerateOpen(false)}
                maxWidth="lg"
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
                            <Icon sx={{ color: 'primary.main', fontSize: 20 }}>science</Icon>
                            <Typography variant="subtitle1" fontWeight={600}>Evaluations</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            None selected means the whole project.
                        </Typography>
                        <Stack spacing={1} sx={{ mb: 1.5 }}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Search evaluations…"
                                value={evalQuery}
                                onChange={(e) => setEvalQuery(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {pluginTags.slice(0, evalTagOpen ? pluginTags.length : 12).map((tag) => (
                                    <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        onClick={() => toggleEvalTag(tag)}
                                        color={evalTags.includes(tag) ? 'primary' : 'default'}
                                        variant={evalTags.includes(tag) ? 'filled' : 'outlined'}
                                    />
                                ))}
                                {pluginTags.length > 12 && (
                                    <Chip
                                        label={evalTagOpen ? 'less' : `+${pluginTags.length - 12} tags`}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setEvalTagOpen((o) => !o)}
                                    />
                                )}
                            </Box>
                        </Stack>
                        {doneRuns.length === 0 ? (
                            <Typography color="text.secondary" variant="body2">
                                No completed evaluations yet.
                            </Typography>
                        ) : filteredRuns.length === 0 ? (
                            <Typography color="text.secondary" variant="body2">
                                No matching evaluations.
                            </Typography>
                        ) : (
                            <Box sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
                                <Grid container spacing={1.5}>
                                    {filteredRuns.map((run) => {
                                        const pickedEval = picked.includes(run.pid);
                                        const plugins = run.evaluation_plugins ?? [];
                                        return (
                                            <Grid key={run.pid} size={{ xs: 12, sm: 6, md: 4 }}>
                                                <AppCard
                                                    theme="catalogue"
                                                    active={pickedEval}
                                                    onClick={() => toggle(run.pid)}
                                                    header={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                                            <Icon sx={{ color: 'primary.main', flexShrink: 0 }}>science</Icon>
                                                            <Tooltip title={run.pid} placement="top">
                                                                <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
                                                                    {evalTitle(run)}
                                                                </Typography>
                                                            </Tooltip>
                                                        </Box>
                                                    }
                                                    footer={
                                                        <>
                                                            <Chip
                                                                label={run.status}
                                                                size="small"
                                                                color={run.status === 'Done' ? 'success' : 'default'}
                                                                variant={run.status === 'Done' ? 'filled' : 'outlined'}
                                                            />
                                                            {run.created_at && (
                                                                <Chip
                                                                    label={run.created_at.replace('T', ' ').slice(0, 16)}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            )}
                                                            {plugins.slice(0, 2).map((p) => (
                                                                <Chip
                                                                    key={p.name ?? p.display_name}
                                                                    label={p.display_name || p.name}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            ))}
                                                            {plugins.length > 2 && (
                                                                <Chip label={`+${plugins.length - 2}`} size="small" variant="outlined" />
                                                            )}
                                                            {pickedEval && (
                                                                <Chip label="selected" size="small" color="success" />
                                                            )}
                                                        </>
                                                    }
                                                />
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Box>
                        )}
                    </Box>

                    <Box component="section" sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Icon sx={{ color: 'primary.main', fontSize: 20 }}>dashboard</Icon>
                            <Typography variant="subtitle1" fontWeight={600}>Dashboard widgets</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                            Select the dashboard charts and comments to collect (all pre-selected). They are exported as
                            they appear on the dashboard; a plugin without a dashboard chart still shows its default
                            plots in the report's Evaluations chapter.
                        </Typography>
                        <DashboardWidgetPicker
                            ref={pickerRef}
                            projectPid={pid}
                            widgets={widgets}
                            selected={pickedWidgetKeys}
                            onToggle={toggleWidget}
                        />
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
