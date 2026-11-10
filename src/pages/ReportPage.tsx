import { useCallback, useEffect, useState } from 'react';
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
    PastReport,
    REPORT_SECTIONS,
    cleanSections,
    downloadReportDocument,
    generateReport,
    getReportSettings,
    listReports,
    openReportDocument,
} from '../lib/report';
import { SandboxRun, listAllRuns } from '../lib/sandbox';
import toast from 'react-hot-toast';

/** Report (WP8 W10): pick evaluations + sections + format in a dialog, generate,
 *  and browse past reports as cards. */
export default function ReportPage() {
    const { projectUUID: pid } = useProject();
    const [runs, setRuns] = useState<SandboxRun[]>([]);
    const [reports, setReports] = useState<PastReport[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [format, setFormat] = useState('pdf');
    const [period, setPeriod] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
                if (settings.default_format === 'html' || settings.default_format === 'pdf') {
                    setFormat(settings.default_format);
                }
                setSections(cleanSections(settings.default_sections));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load reports');
        }
    }, [pid]);

    useEffect(() => {
        setReports(null);
        void refresh();
    }, [refresh]);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open reports.</Typography>;
    }

    const toggle = (list: string[], id: string, set: (next: string[]) => void) => {
        set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
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
                    {reports.map((report) => (
                        <Grid key={report.pid} size={{ xs: 12, sm: 6, md: 4 }}>
                            <AppCard
                                active
                                onClick={() => {
                                    void openReportDocument(pid, report.pid).catch(() => {
                                        toast.error('Could not open report.', {
                                            position: 'bottom-right',
                                        });
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
                                    </Box>
                                }
                                footer={
                                    <>
                                        <Chip
                                            label={report.format.toUpperCase()}
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={report.created_at}
                                            size="small"
                                            variant="outlined"
                                        />
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
                maxWidth="sm"
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
                            sx={{ minWidth: 120 }}
                            onChange={(e) => setFormat(e.target.value)}
                        >
                            <MenuItem value="pdf">PDF</MenuItem>
                            <MenuItem value="html">HTML</MenuItem>
                        </TextField>
                    </Box>
                </Stack>
            </AppDialog>
        </Box>
    );
}
