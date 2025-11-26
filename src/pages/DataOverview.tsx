// ---------------------------------------------------------------
//  DataFrameViewer.tsx  (copy‑paste into your src folder)
// ---------------------------------------------------------------
import * as React from "react";
import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  Tooltip,
  TableSortLabel,
  IconButton,
} from "@mui/material";
import { FormControl, MenuItem, InputLabel, Select, Chip} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import { data } from "react-router-dom";

/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------- */
type Row = Record<string, unknown>;

interface SortConfig {
  key: string | null;
  direction: "asc" | "desc" | null;
}

interface Dataset {
    name: string;
    pid: string;
    data: string;
}

/* ------------------------------------------------------------------
   Component
------------------------------------------------------------------- */
export default function DataOverview() {
  /* --------------------------- CONFIG --------------------------- */
  const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
  const { projectUUID } = useProject();

  /* --------------------------- STATE --------------------------- */
  const [rawData, setRawData] = React.useState<Row[]>([]);
  const [datasets, setDatasets] = React.useState<Dataset[]>([]);
  const [selectedDatasetPid, setSelectedDatasetPid] = React.useState<string>('');
  const [sortedData, setSortedData] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: null,
    direction: null,
  });


  // Fetch evaluations when project changes
  React.useEffect(() => {
      const fetchDatasets = async () => {
          if (!projectUUID) return;
          try {
              setLoading(true);
              // Get all completed evaluations and filter by project
              const response = await fetch(`${API_URL}/projects/${projectUUID}`);

              if (response.ok) {
                  const responseData = await response.json();
                  const datasets_full: Dataset[] = responseData.datasets;
                  const datasets = datasets_full.filter((dataset) => dataset.data.length > 0 && !(dataset.name.startsWith('artifact')));

                  // Filter evaluations for the selected project

                  // Select the most recent evaluation by default (last in the list)
                  setDatasets(datasets)
                  if (datasets.length > 0) {
                      setSelectedDatasetPid(datasets[datasets.length - 1].pid);
                  } else {
                      setSelectedDatasetPid('');
                  }
              } else {
                  setError('Failed to fetch datasets');
              }
          } catch (error) {
              console.error('Error fetching evaluations:', error);
              setError('Error fetching evaluations');
          } finally {
              setLoading(false);
          }
      };

      fetchDatasets();
  }, [projectUUID]);


  /* --------------------------- FETCH --------------------------- */
  const fetchData = React.useCallback(async () => {
    if (!selectedDatasetPid) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_URL}/datasets/${selectedDatasetPid}/data`
      );

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} – ${resp.statusText}`);
      }

      const arrayBuffer = await resp.arrayBuffer();

      // ----- Load parquet‑wasm -------------------------------------------------
      const parquetMod = await import(
        "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.0/esm/parquet_wasm.js"
      );
      await parquetMod.default(); // initialise WASM runtime

      // ----- Load Arrow -------------------------------------------------------
      const { tableFromIPC } = await import(
        "https://cdn.jsdelivr.net/npm/apache-arrow@14.0.1/+esm"
      );

      // ----- Convert Parquet → Arrow → plain JS -------------------------------
      const wasmTable = parquetMod.readParquet(new Uint8Array(arrayBuffer));
      const ipcBytes = wasmTable.intoIPCStream();
      const arrowTable = tableFromIPC(ipcBytes);

      const rows: Row[] = [];
      for (let i = 0; i < arrowTable.numRows; i++) {
        const row: Row = {};
        arrowTable.schema.fields.forEach((field) => {
          const col = arrowTable.getChild(field.name);
          row[field.name] = col?.get(i);
        });
        rows.push(row);
      }

      // ----- Update state ----------------------------------------------------
      setRawData(rows);
      setSortedData(rows);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [API_URL, selectedDatasetPid]);

  // Load once on mount
  React.useEffect(() => {
    fetchData();
  }, [fetchData, selectedDatasetPid]);

  /* --------------------------- SORTING --------------------------- */
  const columns = React.useMemo(
    () => (sortedData.length > 0 ? Object.keys(sortedData[0]) : []),
    [sortedData]
  );

  const handleSort = (col: string) => {
    // Determine new direction
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === col) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }

    setSortConfig({ key: col, direction });

    if (!direction) {
      // reset
      setSortedData([...rawData]);
      return;
    }

    const sorted = [...sortedData].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];

      // Numbers – numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Fallback – case‑insensitive string comparison
      const aStr = String(aVal ?? "").toLowerCase();
      const bStr = String(bVal ?? "").toLowerCase();

      if (aStr === bStr) return 0;
      return direction === "asc"
        ? aStr < bStr
          ? -1
          : 1
        : aStr > bStr
        ? -1
        : 1;
    });

    setSortedData(sorted);
  };

  const getSortIcon = (col: string) => {
    if (sortConfig.key !== col) return <ArrowUpDown size={16} />;
    if (sortConfig.direction === "asc") return <ArrowUp size={16} />;
    if (sortConfig.direction === "desc") return <ArrowDown size={16} />;
    return <ArrowUpDown size={16} />;
  };

  /* --------------------------- RENDER --------------------------- */
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 4 }}>
      <Container maxWidth="lg">
        {/* ---------- Header ---------- */}
        <Stack spacing={2} mb={3}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography variant="h4" fontWeight="bold">
                Data Overview
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Click on column headers to sort
              </Typography>
            </Stack>
          </Stack>
          <Divider />
        </Stack>


            {/* Selectors Section */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
                <Typography variant="h6" gutterBottom color="primary">
                    Select Dataset
                </Typography>

                <Grid container spacing={3} alignItems="center">


                    <Grid size={6}>
                        <FormControl fullWidth disabled={loading || datasets.length === 0}>
                            <InputLabel id="dataset-select-label">Dataset</InputLabel>
                            <Select
                                labelId="dataset-select-label"
                                value={selectedDatasetPid}
                                label="Dataset"
                                onChange={(e) => setSelectedDatasetPid(e.target.value)}
                            >
                                {datasets.map((dataset, index) => (
                                    <MenuItem key={dataset.name} value={dataset.pid}>
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="body1">
                                                    {dataset.name}
                                                </Typography>
                                                {index === datasets.length - 1 && (
                                                    <Chip label="Latest" size="small" color="primary" />
                                                )}
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">
                                                ID: {dataset.pid}
                                            </Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {loading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                <Typography variant="caption">Loading datasets...</Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>

                {datasets.length === 0 && projectUUID && !loading && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        No completed datasets found for this project.
                    </Alert>
                )}
            </Paper>
        {/* ---------- Loading ---------- */}
        {loading && (
          <Paper
            elevation={3}
            sx={{
              py: 6,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography>Loading your data…</Typography>
          </Paper>
        )}

        {/* ---------- Error ---------- */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>
              <AlertCircle size={16} style={{ verticalAlign: "middle" }} />{" "}
              Error loading data
            </AlertTitle>
            {error}
          </Alert>
        )}

        {/* ---------- Table ---------- */}
        {!loading && !error && sortedData.length > 0 && (
          <Paper elevation={3}>
            {/* Info bar */}
            <Box
              sx={{
                px: 2,
                py: 1,
                bgcolor: "grey.100",
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                <strong>{sortedData.length}</strong> rows ×{" "}
                <strong>{columns.length}</strong> columns
              </Typography>
              {sortConfig.key && (
                <Typography variant="body2" color="text.secondary">
                  Sorted by <code>{sortConfig.key}</code>{" "}
                  {sortConfig.direction === "asc" ? "↑" : "↓"}
                </Typography>
              )}
            </Box>

            {/* Table itself */}
            <TableContainer sx={{ maxHeight: "70vh" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        bgcolor: "background.paper",
                        fontWeight: "bold",
                      }}
                    >
                      #
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        sortDirection={
                          sortConfig.key === col ? sortConfig.direction : false
                        }
                      >
                        <TableSortLabel
                          active={sortConfig.key === col}
                          direction={sortConfig.direction ?? "asc"}
                          hideSortIcon
                          onClick={() => handleSort(col)}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {col}
                            <Tooltip title="Sort">{getSortIcon(col)}</Tooltip>
                          </Box>
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {sortedData.map((row, idx) => (
                    <TableRow
                      key={idx}
                      hover
                      sx={{ "&:last-child td": { border: 0 } }}
                    >
                      <TableCell
                        sx={{
                          position: "sticky",
                          left: 0,
                          bgcolor: "background.paper",
                          fontWeight: "medium",
                        }}
                      >
                        {idx}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col}>
                          <Typography
                            component="span"
                            sx={{ fontFamily: "monospace" }}
                          >
                            {String(row[col])}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* ---------- Empty state ---------- */}
        {!loading && !error && sortedData.length === 0 && (
          <Paper
            elevation={3}
            sx={{
              py: 8,
              textAlign: "center",
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>
              📭
            </Typography>
            <Typography variant="h6" gutterBottom>
              No Data Available
            </Typography>
            <Typography color="text.secondary">
              Try refreshing to load data from your API.
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  );
}