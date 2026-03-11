import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_VERSION_PREFIX } from '../config.tsx';
import { useProject } from '../context/ProjectContext.tsx';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Collapse,
    Box,
    CircularProgress,
    Alert,
    Tooltip,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import ErrorIcon from '@mui/icons-material/Error';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface AuditEvent {
    id: number;
    timestamp: string;
    event_type: string;
    user_id: number | null;
    evaluation_id: string;
    task_id: string;
    plugin_name: string;
    status: string;
    duration_ms: number;
    details: Record<string, any> | null;
    error_message: string;
    verified: boolean;
    test_set: string;
    configuration: string;
    target_system: string;
    execution_start: string | null;
    execution_end: string | null;
}

interface Evaluation {
    pid: string;
    status: string;
}

const getEvaluationAuditEvents = async (evaluationPid: string): Promise<AuditEvent[]> => {
    const res = await fetch(`${API_URL}/audit/evaluations/${evaluationPid}/events`);
    if (!res.ok) throw new Error('Failed to fetch audit events');
    return await res.json();
};

const getVerifiedEvent = async (eventId: number): Promise<AuditEvent> => {
    const res = await fetch(`${API_URL}/audit/events/${eventId}/verified`);
    if (!res.ok) throw new Error('Verification failed');
    return await res.json();
};

const getAllEvaluations = async (projectUUID: string): Promise<Evaluation[]> => {
    const res = await fetch(`${API_URL}/projects/${projectUUID}/evaluations`);
    if (!res.ok) throw new Error('Failed to fetch evaluations');
    return await res.json();
};

const eventTypeColor = (type: string): 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
    if (type.includes('STARTED')) return 'info';
    if (type.includes('COMPLETED')) return 'success';
    if (type.includes('FAILED')) return 'error';
    if (type.includes('API_CALL')) return 'secondary';
    if (type.includes('MEASUREMENTS')) return 'primary';
    return 'default';
};

const statusColor = (status: string): 'success' | 'error' | 'default' => {
    if (status === 'success') return 'success';
    if (status === 'failure') return 'error';
    return 'default';
};

const evalStatusColor = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
    if (status === 'Done') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'Running' || status === 'Pending') return 'warning';
    return 'info';
};

function AuditEventRow({ event }: { event: AuditEvent }) {
    const [expanded, setExpanded] = useState(false);
    const [verifiedEvent, setVerifiedEvent] = useState<AuditEvent | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const handleVerify = async () => {
        setVerifying(true);
        setVerifyError(null);
        try {
            const result = await getVerifiedEvent(event.id);
            setVerifiedEvent(result);
        } catch (e: any) {
            setVerifyError(e.message);
        } finally {
            setVerifying(false);
        }
    };

    const ts = new Date(event.timestamp);
    const fmtTs = (v: string | null) => v ? new Date(v).toLocaleString() : '-';
    const hasExpandable = event.details || event.error_message || event.test_set || event.configuration || event.execution_start || event.execution_end;

    return (
        <>
            <TableRow hover>
                <TableCell>{event.id}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {ts.toLocaleString()}
                </TableCell>
                <TableCell>
                    <Chip label={event.event_type} color={eventTypeColor(event.event_type)} size="small" />
                </TableCell>
                <TableCell>
                    <Chip label={event.status} color={statusColor(event.status)} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{event.plugin_name || '-'}</TableCell>
                <TableCell>{event.target_system || '-'}</TableCell>
                <TableCell>{event.user_id ?? '-'}</TableCell>
                <TableCell>{event.duration_ms > 0 ? `${event.duration_ms} ms` : '-'}</TableCell>
                <TableCell>
                    {verifying ? (
                        <CircularProgress size={20} />
                    ) : verifiedEvent ? (
                        verifiedEvent.verified ? (
                            <Tooltip title="Cryptographically verified - not tampered">
                                <VerifiedIcon color="success" />
                            </Tooltip>
                        ) : (
                            <Tooltip title="Verification FAILED - possible tampering">
                                <ErrorIcon color="error" />
                            </Tooltip>
                        )
                    ) : verifyError ? (
                        <Tooltip title={verifyError}>
                            <ErrorIcon color="warning" />
                        </Tooltip>
                    ) : (
                        <Tooltip title="Click to verify integrity">
                            <IconButton size="small" onClick={handleVerify}>
                                <VerifiedIcon color="disabled" />
                            </IconButton>
                        </Tooltip>
                    )}
                </TableCell>
                <TableCell>
                    {hasExpandable && (
                        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    )}
                </TableCell>
            </TableRow>
            {hasExpandable && (
                <TableRow>
                    <TableCell colSpan={10} sx={{ py: 0, border: expanded ? undefined : 'none' }}>
                        <Collapse in={expanded}>
                            <Box sx={{ p: 2 }}>
                                {event.error_message && (
                                    <Alert severity="error" sx={{ mb: 1 }}>
                                        {event.error_message}
                                    </Alert>
                                )}
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5, mb: event.details || event.configuration ? 1.5 : 0 }}>
                                    {event.test_set && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Test Set</Typography>
                                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{event.test_set}</Typography>
                                        </Box>
                                    )}
                                    {event.execution_start && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Execution Start</Typography>
                                            <Typography variant="body2">{fmtTs(event.execution_start)}</Typography>
                                        </Box>
                                    )}
                                    {event.execution_end && (
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Execution End</Typography>
                                            <Typography variant="body2">{fmtTs(event.execution_end)}</Typography>
                                        </Box>
                                    )}
                                </Box>
                                {event.configuration && (
                                    <Paper variant="outlined" sx={{ p: 1.5, mb: event.details ? 1.5 : 0 }}>
                                        <Typography variant="caption" color="text.secondary">Configuration</Typography>
                                        <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto', maxHeight: 300 }}>
                                            {(() => { try { return JSON.stringify(JSON.parse(event.configuration), null, 2); } catch { return event.configuration; } })()}
                                        </pre>
                                    </Paper>
                                )}
                                {event.details && (
                                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                                        <Typography variant="caption" color="text.secondary">Details</Typography>
                                        <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto', maxHeight: 300 }}>
                                            {JSON.stringify(event.details, null, 2)}
                                        </pre>
                                    </Paper>
                                )}
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

function AuditLogs() {
    const { projectUUID } = useProject();
    const [selectedEval, setSelectedEval] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('all');

    const { data: evaluations, isPending: evalPending, error: evalError } = useQuery({
        queryKey: ['allEvaluations', projectUUID],
        queryFn: () => getAllEvaluations(projectUUID ?? ''),
        enabled: !!projectUUID,
        refetchInterval: 5000,
    });

    const activeEvalPid = selectedEval ?? (evaluations && evaluations.length > 0 ? evaluations[0].pid : null);
    const activeEval = evaluations?.find((e) => e.pid === activeEvalPid);
    const isRunning = activeEval && activeEval.status !== 'Done' && activeEval.status !== 'failed';

    const { data: auditEvents, isPending: auditPending, error: auditError } = useQuery({
        queryKey: ['auditEvents', activeEvalPid],
        queryFn: () => getEvaluationAuditEvents(activeEvalPid!),
        enabled: !!activeEvalPid,
        refetchInterval: isRunning ? 3000 : false,
    });

    if (evalPending) return <CircularProgress />;
    if (evalError) return <Alert severity="error">Failed to load evaluations: {evalError.message}</Alert>;
    if (!evaluations || evaluations.length === 0) return <Alert severity="info">No evaluations found for this project.</Alert>;

    const filteredEvents = auditEvents?.filter((event) => {
        if (filter === 'all') return true;
        if (filter === 'lifecycle') return !event.event_type.startsWith('API_CALL');
        if (filter === 'api') return event.event_type.startsWith('API_CALL');
        if (filter === 'errors') return event.status === 'failure';
        return true;
    });

    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Audit Logs
            </Typography>

            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                    Evaluation:
                </Typography>
                {evaluations.map((ev) => (
                    <Chip
                        key={ev.pid}
                        label={`${ev.pid.slice(0, 8)}... (${ev.status})`}
                        color={evalStatusColor(ev.status)}
                        variant={ev.pid === activeEvalPid ? 'filled' : 'outlined'}
                        size="small"
                        onClick={() => setSelectedEval(ev.pid)}
                        sx={{ cursor: 'pointer' }}
                    />
                ))}
            </Box>

            {isRunning && (
                <Alert severity="info" sx={{ mb: 2 }} icon={<CircularProgress size={18} />}>
                    Evaluation in progress — logs refresh automatically every 3 seconds
                </Alert>
            )}

            <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <ToggleButtonGroup
                    value={filter}
                    exclusive
                    onChange={(_, v) => v && setFilter(v)}
                    size="small"
                >
                    <ToggleButton value="all">All ({auditEvents?.length ?? 0})</ToggleButton>
                    <ToggleButton value="lifecycle">Lifecycle</ToggleButton>
                    <ToggleButton value="api">API Calls</ToggleButton>
                    <ToggleButton value="errors">Errors</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {auditPending ? (
                <CircularProgress />
            ) : auditError ? (
                <Alert severity="error">Failed to load audit logs: {auditError.message}</Alert>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>Timestamp</TableCell>
                                <TableCell>Event</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Plugin</TableCell>
                                <TableCell>Target System</TableCell>
                                <TableCell>User ID</TableCell>
                                <TableCell>Duration</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredEvents && filteredEvents.map((event) => (
                                <AuditEventRow key={event.id} event={event} />
                            ))}
                            {(!filteredEvents || filteredEvents.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={10} align="center">
                                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                            {isRunning ? 'Waiting for audit events...' : 'No events matching filter'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </>
    );
}

export default AuditLogs;
