// ---------------------------------------------------------------
//  DataFrameViewer.tsx  (copy‑paste into your src folder)
// ---------------------------------------------------------------
import * as React from "react";
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    AlertTitle,
} from "@mui/material";
import { FormControl, MenuItem, InputLabel, Select, Chip} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    AlertCircle,
} from "lucide-react";
import { API_VERSION_PREFIX } from '../config';
import { useProject } from '../context/ProjectContext';
import CounterFactualDistances from "../components/CounterFactualDistances";
import DataFrameTable from '../components/DataFrameTable';


/* ------------------------------------------------------------------
   Types
------------------------------------------------------------------- */
interface Dataset {
    name: string;
    pid: string;
    data: string;
}
interface Evaluation {
    pid: string;
}


/* ------------------------------------------------------------------
   Component
------------------------------------------------------------------- */
export default function CounterFactualPage() {
    /* --------------------------- CONFIG --------------------------- */
    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
    const { projectUUID } = useProject();

    /* --------------------------- STATE --------------------------- */
    const [evaluations, setEvaluations] = React.useState<Evaluation[]>([]);
    const [selectedEvaluationPid, setSelectedEvaluationPid] = React.useState<string>('');
    const [datasets, setDatasets] = React.useState<Dataset[]>([]);
    const [selectedDatasetPid, setSelectedDatasetPid] = React.useState<string>('');
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);


    // Fetch evaluations when project changes
    React.useEffect(() => {
        const fetchEvaluations = async () => {
            if (!projectUUID) return;
            try {
                setLoading(true);
                // Get all completed evaluations and filter by project
                const response = await fetch(`${API_URL}/projects/${projectUUID}/evaluations?status=Done`);

                if (response.ok) {
                    const evaluations: Evaluation[] = await response.json();
                    // Filter evaluations for the selected project

                    // Select the most recent evaluation by default (last in the list)
                    setEvaluations(evaluations)
                    if (evaluations.length > 0) {
                        setSelectedEvaluationPid(evaluations[evaluations.length - 1].pid);
                    } else {
                        setSelectedEvaluationPid('');
                    }
                } else {
                    setError('Failed to fetch evaluations');
                }
            } catch (error) {
                console.error('Error fetching evaluations:', error);
                setError('Error fetching evaluations');
            } finally {
                setLoading(false);
            }
        };

        fetchEvaluations();
    }, [projectUUID]);
    


    // Fetch evaluations when project changes
    React.useEffect(() => {
        const fetchDatasets = async () => {
            if (!projectUUID) return;
            if (!selectedEvaluationPid) return;
            try {
                setLoading(true);
                // Get all completed evaluations and filter by project
                const response = await fetch(`${API_URL}/projects/${projectUUID}`);

                if (response.ok) {
                    const prefix = `artifact/${selectedEvaluationPid}/counter_factual`;
                    const responseData = await response.json();
                    const datasets_full: Dataset[] = responseData.datasets;
                    const datasets = datasets_full
                        .filter((dataset) => dataset.data.length > 0 && dataset.name.startsWith(prefix))
                        .map(d => ({ ...d, name: d.name.replace(new RegExp(`^${prefix}`), ""), }))
                    ;
                    console.log("prefix:", prefix);

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
    }, [projectUUID, selectedEvaluationPid]);


  /* --------------------------- RENDER --------------------------- */
  return (
    <Box sx={{ width: 1 }}>
        <Typography component="h2" variant="h4" gutterBottom>
            Overview
        </Typography>

        {/* Selectors Section */}
        <Paper elevation={2} sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
            {/* Selectors Evaluation */}
            <Typography variant="h6" gutterBottom color="primary">
                Select Evaluation and corresponding Dataset
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    {/* Evaluation Selector */}
                    <FormControl fullWidth disabled={loading || evaluations.length === 0}>
                        <InputLabel id="evaluation-select-label">Evaluation</InputLabel>
                        <Select
                            labelId="evaluation-select-label"
                            value={selectedEvaluationPid}
                            label="Evaluation"
                            onChange={(e) => setSelectedEvaluationPid(e.target.value)}
                        >
                            {evaluations.map((evaluation, index) => (
                                <MenuItem key={evaluation.pid} value={evaluation.pid}>
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1">
                                                Evaluation #{index + 1}
                                            </Typography>
                                            {index === evaluations.length - 1 && (
                                                <Chip label="Latest" size="small" color="primary" />
                                            )}
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            ID: {evaluation.pid}
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

            </Grid>

            {evaluations.length === 0 && projectUUID && !loading && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    No completed evaluations found for this project.
                </Alert>
            )}

            {datasets.length === 0 && projectUUID && !loading && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    No completed datasets found for this Evaluation.
                </Alert>
            )}
        </Paper>

        {/* Selectors Dataset */}
        {/* <Paper elevation={2} sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>

        </Paper> */}
        {/* ---------- Loading ---------- */}
        {!error && loading && (
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

        <CounterFactualDistances evaluationPid={selectedEvaluationPid} metric="euclidean" numBins={20}/>
        {/* Hard code space... */}
        <div style={{ height: "40px" }} />

        <h3> Counter Factual examples </h3>
        <DataFrameTable dataset_pid={selectedDatasetPid} maxRows={50} />    
    </Box>
  );
}