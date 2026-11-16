import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
  Paper,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import SideDrawer from '../components/SideDrawer';
import './CeleryTasks.css';

interface FlowerTaskSummary {
  uuid: string;
  state: string;
  name: string;
  args: string;
  kwargs: string;
  worker: string;
  received: number | null;
  started: number | null;
  succeeded: number | null;
  runtime: number | null;
  retries: number | null;
  queue: string | null;
  exception: string | null;
  raw?: Record<string, unknown>;
}

// The running Flower, like its /tasks page (same underlying JSON API).
const FLOWER_BASE = (import.meta.env.VITE_FLOWER_URL as string | undefined)?.replace(/\/$/, '') || '/flower';

type ColumnId =
  | 'name'
  | 'uuid'
  | 'state'
  | 'worker'
  | 'received'
  | 'started'
  | 'runtime';

const initialWidths: Record<ColumnId, number> = {
  name: 300,
  uuid: 220,
  state: 120,
  worker: 160,
  received: 190,
  started: 190,
  runtime: 150,
};

function formatUnix(ts: number | null): string {
  if (!ts) return '—';

  return new Date(ts * 1000).toLocaleString();
}

function formatRuntime(sec: number | null): string {
  if (!sec && sec !== 0) return '—';

  const s = Math.floor(sec);

  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function stateChipColor(state: string) {
  switch (state?.toLowerCase()) {
    case 'pending':
      return 'warning';

    case 'started':
      return 'info';

    case 'success':
      return 'success';

    case 'failure':
      return 'error';

    case 'retry':
      return 'secondary';

    default:
      return 'default';
  }
}

function formatDetailValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function DetailTable({
  data,
}: {
  data: Record<string, any>;
}) {
  const entries = Object.entries(data).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined,
  );

  if (entries.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
      >
        No details available.
      </Typography>
    );
  }

  return (
    <Box className="detail-sections">
      {entries.map(([key, value]) => {
        const formattedValue =
          formatDetailValue(value);

        return (
          <Box
            key={key}
            className="detail-section"
          >
            <Typography
              component="div"
              className="detail-section-key"
            >
              {key}
            </Typography>

            <Box
              className="detail-section-value"
            >
              {formattedValue}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function CeleryTasks() {
  const [tasks, setTasks] =
    useState<FlowerTaskSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [stateFilter, setStateFilter] =
    useState<string>('ALL');

  const [selectedUuid, setSelectedUuid] =
    useState<string | null>(null);

  const [selectedTaskName, setSelectedTaskName] =
    useState<string | null>(null);

  const [detail, setDetail] =
    useState<Record<string, any> | null>(
      null,
    );

  const [detailLoading, setDetailLoading] =
    useState(false);

  /*
   * Fetch this project's tasks from the backend door (re-pointed off Flower:
   * the backend lists the project's own celery tasks, never the whole queue).
   */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FLOWER_BASE}/api/tasks`);
      if (!res.ok) throw new Error(`Flower API error ${res.status}`);
      const data = await res.json();
      const list: FlowerTaskSummary[] = Object.entries(
        data as Record<string, Record<string, unknown>>,
      ).map(([uuid, t]) => ({
        uuid,
        state: String(t?.state ?? '—'),
        name: String(t?.name ?? '—'),
        args: typeof t?.args === 'string' ? String(t.args) : JSON.stringify(t?.args ?? ''),
        kwargs: typeof t?.kwargs === 'string' ? String(t.kwargs) : JSON.stringify(t?.kwargs ?? ''),
        worker: String(t?.worker ?? ''),
        received: (t?.received as number | null) ?? null,
        started: (t?.started as number | null) ?? null,
        succeeded: (t?.succeeded as number | null) ?? null,
        runtime: (t?.runtime as number | null) ?? null,
        retries: (t?.retries as number | null) ?? null,
        queue: t?.queue ? String(t.queue) : null,
        exception: t?.exception ? String(t.exception) : null,
        raw: t ?? {},
      }));
      setTasks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Initial load; the user refreshes explicitly (Flower-style but manual).
   */
  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  /*
   * Open task details (the drawer shows the Flower task detail).
   */
  const openDetail = async (uuid: string, name: string) => {
    setSelectedUuid(uuid);
    setSelectedTaskName(name);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`${FLOWER_BASE}/api/task/info/${uuid}`);
      if (!res.ok) throw new Error(`Task detail error ${res.status}`);
      const info = (await res.json()) as Record<string, unknown>;
      setDetail(info);
    } catch (e) {
      setDetail({
        error: e instanceof Error ? e.message : 'Failed to load task detail',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  /*
   * Close details drawer.
   */
  const closeDetail = () => {
    setSelectedUuid(null);
    setSelectedTaskName(null);
    setDetail(null);
  };

  /*
   * Data Grid columns.
   */
  const columns: GridColDef<FlowerTaskSummary>[] =
    [
      {
        field: 'name',
        headerName: 'Name',
        width: initialWidths.name,
        minWidth: 150,
        resizable: true,
      },

      {
        field: 'uuid',
        headerName: 'UUID',
        width: initialWidths.uuid,
        minWidth: 180,
        resizable: true,

        renderCell: (
          params: GridRenderCellParams<
            FlowerTaskSummary,
            string
          >,
        ) => {
          const uuid = params.value ?? '';
          const name = params.row.name;

          return (
            <button
              className="tasks-uuid-btn"
              onClick={() =>
                openDetail(uuid, name)
              }
            >
              {uuid}
            </button>
          );
        },
      },

      {
        field: 'state',
        headerName: 'State',
        width: initialWidths.state,
        minWidth: 100,
        resizable: true,

        renderCell: (
          params: GridRenderCellParams<
            FlowerTaskSummary,
            string
          >,
        ) => {
          const state = params.value ?? '';

          return (
            <Chip
              label={state}
              size="small"
              color={
                stateChipColor(
                  state,
                ) as any
              }
            />
          );
        },
      },

      {
        field: 'worker',
        headerName: 'Worker',
        width: initialWidths.worker,
        minWidth: 120,
        resizable: true,
      },

      {
        field: 'received',
        headerName: 'Received',
        width:
          initialWidths.received,
        minWidth: 150,
        resizable: true,

        valueGetter: (
          _value,
          row,
        ) =>
          formatUnix(
            row.received,
          ),
      },

      {
        field: 'started',
        headerName: 'Started',
        width:
          initialWidths.started,
        minWidth: 150,
        resizable: true,

        valueGetter: (
          _value,
          row,
        ) =>
          formatUnix(
            row.started,
          ),
      },

      {
        field: 'runtime',
        headerName: 'Runtime',

        width:
          initialWidths.runtime,

        minWidth: 100,

        resizable: true,

        /*
         * Runtime fills remaining available space.
         *
         * Remove this if you want all columns to have
         * completely independent fixed widths.
         */
        flex: 1,

        valueGetter: (
          _value,
          row,
        ) =>
          formatRuntime(
            row.runtime,
          ),
      },
    ];

  const upper = (s?: string | null) => (s ?? '').toUpperCase();
  const filteredTasks =
    stateFilter === 'ALL' ? tasks : tasks.filter((t) => upper(t.state) === stateFilter);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <Box className="page-header">
        <Typography
          variant="h4"
          className="page-header-title"
        >
          Celery Tasks
        </Typography>

        <Box className="page-header-controls">
          <Select
            size="small"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            aria-label="Filter by state"
            sx={{ minWidth: 140, bgcolor: 'background.paper' }}
          >
            <MenuItem value="ALL">All states</MenuItem>
            {['PENDING', 'RECEIVED', 'STARTED', 'SUCCESS', 'FAILURE', 'RETRY'].map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>

          <Button
            variant="contained"
            startIcon={
              <RefreshIcon />
            }
            onClick={fetchTasks}
            disabled={loading}
            className="gradient-btn"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {loading && (
        <Box className="tasks-loading">
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box className="tasks-error">
          {error}
        </Box>
      )}

      {!loading && !error && (
        <Paper
          elevation={0}
          className="tasks-grid-paper"
        >
          <DataGrid
            rows={filteredTasks}
            columns={columns}
            getRowId={row => row.uuid}
            disableRowSelectionOnClick
            autoHeight
            loading={loading}
            onRowClick={(params) => openDetail(params.row.uuid, params.row.name)}
            pageSizeOptions={[
              10,
              25,
              50,
              100,
            ]}
            initialState={{
              pagination: {
                paginationModel: {
                  pageSize: 25,
                  page: 0,
                },
              },
            }}
            className="app-data-grid"
          />
        </Paper>
      )}

      <SideDrawer
        open={!!selectedUuid}
        onClose={closeDetail}
        title={selectedTaskName || 'Task details'}
        mode="view"
      >
        {detailLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!detailLoading && detail?.error && (
          <Typography color="error">{detail.error}</Typography>
        )}

        {!detailLoading && detail && !detail.error && <DetailTable data={detail} />}
      </SideDrawer>
    </Box>
  );
}
