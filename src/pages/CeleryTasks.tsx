import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
  Drawer,
  IconButton,
  Paper,
} from '@mui/material';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import './CeleryTasks.css';

interface FlowerTaskSummary {
  uuid: string;
  state: string;
  name: string;
  args: string;
  received: number | null;
  started: number | null;
  runtime: number | null;
}

type ColumnId =
  | 'name'
  | 'uuid'
  | 'state'
  | 'received'
  | 'started'
  | 'runtime';

const initialWidths: Record<ColumnId, number> = {
  name: 300,
  uuid: 220,
  state: 120,
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

type DrawerResizeState = {
  resizing: boolean;
  startX: number;
  startWidth: number;
};

export default function CeleryTasks() {
  const [tasks, setTasks] =
    useState<FlowerTaskSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

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
   * Drawer starts at 50vw.
   *
   * We store pixels because the user can resize it
   * interactively.
   */
  const [drawerWidth, setDrawerWidth] =
    useState(() =>
      typeof window !== 'undefined'
        ? window.innerWidth * 0.5
        : 700,
    );

  const drawerResizeRef =
    useRef<DrawerResizeState>({
      resizing: false,
      startX: 0,
      startWidth: 0,
    });

  /*
   * Keep drawer width inside the 40vw - 80vw range
   * when the browser itself is resized.
   */
  const constrainDrawerWidth =
    useCallback(() => {
      if (typeof window === 'undefined') {
        return;
      }

      const minWidth =
        window.innerWidth * 0.4;

      const maxWidth =
        window.innerWidth * 0.8;

      setDrawerWidth(prev =>
        Math.min(
          maxWidth,
          Math.max(minWidth, prev),
        ),
      );
    }, []);

  /*
   * Handle browser resize.
   */
  useEffect(() => {
    window.addEventListener(
      'resize',
      constrainDrawerWidth,
    );

    return () => {
      window.removeEventListener(
        'resize',
        constrainDrawerWidth,
      );
    };
  }, [constrainDrawerWidth]);

  /*
   * Drawer resize.
   *
   * The drawer is anchored to the right:
   *
   *   mouse moves LEFT  -> drawer gets wider
   *   mouse moves RIGHT -> drawer gets narrower
   */
  const handleDrawerResize =
    useCallback((event: MouseEvent) => {
      if (
        !drawerResizeRef.current.resizing
      ) {
        return;
      }

      if (typeof window === 'undefined') {
        return;
      }

      const diff =
        drawerResizeRef.current.startX -
        event.clientX;

      const newWidth =
        drawerResizeRef.current.startWidth +
        diff;

      const minWidth =
        window.innerWidth * 0.4;

      const maxWidth =
        window.innerWidth * 0.8;

      const clampedWidth =
        Math.min(
          maxWidth,
          Math.max(minWidth, newWidth),
        );

      setDrawerWidth(clampedWidth);
    }, []);

  /*
   * Finish drawer resizing.
   */
  const stopDrawerResize =
    useCallback(() => {
      drawerResizeRef.current = {
        resizing: false,
        startX: 0,
        startWidth: 0,
      };

      document.removeEventListener(
        'mousemove',
        handleDrawerResize,
      );

      document.removeEventListener(
        'mouseup',
        stopDrawerResize,
      );

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }, [handleDrawerResize]);

  /*
   * Start drawer resizing.
   */
  const startDrawerResize = (
    event: ReactMouseEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    drawerResizeRef.current = {
      resizing: true,
      startX: event.clientX,
      startWidth: drawerWidth,
    };

    document.body.style.cursor =
      'col-resize';

    document.body.style.userSelect =
      'none';

    document.addEventListener(
      'mousemove',
      handleDrawerResize,
    );

    document.addEventListener(
      'mouseup',
      stopDrawerResize,
    );
  };

  /*
   * Cleanup drawer listeners.
   */
  useEffect(() => {
    return () => {
      document.removeEventListener(
        'mousemove',
        handleDrawerResize,
      );

      document.removeEventListener(
        'mouseup',
        stopDrawerResize,
      );

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [
    handleDrawerResize,
    stopDrawerResize,
  ]);

  /*
   * Fetch tasks from Flower.
   */
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        '/flower/api/tasks',
      );

      if (!res.ok) {
        throw new Error(
          `Flower API error ${res.status}`,
        );
      }

      const data = await res.json();

      const list: FlowerTaskSummary[] =
        Object.entries(data).map(
          ([uuid, task]: [string, any]) => ({
            uuid,
            state: task.state ?? '—',
            name: task.name ?? '—',

            args:
              typeof task.args === 'string'
                ? task.args
                : JSON.stringify(
                    task.args ?? '',
                  ),

            received:
              task.received ?? null,

            started:
              task.started ?? null,

            runtime:
              task.runtime ?? null,
          }),
        );

      setTasks(list);
    } catch (e: any) {
      setError(
        e.message ||
          'Failed to load tasks',
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Initial load.
   */
  useEffect(() => {
    fetchTasks();
  }, []);

  /*
   * Open task details.
   */
  const openDetail = async (
    uuid: string,
    name: string,
  ) => {
    setSelectedUuid(uuid);
    setSelectedTaskName(name);
    setDetailLoading(true);
    setDetail(null);

    try {
      const res = await fetch(
        `/flower/api/task/info/${uuid}`,
      );

      if (!res.ok) {
        throw new Error(
          `Task detail error ${res.status}`,
        );
      }

      setDetail(await res.json());
    } catch (e) {
      setDetail({
        error: (e as Error).message,
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

  return (
    <Box>
      <Box className="tasks-header">
        <Typography
          component="h2"
          variant="h4"
          gutterBottom
        >
          Celery Tasks
        </Typography>

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
            rows={tasks}
            columns={columns}
            getRowId={row => row.uuid}
            disableRowSelectionOnClick
            autoHeight
            loading={loading}
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
            sx={{
              border: 0,

              '& .MuiDataGrid-cell': {
                whiteSpace:
                  'nowrap',
                overflow:
                  'hidden',
                textOverflow:
                  'ellipsis',
              },

              '& .MuiDataGrid-columnHeader': {
                fontWeight: 700,
              },

              '& .MuiDataGrid-columnHeaderTitle':
                {
                  fontWeight: 700,
                },

              '& .MuiDataGrid-cell:focus':
                {
                  outline: 'none',
                },

              '& .MuiDataGrid-cell:focus-within':
                {
                  outline: 'none',
                },
            }}
          />
        </Paper>
      )}

      <Drawer
        anchor="right"
        open={!!selectedUuid}
        onClose={closeDetail}
        PaperProps={{
          className: 'celery-drawer-paper',
          style: {
            width: drawerWidth,
          },
        }}
      >
        <Box
          className="drawer-resize-handle"
          onMouseDown={startDrawerResize}
        />

        <Box className="drawer-header">
          <Typography
            variant="h5"
            className="drawer-title drawer-title-highlight"
            noWrap
            title={selectedTaskName || ''}
          >
            {selectedTaskName || 'Task details'}
          </Typography>

          <IconButton onClick={closeDetail}>
          <CloseIcon />
          </IconButton>
        </Box>

        <Box className="drawer-content">
          {detailLoading && (
            <Box className="drawer-loading">
              <CircularProgress />
            </Box>
          )}

          {!detailLoading &&
            detail?.error && (
              <Typography color="error">
                {detail.error}
              </Typography>
          )}

          {!detailLoading &&
            detail &&
            !detail.error && (
              <DetailTable data={detail} />
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
