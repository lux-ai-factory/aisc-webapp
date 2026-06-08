import {useQuery} from '@tanstack/react-query';
import {
    Box,
    LinearProgress,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import {API_VERSION_PREFIX} from '../config.tsx';
import {Evaluation, Plugin, TaskProgress} from '../models/models.tsx';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const RUNNING_STATUSES = ['Pending', 'Processing'] as const;
type RunningStatus = (typeof RUNNING_STATUSES)[number];

const SENSITIVE_KEYS = new Set([
    'model_credential',
    'api_key',
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
    if (!inner || typeof inner !== 'object') return JSON.stringify(config);
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
        safe[k] = SENSITIVE_KEYS.has(k) ? '<redacted>' : v;
    }
    return JSON.stringify(safe);
}

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

function EvalProgressRow({evaluation}: {evaluation: Evaluation}) {
    const taskPid = evaluation.task;
    const {data: pluginStatuses} = useQuery({
        queryKey: ['task-status', taskPid],
        queryFn: () => fetchTaskStatus(taskPid),
        enabled: Boolean(taskPid),
        refetchInterval: 2000,
        retry: false,
    });

    const statuses = pluginStatuses ?? {};
    const plugins: Plugin[] = evaluation.evaluation_plugins ?? [];

    return (
        <Paper sx={{p: 2, mb: 1}} variant="outlined">
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <HourglassTopIcon color="action" fontSize="small" />
                    <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
                        {evaluation.pid}
                    </Typography>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ml: 'auto'}}
                    >
                        {evaluation.status}
                    </Typography>
                </Stack>

                {plugins.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                        No plugins attached.
                    </Typography>
                )}

                {plugins.map((plugin) => {
                    const ps = statuses[plugin.name];
                    const pct = ps ? Math.round((ps.progress ?? 0) * 100) : 0;
                    const phase =
                        (ps?.extra as {phase?: string} | undefined)?.phase ??
                        (ps ? 'running' : 'queued');
                    return (
                        <Box key={plugin.pid}>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <Tooltip title={redactConfig(plugin.plugin_config)}>
                                    <Typography variant="body2">
                                        {plugin.name}
                                    </Typography>
                                </Tooltip>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {phase} · {ps ? `${pct}%` : '—'}
                                </Typography>
                            </Stack>
                            <LinearProgress
                                variant={ps ? 'determinate' : 'indeterminate'}
                                value={pct}
                                sx={{mt: 0.5, height: 6, borderRadius: 1}}
                            />
                        </Box>
                    );
                })}
            </Stack>
        </Paper>
    );
}

export default function EvaluationProgressList({
    projectUUID,
}: {
    projectUUID: string;
}) {
    const pendingQuery = useQuery({
        queryKey: ['evaluations', projectUUID, 'Pending'],
        queryFn: () => fetchEvalsByStatus(projectUUID, 'Pending'),
        enabled: Boolean(projectUUID),
        refetchInterval: 5000,
    });
    const processingQuery = useQuery({
        queryKey: ['evaluations', projectUUID, 'Processing'],
        queryFn: () => fetchEvalsByStatus(projectUUID, 'Processing'),
        enabled: Boolean(projectUUID),
        refetchInterval: 5000,
    });

    const evaluations: Evaluation[] = [
        ...(pendingQuery.data ?? []),
        ...(processingQuery.data ?? []),
    ].sort((a, b) => a.pid.localeCompare(b.pid));

    if (evaluations.length === 0) return null;

    return (
        <Box sx={{mb: 3}}>
            <Typography component="h2" variant="h5" gutterBottom>
                In-Progress Evaluations ({evaluations.length})
            </Typography>
            {evaluations.map((ev) => (
                <EvalProgressRow key={ev.pid} evaluation={ev} />
            ))}
        </Box>
    );
}
