/**
 * LogsPanel — the "Project logs" content (full page + side drawer).
 *
 * Fetches THIS project's immutable audit-ledger events
 * (`/projects/{pid}/logs`) and shows them in a DataGrid (same style as the
 * celery-tasks page). Clicking an ID opens the event's full metadata in a
 * side drawer.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {
    DataGrid,
    type GridColDef,
    type GridRenderCellParams,
    type GridRowSelectionModel,
} from '@mui/x-data-grid';
import { API_VERSION_PREFIX } from '../config';
import SideDrawer from './SideDrawer';

export interface LogsPanelHandle {
    refresh: () => void;
}

interface LedgerEvent {
    id?: string | number;
    occurred_at?: string;
    actor?: string;
    action?: string;
    resource_type?: string;
    resource_id?: string | null;
    source_app?: string;
    outcome?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

function outcomeColor(outcome?: string): 'success' | 'error' | 'default' {
    if (!outcome) return 'default';
    if (outcome === 'ok') return 'success';
    if (outcome === 'failed') return 'error';
    return 'default';
}

function formatTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function DetailTable({ data }: { data: LedgerEvent }) {
    const entries = Object.entries(data).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
    );
    if (entries.length === 0) {
        return <Typography color="text.secondary">No details available.</Typography>;
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {entries.map(([key, value]) => (
                <Box key={key}>
                    <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, textTransform: 'capitalize', color: 'text.secondary' }}
                    >
                        {key}
                    </Typography>
                    <Box
                        sx={{
                            mt: 0.25,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: 'grey.50',
                            border: '1px solid #e5e7eb',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: key === 'metadata' ? 'monospace' : 'inherit',
                        }}
                    >
                        {formatValue(value)}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

const LogsPanel = forwardRef<LogsPanelHandle, { pid: string }>(function LogsPanel({ pid }, ref) {
    const [events, setEvents] = useState<LedgerEvent[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<LedgerEvent | null>(null);
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects/${pid}/logs`);
            const data = await res.json();
            if (!mountedRef.current) return;
            setEvents(data?.events ?? []);
        } catch {
            if (!mountedRef.current) return;
            setEvents([]);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [pid]);

    useImperativeHandle(ref, () => ({ refresh }));

    useEffect(() => {
        mountedRef.current = true;
        void refresh();
        return () => {
            mountedRef.current = false;
        };
    }, [refresh]);

    const rows = (events ?? []).map((e, i) => ({ ...e, __idx: `${e.id ?? 'r'}-${i}` }));

    const showId = rows.some((r) => r.id !== undefined && r.id !== null && r.id !== '');

    const columns: GridColDef<(typeof rows)[number]>[] = [
        ...(showId
            ? [
                  {
                      field: 'id',
                      headerName: 'ID',
                      width: 110,
                      resizable: true,
                      renderCell: (params: GridRenderCellParams<(typeof rows)[number]>) => (
                          <button
                              className="tasks-uuid-btn"
                              onClick={() => setSelected(params.row as LedgerEvent)}
                          >
                              {String(params.row.id)}
                          </button>
                      ),
                  },
              ]
            : []),
        {
            field: 'occurred_at',
            headerName: 'Time',
            width: 170,
            resizable: true,
            valueGetter: (_value, row) => formatTime(row.occurred_at),
        },
        {
            field: 'actor',
            headerName: 'Actor',
            width: 160,
            resizable: true,
            valueGetter: (_value, row) => row.actor ?? 'unknown',
        },
        { field: 'action', headerName: 'Action', width: 160, resizable: true },
        {
            field: 'resource',
            headerName: 'Resource',
            width: 200,
            resizable: true,
            valueGetter: (_value, row) =>
                row.resource_type && row.resource_id
                    ? `${row.resource_type}:${row.resource_id}`
                    : row.resource_type ?? '—',
        },
        {
            field: 'outcome',
            headerName: 'Outcome',
            width: 120,
            resizable: true,
            renderCell: (params: GridRenderCellParams<(typeof rows)[number]>) => (
                <Chip label={params.row.outcome ?? 'ok'} size="small" color={outcomeColor(params.row.outcome)} />
            ),
        },
        {
            field: 'source_app',
            headerName: 'Source',
            width: 130,
            resizable: true,
            valueGetter: (_value, row) => row.source_app ?? '—',
        },
        {
            field: 'summary',
            headerName: 'Summary',
            flex: 1,
            minWidth: 240,
            resizable: true,
            valueGetter: (_value, row) => row.summary || '—',
        },
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : rows.length === 0 ? (
                <Typography color="text.secondary">
                    No ledger events for this project yet.
                </Typography>
            ) : (
                <Paper elevation={0} className="tasks-grid-paper">
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        getRowId={(row) => row.__idx}
                        disableRowSelectionOnClick
                        autoHeight
                        loading={loading}
                        pageSizeOptions={[10, 25, 50, 100]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 25, page: 0 } },
                        }}
                        onRowClick={(params) => setSelected(params.row as LedgerEvent)}
                        onRowSelectionModelChange={(_model: GridRowSelectionModel) => undefined}
                        className="app-data-grid"
                    />
                </Paper>
            )}

            <SideDrawer
                open={selected !== null}
                onClose={() => setSelected(null)}
                title={selected?.summary || 'Audit event'}
                mode="view"
            >
                {selected && <DetailTable data={selected} />}
            </SideDrawer>
        </Box>
    );
});

export default LogsPanel;
