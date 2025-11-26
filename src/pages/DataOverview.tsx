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
    CircularProgress,
    Alert,
    AlertTitle,
    Divider,
} from "@mui/material";
import { FormControl, MenuItem, InputLabel, Select, Chip} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    AlertCircle,
} from "lucide-react";
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import DataFrameTable from '../components/DataFrameTable';


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
  const [datasets, setDatasets] = React.useState<Dataset[]>([]);
  const [selectedDatasetPid, setSelectedDatasetPid] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);


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


  /* --------------------------- RENDER --------------------------- */
  return (
    <Box sx={{ width: 1 }}>
        <Typography component="h2" variant="h4" gutterBottom>
            Data Overview
        </Typography>


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
            <Typography>Loading data…</Typography>
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

        <DataFrameTable dataset_pid={selectedDatasetPid} maxRows={50} />
    </Box>
  );
}