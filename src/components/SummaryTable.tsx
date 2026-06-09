import React, { useEffect, useState } from "react";
import {
    Box, Typography, Card, CardContent, Stack, Skeleton, Chip,
    alpha, useTheme, Divider, Tooltip, Paper, Icon, LinearProgress, CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TimerIcon from "@mui/icons-material/Timer";
import StraightenIcon from "@mui/icons-material/Straighten";
import StorageIcon from "@mui/icons-material/Storage";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import ExtensionIcon from "@mui/icons-material/Extension";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CategoryIcon from "@mui/icons-material/Category";
import SettingsIcon from "@mui/icons-material/Settings";
import DatasetIcon from "@mui/icons-material/Dataset";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { LineChart } from "@mui/x-charts/LineChart";
import {
    getProjectStatsOverview,
    getProjectMetricBreakdown,
    getProjectPluginUsage,
} from "../api/api";
import { API_VERSION_PREFIX } from "../config";
import {
    ProjectStatsOverview,
    MetricScoreSummary,
    PluginUsageSummary,
    Evaluation,
    TaskProgress,
} from "../models/models";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

// ─── Helpers ───────────────────────────────────────────────

const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return "N/A";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
};

// ─── Stat Card ─────────────────────────────────────────────

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtitle?: string;
    color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtitle, color }) => {
    const theme = useTheme();
    const c = color || theme.palette.primary.main;
    return (
        <Card
            variant="outlined"
            sx={{
                height: "100%",
                borderLeft: `4px solid ${c}`,
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: theme.shadows[4] },
            }}
        >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 44, height: 44, borderRadius: 2,
                        bgcolor: alpha(c, 0.1), color: c,
                    }}>
                        {icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {label}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} noWrap>
                            {value}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
};

// ─── Section Card wrapper ──────────────────────────────────

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <Card variant="outlined" sx={{ height: "100%" }}>
        <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {title}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {children}
        </CardContent>
    </Card>
);

// ─── Main Component ────────────────────────────────────────

interface SummaryTableProps {
    projectPid: string | null;
}

interface EvaluationPluginStatus {
    pid: string;
    status: string;
}

const SummaryTable: React.FC<SummaryTableProps> = ({ projectPid }) => {
    const theme = useTheme();
    const [overview, setOverview] = useState<ProjectStatsOverview | null>(null);
    const [metrics, setMetrics] = useState<MetricScoreSummary[]>([]);
    const [plugins, setPlugins] = useState<PluginUsageSummary[]>([]);
    const [pluginIcons, setPluginIcons] = useState<Record<string, string>>({});
    const [pluginDisplayNames, setPluginDisplayNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [fontLoaded, setFontLoaded] = useState(false);

    useEffect(() => {
        document.fonts.ready.then(() => setFontLoaded(true));
    }, []);

    const [runningEvaluations, setRunningEvaluations] = useState<Evaluation[]>([]);
    const [taskProgress, setTaskProgress] = useState<Record<string, Record<string, TaskProgress>>>({});
    const [evaluationPluginStatuses, setEvaluationPluginStatuses] = useState<Record<string, EvaluationPluginStatus[]>>({});

    useEffect(() => {
        if (!projectPid) return;
        setLoading(true);

        const fetchWithFallback = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
            try {
                return await fn();
            } catch {
                return fallback;
            }
        };

        const emptyOverview: ProjectStatsOverview = {
            total_evaluations: 0,
            evaluations_by_status: [],
            success_rate: 0,
            avg_evaluation_duration_seconds: null,
            std_evaluation_duration_seconds: null,
            last_evaluation_date: null,
            total_measurements: 0,
            avg_score: null,
            avg_uncertainty: null,
            error_rate: 0,
            unique_metrics_used: 0,
            feature_coverage: 0,
            total_datasets: 0,
            total_models: 0,
            datasets_evaluated: 0,
            models_evaluated: 0,
            active_plugins: 0,
            total_artifacts: 0,
            num_configs: 0,
        };

        Promise.all([
            fetchWithFallback(() => getProjectStatsOverview(projectPid), emptyOverview),
            fetchWithFallback(() => getProjectMetricBreakdown(projectPid), { metrics: [] }),
            fetchWithFallback(() => getProjectPluginUsage(projectPid), { plugins: [] }),
            fetchWithFallback(async () => {
                const res = await fetch(`${API_URL}/projects/${projectPid}`);
                return await res.json() as { plugins: { name: string; pid: string; display_name: string }[] };
            }, { plugins: [] }),
        ])
            .then(async ([ov, mt, pl, project]) => {
                setOverview(ov);
                setMetrics(mt.metrics);
                setPlugins(pl.plugins);
                setLoading(false);

                // Build name → pid map from the project's plugin list
                const pidByName: Record<string, string> = {};
                const displayNameByName: Record<string, string> = {};
                for (const plugin of project.plugins) {
                    pidByName[plugin.name] = plugin.pid;
                    displayNameByName[plugin.name] = plugin.display_name;
                }
                setPluginDisplayNames(displayNameByName);

                // Fetch icons in the background using pid (same as LeftBar)
                const allPluginNames = new Set([
                    ...pl.plugins.map((p) => p.plugin_name),
                    ...mt.metrics.map((m) => m.plugin_name),
                ]);
                const icons: Record<string, string> = {};
                await Promise.all(
                    [...allPluginNames]
                        .filter(Boolean)
                        .map(async (name) => {
                            // metric plugin_name is "package::name (v0.0.0)" — extract short name
                            const shortName = name.includes('::') ? name.split('::')[1].split(' ')[0] : name;
                            const pid = pidByName[shortName];
                            if (!pid) return;
                            try {
                                const res = await fetch(`${API_URL}/plugins/${pid}/display_icon`);
                                if (res.ok) {
                                    icons[name] = await res.json() as string;
                                }
                            } catch { /* ignore */ }
                        })
                );
                setPluginIcons(icons);
            })
            .catch(() => setLoading(false));
    }, [projectPid]);

    // Fetch running evaluations and poll for task progress
    useEffect(() => {
        if (!projectPid || loading) return;

        const fetchRunningEvaluations = async () => {
            try {
                const res = await fetch(`${API_URL}/projects/${projectPid}/evaluations?exclude_status=Done&exclude_status=Failed&exclude_status=Archived`);
                if (res.ok) {
                    const evaluations = await res.json() as Evaluation[];
                    setRunningEvaluations(evaluations);

                    // Fetch task progress and plugin statuses for each evaluation
                    for (const evaluation of evaluations) {
                        // Fetch detailed evaluation with plugin statuses
                        try {
                            const evalRes = await fetch(`${API_URL}/evaluations/${evaluation.pid}?include=plugin`);
                            if (evalRes.ok) {
                                const detailedEval = await evalRes.json();
                                const pluginStatuses: EvaluationPluginStatus[] = (detailedEval.evaluation_plugins || []).map((ep: any) => ({
                                    pid: ep.pid,
                                    status: ep.status || 'Pending'
                                }));
                                setEvaluationPluginStatuses(prev => ({
                                    ...prev,
                                    [evaluation.pid]: pluginStatuses
                                }));
                            }
                        } catch {
                            // ignore
                        }

                        // Fetch task progress
                        if (evaluation.task) {
                            try {
                                const taskRes = await fetch(`${API_URL}/tasks/${evaluation.task}/status`);
                                if (taskRes.ok) {
                                    const progress = await taskRes.json() as Record<string, TaskProgress>;
                                    setTaskProgress(prev => ({
                                        ...prev,
                                        [evaluation.pid]: progress
                                    }));
                                }
                            } catch {
                                // ignore
                            }
                        }
                    }
                }
            } catch {
                // ignore
            }
        };

        fetchRunningEvaluations();
        const interval = setInterval(fetchRunningEvaluations, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [projectPid, loading]);

    if (!projectPid) {
        return (
            <Box sx={{ p: 4, textAlign: "center" }}>
                <Typography color="text.secondary">No project selected.</Typography>
            </Box>
        );
    }

    if (loading) {
        return (
            <Box sx={{ p: 2 }}>
                <Grid container spacing={2}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
                            <Skeleton variant="rounded" height={100} />
                        </Grid>
                    ))}
                </Grid>
                <Skeleton variant="rounded" height={300} sx={{ mt: 3 }} />
            </Box>
        );
    }

    if (!overview) return null;

    // ── Derived data for charts ──

    // Avg duration per plugin line chart data
    const durationPluginNames = [...new Set(pluginDurations.map((r) => r.plugin_name))];
    const maxRunIndex = Math.max(0, ...pluginDurations.map((r) => r.run_index));
    const runIndices = Array.from({ length: maxRunIndex }, (_, i) => i + 1);
    const durationSeries = durationPluginNames.map((name) => {
        const runs = new Map(
            pluginDurations.filter((r) => r.plugin_name === name).map((r) => [r.run_index, r.duration_seconds])
        );
        return {
            id: name,
            label: pluginDisplayNames[name] || name,
            data: runIndices.map((idx) => runs.get(idx) ?? null),
        };
    });
    const chartSeries = durationSeries.map((s) => ({
        ...s,
        showMark: runIndices.length < 30,
        connectNulls: false,
    }));

    const xBounds = computeXIndexBoundsFromVisible(chartSeries, hiddenSeriesIds);
    const xStart = xBounds?.start ?? 0;
    const xEnd = (xBounds?.end ?? (runIndices.length - 1)) + 1;
    const visibleRunIndices = runIndices.slice(xStart, xEnd);
    const visibleChartSeries = chartSeries.map((s) => ({
        ...s,
        data: s.data.slice(xStart, xEnd),
    }));

    const { yMin, yMax } = computeYDomainFromVisible(visibleChartSeries, hiddenSeriesIds);

    const hiddenItems = hiddenSeriesIds.map((seriesId) => ({
        type: "line" as const,
        seriesId,
    }));

    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
            {/* ── Overview boxes (KPI Cards) ── */}
            <Grid container spacing={2} sx={{ order: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<DatasetIcon />} label="Total Datasets" value={overview.total_datasets} color="#5c6bc0" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<ModelTrainingIcon />} label="Total Models" value={overview.total_models} color="#ec407a" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<StorageIcon />} label="Evaluated Datasets" value={overview.datasets_evaluated} color="#26a69a" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<ModelTrainingIcon />} label="Evaluated Models" value={overview.models_evaluated} color="#ab47bc" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<AssessmentIcon />} label="Total Evaluations" value={overview.total_evaluations} color="#1976d2" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard
                        icon={<CheckCircleIcon />}
                        label="Success Rate"
                        value={`${overview.success_rate}%`}
                        subtitle={`${overview.evaluations_by_status.find(s => s.status === "Done")?.count ?? 0} completed`}
                        color="#4caf50"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard
                        icon={<TimerIcon />}
                        label="Avg Duration"
                        value={formatDuration(overview.avg_evaluation_duration_seconds)}
                        subtitle={overview.std_evaluation_duration_seconds !== null
                            ? `Std: ${formatDuration(overview.std_evaluation_duration_seconds)}`
                            : undefined}
                        color="#ff9800"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<ExtensionIcon />} label="Active Plugins" value={overview.active_plugins} color="#8d6e63" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<CategoryIcon />} label="Metrics Used" value={overview.unique_metrics_used} color="#78909c" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<StraightenIcon />} label="Total Measurements" value={overview.total_measurements.toLocaleString()} color="#9c27b0" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<InsertDriveFileIcon />} label="Artifacts" value={overview.total_artifacts} color="#546e7a" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <StatCard icon={<SettingsIcon />} label="Configs" value={overview.num_configs} color="#6d4c41" />
                </Grid>
            </Grid>

            {/* ── All runs (plugin usage) ── */}
            {plugins.length > 0 && (
                <Box sx={{ order: 1 }}>
                    <SectionCard title="All runs">
                        <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
                        <Stack spacing={1.5}>
                            {plugins.map((p) => (
                                <Paper
                                    key={p.plugin_name}
                                    variant="outlined"
                                    sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
                                >
                                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: "1 1 auto" }}>
                                        {pluginIcons[p.plugin_name] && fontLoaded
                                            ? <Icon sx={{ color: theme.palette.primary.main, fontSize: 20, flexShrink: 0 }}>{pluginIcons[p.plugin_name]}</Icon>
                                            : <ExtensionIcon sx={{ color: theme.palette.primary.main, fontSize: 20, flexShrink: 0 }} />
                                        }
                                        <Typography variant="body2" fontWeight={600} noWrap title={pluginDisplayNames[p.plugin_name] || p.plugin_name}>{pluginDisplayNames[p.plugin_name] || p.plugin_name}</Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                                        <Tooltip title="Total executions">
                                            <Chip label={`${p.usage_count}`} size="small" variant="outlined" icon={<PlayArrowIcon />} />
                                        </Tooltip>
                                        <Tooltip title="Successful runs">
                                            <Chip label={`${p.successful_runs}`} size="small" color="success" variant="outlined" icon={<CheckCircleIcon />} />
                                        </Tooltip>
                                        <Tooltip title="Failed runs">
                                            <Chip label={`${p.failed_runs}`} size="small" color="error" variant="outlined" icon={<CancelIcon />} />
                                        </Tooltip>
                                        <Tooltip title="Artifacts produced">
                                            <Chip label={`${p.artifact_count}`} size="small" color="primary" variant="outlined" icon={<InsertDriveFileIcon />} />
                                        </Tooltip>
                                        <Tooltip title="Avg execution time">
                                            <Chip label={p.avg_duration_seconds !== null ? formatDuration(p.avg_duration_seconds) : 'N/A'} size="small" color="secondary" variant="outlined" icon={<TimerIcon />} />
                                        </Tooltip>
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                        </Box>
                    </SectionCard>
                </Box>
            )}

            {/* ── Progress Report ── */}
            {runningEvaluations.length > 0 && (
                <Box sx={{ order: 5 }}>
                    <SectionCard title="Progress Report">
                        <Stack spacing={3}>
                            {runningEvaluations.map((evaluation) => {
                                const progress = taskProgress[evaluation.pid] || {};
                                const pluginStatuses = evaluationPluginStatuses[evaluation.pid];

                                // Ignore evaluations with no plugins (e.g. stuck from a failed create)
                                if (pluginStatuses !== undefined && pluginStatuses.length === 0) return null;

                                // Calculate main progress based on actual plugin statuses
                                const statuses = pluginStatuses || [];
                                const totalPlugins = statuses.length;
                                const completedPlugins = statuses.filter(ps => ps.status === "Done").length;
                                const failedPlugins = statuses.filter(ps => ps.status === "Failed").length;
                                const mainProgressValue = totalPlugins > 0 ? (completedPlugins / totalPlugins) * 100 : 0;

                                return (
                                    <Box key={evaluation.pid}>
                                        {/* Evaluation Progress Bar */}
                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                            <Stack spacing={1}>
                                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            Evaluation Progress
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {evaluation.pid}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {completedPlugins} / {totalPlugins} plugins complete
                                                        {failedPlugins > 0 && <> • {failedPlugins} failed</>}
                                                    </Typography>
                                                </Stack>
                                                {Object.keys(progress).length === 0 && completedPlugins === 0 ? (
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        <CircularProgress size={16} thickness={5} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Installing dependencies...
                                                        </Typography>
                                                    </Stack>
                                                ) : (
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={mainProgressValue}
                                                        sx={{
                                                            height: 8,
                                                            borderRadius: 1,
                                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                            '& .MuiLinearProgress-bar': {
                                                                bgcolor: failedPlugins > 0 ? theme.palette.error.main : theme.palette.primary.main,
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </Stack>
                                        </Paper>

                                        {/* Individual Plugin Progress Bars — nested under evaluation */}
                                        {Object.keys(progress).length > 0 && (
                                            <Box sx={{ display: 'flex', mt: 0.5 }}>
                                                {/* Tree connector line */}
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0, pt: 1, pb: 1 }}>
                                                    <Box sx={{ width: 2, flex: 1, bgcolor: theme.palette.divider, borderRadius: 1 }} />
                                                </Box>
                                                <Stack spacing={1} sx={{ flex: 1 }}>
                                                    {Object.entries(progress).map(([pluginName, taskProgress]) => {
                                                        const progressValue = (taskProgress.progress || 0) * 100;
                                                        const extra = taskProgress.extra as any;
                                                        const description = extra?.desc || extra?.message || null;
                                                        const iteration = extra?.iteration || extra?.current || null;
                                                        const total = extra?.total || null;

                                                        return (
                                                            <Paper
                                                                key={pluginName}
                                                                variant="outlined"
                                                                sx={{ p: 2 }}
                                                            >
                                                                <Stack spacing={1}>
                                                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                                             {pluginIcons[pluginName] && fontLoaded
                                                                                 ? <Icon sx={{ color: theme.palette.primary.main, fontSize: 18 }}>{pluginIcons[pluginName]}</Icon>
                                                                                 : <ExtensionIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                                                                             }
                                                                            <Typography variant="body2" fontWeight={600}>
                                                                                {pluginDisplayNames[pluginName] || pluginName}
                                                                            </Typography>
                                                                        </Stack>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {iteration !== null && total !== null
                                                                                ? `${iteration} / ${total}`
                                                                                : `${Math.round(progressValue)}%`
                                                                            }
                                                                        </Typography>
                                                                    </Stack>
                                                                    <LinearProgress
                                                                        variant="determinate"
                                                                        value={progressValue}
                                                                        sx={{ height: 8, borderRadius: 1 }}
                                                                    />
                                                                    {description && (
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {description}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            </Paper>
                                                        );
                                                     })}
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                );

                            })}
                        </Stack>
                    </SectionCard>
                </Box>
            )}

            {/* ── Plugin Duration per Run ── */}
            {durationSeries.length > 0 && (
                <Box sx={{ order: 4 }}>
                    <SectionCard title="Plugin Duration per Run">
                        <LineChart
                            xAxis={[
                                {
                                    data: visibleRunIndices,
                                    label: "Run #",
                                    scaleType: "point",
                                },
                            ]}
                            yAxis={[
                                {
                                    min: yMin,
                                    max: yMax,
                                    domainLimit: "strict",
                                },
                            ]}
                            series={visibleChartSeries}
                            hiddenItems={hiddenItems}
                            height={300}
                            slotProps={{
                                legend: {
                                    direction: "horizontal" as const,
                                    onItemClick: (_event: unknown, legendItem: { seriesId: string | number }) => {
                                        setHiddenSeriesIds((prev) => toggleHidden(prev, String(legendItem.seriesId)));
                                    },
                                },
                            }}
                        />
                    </SectionCard>
                </Box>
            )}

            {/* ── Metric Details ── */}
            {metrics.length > 0 && (
                <Box sx={{ order: 2 }}>
                    <SectionCard title="Metric Details">
                        <Box sx={{ maxHeight: 280, overflowY: "auto", overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        {["Plugin", "Metric", "Avg", "Min", "Max", "Std", "Count"].map((h) => (
                                            <th key={h} style={{
                                                textAlign: "left", padding: "8px 12px",
                                                borderBottom: `2px solid ${theme.palette.divider}`,
                                                fontSize: 13, color: theme.palette.text.secondary,
                                                fontWeight: 600,
                                                position: "sticky", top: 0,
                                                backgroundColor: theme.palette.background.paper,
                                                zIndex: 1,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map((m, idx) => (
                                        <tr key={`${m.plugin_name}-${m.metric_pid}-${idx}`} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                                            <td style={{ padding: "8px 12px" }}>
                                                 <Chip label={pluginDisplayNames[m.plugin_name.includes('::') ? m.plugin_name.split('::')[1].split(' ')[0] : m.plugin_name] || m.plugin_name} size="small" variant="outlined" icon={
                                                     pluginIcons[m.plugin_name] && fontLoaded
                                                         ? <Icon sx={{ fontSize: 16 }}>{pluginIcons[m.plugin_name]}</Icon>
                                                         : <ExtensionIcon />
                                                 } />
                                            </td>
                                            <td style={{ padding: "8px 12px", fontWeight: 500 }}>{m.metric_name}</td>
                                            <td style={{ padding: "8px 12px" }}>{m.avg_score.toFixed(4)}</td>
                                            <td style={{ padding: "8px 12px" }}>{m.min_score.toFixed(4)}</td>
                                            <td style={{ padding: "8px 12px" }}>{m.max_score.toFixed(4)}</td>
                                            <td style={{ padding: "8px 12px" }}>{m.std_score.toFixed(4)}</td>
                                            <td style={{ padding: "8px 12px" }}>
                                                <Chip label={m.measurement_count} size="small" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Box>
                    </SectionCard>
                </Box>
            )}

            {/* Empty state */}
            {overview.total_evaluations === 0 && (
                <Box sx={{ textAlign: "center", py: 8, order: 6 }}>
                    <AssessmentIcon sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        No evaluations yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Run your first evaluation to see stats here.
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default SummaryTable;
