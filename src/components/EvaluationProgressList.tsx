import {
    alpha,
    Box,
    Card,
    CardContent,
    Collapse,
    CircularProgress,
    Divider,
    Icon,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    Typography,
    useTheme,
} from '@mui/material';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ExtensionIcon from '@mui/icons-material/Extension';
import {API_VERSION_PREFIX} from '../config.tsx';
import {Evaluation, Plugin, TaskProgress} from '../models/models.tsx';
import {useEffect, useState} from 'react';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const RUNNING_STATUSES = ['Pending', 'Processing'] as const;
type RunningStatus = (typeof RUNNING_STATUSES)[number];

const fetchEvalsByStatus = async (
    projectUUID: string,
    status: RunningStatus,
): Promise<Evaluation[]> => {
    const res = await fetch(
        `${API_URL}/projects/${projectUUID}/evaluations?status=${status}`,
    );
    if (!res.ok) throw new Error(`evals ${status} fetch failed: ${res.status}`);
    return res.json();
};

const fetchTaskStatus = async (
    taskPid: string,
): Promise<Record<string, TaskProgress & {plugin_name?: string}>> => {
    const res = await fetch(`${API_URL}/tasks/${taskPid}/status`);
    if (!res.ok) throw new Error(`task status fetch failed: ${res.status}`);
    return res.json();
};

const fetchEvaluationPluginStatuses = async (
    evaluationPid: string,
): Promise<Record<string, string>> => {
    const res = await fetch(`${API_URL}/evaluations/${evaluationPid}?include=plugin`);
    if (!res.ok) throw new Error('evaluation plugin statuses fetch failed');

    const data = await res.json() as {
        evaluation_plugins?: Array<{
            pid?: string;
            plugin_pid?: string;
            name?: string;
            display_name?: string;
            status?: string;
        }>;
    };

    const statusMap: Record<string, string> = {};
    for (const plugin of data.evaluation_plugins ?? []) {
        if (!plugin.status) continue;
        if (plugin.pid) statusMap[plugin.pid] = plugin.status;
        if (plugin.plugin_pid) statusMap[plugin.plugin_pid] = plugin.status;
        if (plugin.name) statusMap[plugin.name] = plugin.status;
        if (plugin.display_name) statusMap[plugin.display_name] = plugin.status;
    }

    return statusMap;
};

const fetchPluginIcon = async (pluginPid: string): Promise<string> => {
    const res = await fetch(`${API_URL}/plugins/${pluginPid}/display_icon`);
    if (!res.ok) throw new Error('plugin icon fetch failed');
    return res.json() as Promise<string>;
};

const fetchProjectPluginPidMap = async (projectUUID: string): Promise<Record<string, string>> => {
    const res = await fetch(`${API_URL}/projects/${projectUUID}`);
    if (!res.ok) throw new Error('project fetch failed');
    const data = await res.json() as {plugins?: Array<{name?: string; display_name?: string; pid?: string}>};
    const map: Record<string, string> = {};
    for (const plugin of data.plugins ?? []) {
        if (!plugin.pid) continue;
        if (plugin.name) map[plugin.name] = plugin.pid;
        if (plugin.display_name) map[plugin.display_name] = plugin.pid;
    }
    return map;
};

function getTaskStatusForPlugin(
    statuses: Record<string, TaskProgress & {plugin_name?: string}>,
    plugin: Plugin,
): (TaskProgress & {plugin_name?: string}) | undefined {
    const directKeys = [
        plugin.name,
        plugin.display_name,
        plugin.pid,
        plugin.plugin_pid,
    ].filter(Boolean) as string[];

    for (const key of directKeys) {
        if (statuses[key]) return statuses[key];
    }

    const byPluginName = Object.values(statuses).find((status) => {
        const statusName = (status as {plugin_name?: string}).plugin_name;
        return (
            statusName === plugin.name ||
            statusName === plugin.display_name ||
            statusName === plugin.plugin_pid
        );
    });
    if (byPluginName) return byPluginName;

    const fuzzyByKey = Object.entries(statuses).find(([key]) => (
        (plugin.name && key.includes(plugin.name)) ||
        (plugin.display_name && key.includes(plugin.display_name))
    ));

    return fuzzyByKey?.[1];
}

function resolvePluginDescription(
    plugin: Plugin,
    taskStatus: (TaskProgress & {plugin_name?: string}) | undefined,
    evaluationStatusByPlugin: Record<string, string>,
): string {
    const extra = taskStatus?.extra as
        | {
              description?: unknown;
              desc?: unknown;
          }
        | undefined;

    const candidates: unknown[] = [
        extra?.desc,
        extra?.description,
        evaluationStatusByPlugin[plugin.pid],
        evaluationStatusByPlugin[plugin.plugin_pid],
        evaluationStatusByPlugin[plugin.name],
        evaluationStatusByPlugin[plugin.display_name],
        (plugin as Plugin & {description?: unknown}).description,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }
    return 'running';
}

function EvalProgressRow({
    evaluation,
    collapseSignal,
    expandSignal,
    pluginIcons,
}: {
    evaluation: Evaluation;
    collapseSignal: number;
    expandSignal: number;
    pluginIcons: Record<string, string>;
}) {
    const theme = useTheme();
    const [open, setOpen] = useState(true);
    const taskPid = evaluation.task;
    const [pluginStatuses, setPluginStatuses] = useState<Record<string, TaskProgress & {plugin_name?: string}> | null>(null);
    const [evaluationPluginStatuses, setEvaluationPluginStatuses] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        if (!taskPid) {
            setPluginStatuses(null);
            return;
        }

        let cancelled = false;
        const loadStatuses = async () => {
            try {
                const data = await fetchTaskStatus(taskPid);
                if (!cancelled) setPluginStatuses(data);
            } catch {
                if (!cancelled) setPluginStatuses(null);
            }
        };

        loadStatuses();
        const interval = setInterval(loadStatuses, 2000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [taskPid]);

    useEffect(() => {
        if (!evaluation.pid) {
            setEvaluationPluginStatuses(null);
            return;
        }

        let cancelled = false;
        const loadDetailedStatuses = async () => {
            try {
                const data = await fetchEvaluationPluginStatuses(evaluation.pid);
                if (!cancelled) setEvaluationPluginStatuses(data);
            } catch {
                if (!cancelled) setEvaluationPluginStatuses(null);
            }
        };

        loadDetailedStatuses();
        const interval = setInterval(loadDetailedStatuses, 3000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [evaluation.pid]);

    const statuses = pluginStatuses ?? {};
    const detailedStatuses = evaluationPluginStatuses ?? {};
    const plugins: Plugin[] = evaluation.evaluation_plugins ?? [];
    const pluginStatusValues = Object.values(statuses);
    const totalPlugins = plugins.length || pluginStatusValues.length;
    const completedPlugins = pluginStatusValues.filter((s) => {
        const status = (s.extra as {status?: string; phase?: string} | undefined)?.status;
        const phase = (s.extra as {status?: string; phase?: string} | undefined)?.phase;
        return status === 'Done' || phase === 'done' || (s.progress ?? 0) >= 1;
    }).length;
    const failedPlugins = pluginStatusValues.filter((s) => {
        const status = (s.extra as {status?: string; phase?: string} | undefined)?.status;
        const phase = (s.extra as {status?: string; phase?: string} | undefined)?.phase;
        return status === 'Failed' || phase === 'failed';
    }).length;
    const progressPercent = totalPlugins > 0 ? Math.round((completedPlugins / totalPlugins) * 100) : 0;

    useEffect(() => {
        setOpen(false);
    }, [collapseSignal]);

    useEffect(() => {
        setOpen(true);
    }, [expandSignal]);

    return (
        <TableContainer component={Paper} variant="outlined" sx={{borderRadius: 2, overflow: 'hidden'}}>
            <Table size="small">
                <TableBody>
                    <TableRow
                        hover
                        onClick={() => setOpen((prev) => !prev)}
                        sx={{
                            cursor: 'pointer',
                            '& .eval-pid': {opacity: 0, transition: 'opacity 0.2s ease'},
                            '&:hover .eval-pid': {opacity: 1},
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                        }}
                    >
                        <TableCell sx={{borderBottom: open ? `1px solid ${theme.palette.divider}` : 0, py: 1.5}}>
                            <Stack spacing={1}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                        <HourglassTopIcon color="primary" fontSize="small" />
                                        <Typography variant="body2" fontWeight={700}>
                                            Evaluation Progress
                                        </Typography>
                                        <Typography
                                            className="eval-pid"
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{fontFamily: 'monospace'}}
                                        >
                                            {evaluation.pid}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 700,
                                            color: failedPlugins > 0 ? 'error.main' : 'primary.main',
                                        }}
                                    >
                                        {failedPlugins > 0 ? 'Attention needed' : 'In progress'}
                                    </Typography>
                                </Stack>

                                {Object.keys(statuses).length === 0 && completedPlugins === 0 ? (
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <CircularProgress size={16} thickness={5} />
                                        <Typography variant="caption" color="text.secondary">
                                            Installing dependencies...
                                        </Typography>
                                    </Stack>
                                ) : (
                                    <LinearProgress
                                        variant="determinate"
                                        value={progressPercent}
                                        sx={{
                                            height: 10,
                                            borderRadius: 6,
                                            bgcolor: alpha(theme.palette.primary.main, 0.16),
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: failedPlugins > 0 ? theme.palette.error.main : theme.palette.primary.main,
                                                borderRadius: 6,
                                            },
                                        }}
                                    />
                                )}
                            </Stack>
                        </TableCell>
                    </TableRow>

                    <TableRow>
                        <TableCell sx={{borderBottom: 0, p: 0}}>
                            <Collapse in={open} timeout="auto" unmountOnExit>
                                <Table size="small">
                                    <TableBody>
                                        {plugins.length > 0 ? (
                                            plugins.map((plugin) => {
                                                const ps = getTaskStatusForPlugin(statuses, plugin);
                                                const pct = ps ? Math.round((ps.progress ?? 0) * 100) : 0;
                                                const description = resolvePluginDescription(plugin, ps, detailedStatuses);

                                                return (
                                                    <TableRow key={plugin.pid}>
                                                        <TableCell sx={{py: 1.2, width: '40%'}}>
                                                            <Stack direction="row" spacing={0.8} alignItems="center">
                                                                {(plugin.display_icon ||
                                                                    pluginIcons[plugin.pid] ||
                                                                    pluginIcons[plugin.plugin_pid] ||
                                                                    pluginIcons[plugin.name] ||
                                                                    pluginIcons[plugin.display_name]) ? (
                                                                    <Icon sx={{fontSize: 17, color: 'primary.main'}}>
                                                                        {plugin.display_icon ||
                                                                            pluginIcons[plugin.pid] ||
                                                                            pluginIcons[plugin.plugin_pid] ||
                                                                            pluginIcons[plugin.name] ||
                                                                            pluginIcons[plugin.display_name]}
                                                                    </Icon>
                                                                ) : (
                                                                    <ExtensionIcon sx={{fontSize: 16, color: 'primary.main'}} />
                                                                )}
                                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                                    {plugin.display_name || plugin.name}
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell sx={{py: 1.2, width: 180}}>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{lineHeight: 1.35, display: 'block', whiteSpace: 'normal'}}
                                                            >
                                                                {description}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{py: 1.2}}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <LinearProgress
                                                                    variant={ps ? 'determinate' : 'indeterminate'}
                                                                    value={pct}
                                                                    sx={{
                                                                        flex: 1,
                                                                        height: 8,
                                                                        borderRadius: 6,
                                                                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                                        '& .MuiLinearProgress-bar': {
                                                                            borderRadius: 6,
                                                                        },
                                                                    }}
                                                                />
                                                                <Typography variant="caption" sx={{minWidth: 34, textAlign: 'right'}}>
                                                                    {ps ? `${pct}%` : '-'}
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell sx={{py: 1.5}}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        No plugins attached.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Collapse>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default function EvaluationProgressList({
    projectUUID,
    onEvaluationsChanged,
}: {
    projectUUID: string;
    onEvaluationsChanged?: (evaluationPids: string[]) => void;
}) {
    const [open, setOpen] = useState(true);
    const [collapseSignal, setCollapseSignal] = useState(0);
    const [expandSignal, setExpandSignal] = useState(0);
    const [shouldPollRunning, setShouldPollRunning] = useState(true);
    const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([]);
    const [processingEvaluations, setProcessingEvaluations] = useState<Evaluation[]>([]);
    const [pluginPidByName, setPluginPidByName] = useState<Record<string, string>>({});

    useEffect(() => {
        setShouldPollRunning(true);
    }, [projectUUID]);

    useEffect(() => {
        if (!projectUUID || !shouldPollRunning) {
            setPendingEvaluations([]);
            setProcessingEvaluations([]);
            return;
        }

        let cancelled = false;
        const loadEvaluations = async () => {
            try {
                const [pending, processing] = await Promise.all([
                    fetchEvalsByStatus(projectUUID, 'Pending'),
                    fetchEvalsByStatus(projectUUID, 'Processing'),
                ]);
                if (!cancelled) {
                    setPendingEvaluations(pending);
                    setProcessingEvaluations(processing);
                    if (pending.length === 0 && processing.length === 0) {
                        setShouldPollRunning(false);
                    }
                }
            } catch {
                if (!cancelled) {
                    setPendingEvaluations([]);
                    setProcessingEvaluations([]);
                }
            }
        };

        loadEvaluations();
        const interval = setInterval(loadEvaluations, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [projectUUID, shouldPollRunning]);

    useEffect(() => {
        if (!projectUUID) {
            setPluginPidByName({});
            return;
        }

        let cancelled = false;
        const loadPluginMap = async () => {
            try {
                const mapping = await fetchProjectPluginPidMap(projectUUID);
                if (!cancelled) setPluginPidByName(mapping);
            } catch {
                if (!cancelled) setPluginPidByName({});
            }
        };

        loadPluginMap();
        return () => {
            cancelled = true;
        };
    }, [projectUUID]);

    const evaluations: Evaluation[] = [
        ...pendingEvaluations,
        ...processingEvaluations,
    ].sort((a, b) => a.pid.localeCompare(b.pid));
    const [pluginIcons, setPluginIcons] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const loadIcons = async () => {
            const next: Record<string, string> = {};

            await Promise.all(
                evaluations.flatMap((evaluation) => (evaluation.evaluation_plugins ?? [])).map(async (plugin) => {
                    const pluginPid =
                        plugin.plugin_pid ||
                        pluginPidByName[plugin.name] ||
                        pluginPidByName[plugin.display_name] ||
                        plugin.pid;

                    if (!pluginPid || pluginIcons[pluginPid]) return;

                    try {
                        const iconName = await fetchPluginIcon(pluginPid);
                        next[pluginPid] = iconName;
                        if (plugin.name) next[plugin.name] = iconName;
                        if (plugin.display_name) next[plugin.display_name] = iconName;
                        if (plugin.pid) next[plugin.pid] = iconName;
                        if (plugin.plugin_pid) next[plugin.plugin_pid] = iconName;
                    } catch {
                        // ignore and fallback to default icon
                    }
                }),
            );

            if (!cancelled && Object.keys(next).length > 0) {
                setPluginIcons((prev) => ({...prev, ...next}));
            }
        };

        loadIcons();

        return () => {
            cancelled = true;
        };
    }, [evaluations, pluginPidByName]);

    useEffect(() => {
        onEvaluationsChanged?.(evaluations.map((ev) => ev.pid));
    }, [evaluations, onEvaluationsChanged]);

    if (evaluations.length === 0) return null;

    return (
        <Card variant="outlined" sx={{mb: 3}}>
            <CardContent>
                <Box
                    onClick={() => {
                        if (open) {
                            setCollapseSignal((prev) => prev + 1);
                            setOpen(false);
                        } else {
                            setExpandSignal((prev) => prev + 1);
                            setOpen(true);
                        }
                    }}
                    sx={{cursor: 'pointer'}}
                >
                    <Typography component="h2" variant="h5" gutterBottom sx={{mb: 0.5}}>
                        Running Evaluations
                    </Typography>
                </Box>

                <Divider sx={{my: 2}} />

                <Collapse in={open} timeout="auto" unmountOnExit>
                    <Stack spacing={1.5}>
                        {evaluations.map((ev) => (
                            <EvalProgressRow
                                key={ev.pid}
                                evaluation={ev}
                                collapseSignal={collapseSignal}
                                expandSignal={expandSignal}
                                pluginIcons={pluginIcons}
                            />
                        ))}
                    </Stack>
                </Collapse>
            </CardContent>
        </Card>
    );
}
