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
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface AuditEvent {
    id: number;
    timestamp: string;
    event_type: string;
    evaluation_id: string;
    task_id: string;
    plugin_name: string;
    status: string;
    duration_ms: number;
    details: Record<string, any> | null;
    error_message: string;
    verified: boolean;
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

const getLatestEvaluation = async (projectUUID: string) => {
    const res = await fetch(`${API_URL}/projects/${projectUUID}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Failed to fetch evaluations');
    const evaluations = await res.json();
    return evaluations.length > 0 ? evaluations[0] : null;
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
                    {(event.details || event.error_message) && (
                        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    )}
                </TableCell>
            </TableRow>
            {(event.details || event.error_message) && (
                <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, border: expanded ? undefined : 'none' }}>
                        <Collapse in={expanded}>
                            <Box sx={{ p: 2 }}>
                                {event.error_message && (
                                    <Alert severity="error" sx={{ mb: 1 }}>
                                        {event.error_message}
                                    </Alert>
                                )}
                                {event.details && (
                                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                                        <Typography variant="caption" color="text.secondary">Details</Typography>
                                        <pre style={{ margin: 0, fontSize: '0.8rem', overflow: 'auto' }}>
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

    const { data: latestEval, isPending: evalPending, error: evalError } = useQuery({
        queryKey: ['latestEvaluation', projectUUID],
        queryFn: () => getLatestEvaluation(projectUUID ?? ''),
        enabled: !!projectUUID,
    });

    const { data: auditEvents, isPending: auditPending, error: auditError } = useQuery({
        queryKey: ['auditEvents', latestEval?.pid],
        queryFn: () => getEvaluationAuditEvents(latestEval.pid),
        enabled: !!latestEval?.pid,
    });

    if (evalPending || auditPending) return <CircularProgress />;
    if (evalError) return <Alert severity="error">Failed to load evaluations: {evalError.message}</Alert>;
    if (!latestEval) return <Alert severity="info">No completed evaluations found for this project.</Alert>;
    if (auditError) return <Alert severity="error">Failed to load audit logs: {auditError.message}</Alert>;

    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Audit Logs
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Last completed evaluation: <strong>{latestEval.pid}</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                {auditEvents?.length ?? 0} events recorded — click the shield icon to cryptographically verify each entry
            </Typography>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Timestamp</TableCell>
                            <TableCell>Event</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Plugin</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Verified</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {auditEvents && auditEvents.map((event) => (
                            <AuditEventRow key={event.id} event={event} />
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}

export default AuditLogs;
