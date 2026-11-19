import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
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
    PastReport,
    cleanSections,
    deleteReport,
    downloadReportDocument,
    generateReport,
    getReportSettings,
    listReports,
    openReportDocument,
    setReportSettings,
} from '../lib/report';
import { SandboxRun, listAllRuns } from '../lib/sandbox';
import toast from 'react-hot-toast';

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

/** Report (WP8 W10): pick evaluations, format, sections and cover customisation in the
 *  generate dialog, then browse past reports as cards. The chosen settings are saved on
 *  generate, so the next report starts from them. The backend owns the data; the report
 *  service draws the snapshot it assembles. */
export default function ReportPage() {
    const { projectUUID: pid } = useProject();
    const [runs, setRuns] = useState<SandboxRun[]>([]);
    const [reports, setReports] = useState<PastReport[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [settings, setSettings] = useState<ReportSettingsDraft | null>(null);
    const [period, setPeriod] = useState('');
    const [generating, setGenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<PastReport | null>(null);
    const loadId = useRef(0);

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
        setRuns([]);
        setReports(null);
        setPicked([]);
        setSettings(null);
        setPeriod('');
        setError(null);
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
                    onClick={() => setGenerateOpen(true)}
                    sx={{ textTransform: 'none' }}
                >
                    Generate
                </Button>
            </Box>
            {error && <Typography color="error">{error}</Typography>}

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
