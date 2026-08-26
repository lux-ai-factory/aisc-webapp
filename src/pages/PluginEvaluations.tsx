import {useCallback, useEffect, useRef, useState} from 'react';
import './PluginEvaluations.css';
import '../styles/common.css';
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";
import {
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    Divider,
    Icon,
    IconButton,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import DownloadIcon from '@mui/icons-material/Download';
import {Plugin} from "../models/models.tsx";
import EvaluationProgressList from "../components/EvaluationProgressList.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const SHOW_PLUGIN_VISUALIZATION =
    String(import.meta.env.VITE_SHOW_PLUGIN_VISUALIZATION).toLowerCase() === 'true';

const SENSITIVE_KEYS = new Set([
    'model_credential',
    'secrets',
    'apiKey',
    'password',
    'secret',
    'token',
    'extra_env',
]);

function redactConfig(config: unknown): string {
    if (!config || typeof config !== 'object') return '';
    const inner =
        'config' in (config as Record<string, unknown>)
            ? (config as Record<string, unknown>).config
            : config;
    if (!inner || typeof inner !== 'object') return JSON.stringify(config, null, 2);
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
        safe[k] = SENSITIVE_KEYS.has(k) ? '<redacted>' : v;
    }
    return JSON.stringify(safe, null, 2);
}

function formatDateParts(dateLike: unknown): {date: string; time: string} {
    if (typeof dateLike !== 'string' || !dateLike) {
        return {date: 'Unknown date', time: '--:--:--'};
    }
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
        return {date: 'Unknown date', time: '--:--:--'};
    }

    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
    };
}

function getEvaluationCreatedAt(evaluation: any): string | null {
    if (typeof evaluation?.created_at === 'string' && evaluation.created_at) {
        return evaluation.created_at;
    }

    const pluginDates = (evaluation?.evaluation_plugins ?? [])
        .map((plugin: any) => plugin?.created_at)
        .filter((value: unknown): value is string => typeof value === 'string' && Boolean(value));

    if (pluginDates.length > 0) {
        return [...pluginDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    }

    if (typeof evaluation?.finished_at === 'string' && evaluation.finished_at) {
        return evaluation.finished_at;
    }

    if (typeof evaluation?.started_at === 'string' && evaluation.started_at) {
        return evaluation.started_at;
    }

    return null;
}

function getEvaluationFinishedAt(evaluation: any): string | null {
    if (typeof evaluation?.finished_at === 'string' && evaluation.finished_at) {
        return evaluation.finished_at;
    }

    const pluginDates = (evaluation?.evaluation_plugins ?? [])
        .map((plugin: any) => plugin?.finished_at)
        .filter((value: unknown): value is string => typeof value === 'string' && Boolean(value));

    if (pluginDates.length > 0) {
        return [...pluginDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    }

    return null;
}

function getEvaluationCreatedAtMs(evaluation: any): number {
    const createdAt = getEvaluationCreatedAt(evaluation);
    if (!createdAt) return 0;
    const ts = new Date(createdAt).getTime();
    return Number.isNaN(ts) ? 0 : ts;
}

function sanitizeFilePart(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function formatTimestamp(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}${s}`;
}

const getDoneEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const REPORT_URL = (import.meta.env.VITE_REPORT_URL as string | undefined) ?? '/report';

function PluginEvaluations() {
    const {projectUUID, projectName} = useProject();
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const previousInProgressRef = useRef<string[]>([]);
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [isPending, setIsPending] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const fetchDoneEvaluations = useCallback(async (initial = false) => {
        if (!projectUUID) {
            setEvaluations([]);
            setIsPending(false);
            setError(null);
            return;
        }

        if (initial) setIsPending(true);

        try {
            const data = await getDoneEvaluations(projectUUID);
            setEvaluations(Array.isArray(data) ? data : []);
            setError(null);
        } catch (err) {
            setError(err);
        } finally {
            setIsPending(false);
        }
    }, [projectUUID]);

    const handleDownloadReport = () => {
        if (!projectName) return;
        window.location.href = `${REPORT_URL}/generate?project=${encodeURIComponent(projectName)}`;
    };

    const handleDownloadEvalReport = (evaluationPid: string) => {
        if (!projectName || !evaluationPid) return;
        window.location.href = `${REPORT_URL}/generate?project=${encodeURIComponent(projectName)}&evaluation_pid=${encodeURIComponent(evaluationPid)}`;
    };

    const handleDownloadPluginConfig = (_evaluationPid: string, plugin: Plugin) => {
        const payload = plugin.plugin_config ?? {};
        const content = JSON.stringify(payload, null, 2);
        const blob = new Blob([content], {type: 'application/json'});
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const pluginName = sanitizeFilePart(plugin.display_name || plugin.name || 'plugin') || 'plugin';
        const timestamp = formatTimestamp(new Date());
        anchor.href = url;
        anchor.download = `${pluginName}_${timestamp}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    };

    useEffect(() => {
        void fetchDoneEvaluations(true);
    }, [fetchDoneEvaluations]);

    useEffect(() => {
        const onFocus = () => {
            void fetchDoneEvaluations();
        };
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
        };
    }, [fetchDoneEvaluations]);

    const handleInProgressChanged = useCallback((activePids: string[]) => {
        const previous = previousInProgressRef.current;
        const justCompleted = previous.filter((pid) => !activePids.includes(pid));
        previousInProgressRef.current = activePids;

        if (justCompleted.length > 0) {
            void fetchDoneEvaluations();
        }
    }, [fetchDoneEvaluations]);

    const source = evaluations ?? [];
    const processedEvaluations = [...source]
        .map((evaluation: any) => {
            const createdAt = getEvaluationCreatedAt(evaluation);
            const finishedAt = getEvaluationFinishedAt(evaluation);
            const createdParts = formatDateParts(createdAt);
            const finishedParts = formatDateParts(finishedAt);
            const createdAtMs = getEvaluationCreatedAtMs(evaluation);

            return {
                evaluation,
                createdAtMs,
                createdParts,
                finishedParts,
            };
        })
        .sort((a, b) => {
            if (sortOrder === 'newest') {
                return (b.createdAtMs - a.createdAtMs) || String(b.evaluation.pid ?? '').localeCompare(String(a.evaluation.pid ?? ''));
            }
            return (a.createdAtMs - b.createdAtMs) || String(a.evaluation.pid ?? '').localeCompare(String(b.evaluation.pid ?? ''));
        });

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>


    return (
        <>
            {projectUUID && (
                <EvaluationProgressList
                    projectUUID={projectUUID}
                    onEvaluationsChanged={handleInProgressChanged}
                />
            )}
            <Box className="eval-header">
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography component="h2" variant="h4" gutterBottom className="eval-header-title">
                        Completed Evaluations:
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={sortOrder}
                        onChange={(_, val) => { if (val) setSortOrder(val); }}
                        aria-label="sort order"
                    >
                        <ToggleButton value="newest" aria-label="newest first">
                            <Tooltip title="Newest first">
                                <Box className="sort-toggle-row">
                                    <Icon className="sort-toggle-icon">arrow_downward</Icon>
                                    <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, ml: 0.5}}>Newest</Box>
                                </Box>
                            </Tooltip>
                        </ToggleButton>
                        <ToggleButton value="oldest" aria-label="oldest first">
                            <Tooltip title="Oldest first">
                                <Box className="sort-toggle-row">
                                    <Icon className="sort-toggle-icon">arrow_upward</Icon>
                                    <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, ml: 0.5}}>Oldest</Box>
                                </Box>
                            </Tooltip>
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
                <Tooltip title="Download Report">
                    <Button
                        variant="contained"
                        onClick={handleDownloadReport}
                        disabled={!projectName || !evaluations || evaluations.length === 0}
                        className="gradient-btn"
                        sx={{minWidth: {xs: '44px', md: 'auto'}, px: {xs: 1.5, md: 3}}}
                    >
                        <DownloadIcon />
                        <Box component="span" sx={{display: {xs: 'none', md: 'inline'}}}>
                            Download Report
                        </Box>
                    </Button>
                </Tooltip>
            </Box>
            <Grid
                container
                spacing={2}
                className="eval-grid"
            >
                {processedEvaluations.map(({evaluation, createdParts, finishedParts}) => (
                        <Grid key={evaluation.pid} size={{xs: 12, sm: 12, md: 6, lg: 4}}>
                            <Card
                                className="results-eval-card eval-card gradient-card"
                                variant="outlined"
                            >
                                <CardContent sx={{display: 'flex', flexDirection: 'column', gap: 1.25, height: '100%'}}>
                                    <CardActionArea
                                        component={Link}
                                        to={`${evaluation.pid}`}
                                        disabled={!SHOW_PLUGIN_VISUALIZATION}
                                        sx={{alignItems: 'stretch', borderRadius: 1.5, px: 0.2, py: 0.25}}
                                    >
                                        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1}}>
                                            <Box sx={{minWidth: 0}}>
                                                <Tooltip title={evaluation.pid} placement="top">
                                                    <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                                        Results
                                                    </Typography>
                                                </Tooltip>

                                                <Stack spacing={0.4} sx={{mt: 0.3}}>
                                                    <Stack direction="row" alignItems="center" spacing={0.7}>
                                                        <Chip
                                                            label="Created"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                width: 72,
                                                                bgcolor: 'info.light',
                                                                color: 'info.contrastText',
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary" sx={{fontFamily: 'monospace', minWidth: 84}}>
                                                            {createdParts.date}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{fontFamily: 'monospace'}}>
                                                            {createdParts.time}
                                                        </Typography>
                                                    </Stack>
                                                    <Stack direction="row" alignItems="center" spacing={0.7}>
                                                        <Chip
                                                            label="Finished"
                                                            size="small"
                                                            sx={{
                                                                height: 20,
                                                                width: 72,
                                                                bgcolor: finishedParts.date === 'Unknown date' ? 'grey.300' : 'success.light',
                                                                color: finishedParts.date === 'Unknown date' ? 'text.secondary' : 'success.contrastText',
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary" sx={{fontFamily: 'monospace', minWidth: 84}}>
                                                            {finishedParts.date}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{fontFamily: 'monospace'}}>
                                                            {finishedParts.time}
                                                        </Typography>
                                                    </Stack>
                                                </Stack>
                                            </Box>

                                            <Tooltip title="Download report for this evaluation">
                                                <IconButton
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        handleDownloadEvalReport(evaluation.pid);
                                                    }}
                                                    size="small"
                                                    className="eval-icon-btn"
                                                >
                                                    <DownloadIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>

                                        <Divider sx={{my: 0.25}} />
                                    </CardActionArea>

                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Typography variant="caption" color="text.secondary" sx={{fontWeight: 600}}>
                                                Executed plugins
                                            </Typography>
                                            <Chip
                                                label={`${(evaluation.evaluation_plugins || []).length}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{height: 20}}
                                            />
                                        </Stack>

                                        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.65}}>
                                            {(evaluation.evaluation_plugins || []).map((plugin: Plugin) => (
                                                <Tooltip
                                                    key={`${evaluation.pid}-${plugin.pid || plugin.name}`}
                                                    placement="bottom-start"
                                                    disableInteractive={false}
                                                    enterDelay={120}
                                                    leaveDelay={80}
                                                    title={
                                                        <Box sx={{maxWidth: 420}}>
                                                            <Typography variant="caption" sx={{display: 'block', mb: 0.4, fontWeight: 700}}>
                                                                {plugin.display_name || plugin.name} config
                                                            </Typography>
                                                            <Box
                                                                component="button"
                                                                type="button"
                                                                className="download-config-btn"
                                                                onClick={(event) => {
                                                                    event.preventDefault();
                                                                    event.stopPropagation();
                                                                    handleDownloadPluginConfig(evaluation.pid, plugin);
                                                                }}
                                                            >
                                                                <DownloadIcon sx={{fontSize: 13}} />
                                                                Click to download config JSON
                                                            </Box>
                                                            <Box
                                                                component="pre"
                                                                className="config-pre"
                                                            >
                                                                {redactConfig(plugin.plugin_config) || 'No config'}
                                                            </Box>
                                                        </Box>
                                                    }
                                                >
                                                    <Chip
                                                        label={plugin.display_name || plugin.name}
                                                        size="small"
                                                        color="primary"
                                                        variant="filled"
                                                        sx={{cursor: 'help', fontWeight: 600}}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </Box>

                                        <Box sx={{mt: 'auto'}} />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
            </Grid>
        </>
    )
}

export default PluginEvaluations
