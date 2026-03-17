import React from 'react';
import Box from '@mui/material/Box';
import {
    DataGrid,
    GridColDef,
    GridToolbarContainer,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarDensitySelector,
    GridToolbarExport
} from '@mui/x-data-grid';
import Papa from 'papaparse';
import { Measurement } from '../../models/models.tsx';
import { CircularProgress, Alert, AlertTitle, Checkbox, FormControlLabel } from "@mui/material";
import { API_VERSION_PREFIX } from '../../config';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface CsvDataByDescriptionGridProps {
    title?: string;
    data: Measurement[];
}

type CsvRow = Record<string, unknown> & { id: string | number };

// ---- Style injector for cell coloring ----
const CssInjector = () => (
    <style>{`
        .cell-negative {
            background-color: #F8C471 !important;
            color: black !important;
        }
        .cell-positive {
            background-color: #2196f3 !important;
            color: white !important;
        }
    `}</style>
);

// ---- Cell coloring helper ----
function getCellClassName(params: any, enableCellColors: boolean) {
    if (!enableCellColors) return '';

    let change: number | null = null;

    // Handle number case
    if (typeof params.value === 'number') {
        change = params.value;
    }

    // Handle string case: "value (change)"
    if (typeof params.value === 'string') {
        const match = params.value.match(/\(([^)]+)\)/); // Extract content inside parentheses
        if (match) {
            const str = match[1].replace(/[^\d.-]+/g, ''); // Remove non-number chars (except . and -)
            change = Number(str);
        }
    }

    if (change === null || isNaN(change)) return '';
    if (change < 0) return 'cell-negative';
    if (change > 0) return 'cell-positive';
    return '';
}

// ---- Toolbar with coloring toggle ----
function CustomToolbar(props: any) {
    const { cellColorsEnabled, setCellColorsEnabled } = props;
    return (
        <GridToolbarContainer>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            <GridToolbarDensitySelector />
            <Box sx={{ flexGrow: 1 }} />
            <FormControlLabel
                control={
                    <Checkbox
                        size="small"
                        checked={!!cellColorsEnabled}
                        onChange={e => setCellColorsEnabled?.(e.target.checked)}
                    />
                }
                label="Enable cell coloring"
                sx={{ ml: 2 }}
            />
            <GridToolbarExport />
        </GridToolbarContainer>
    );
}

/** ---- Child: grid for a single dataset PID ---- */
function CsvGridForPid({ datasetPid, title: _title }: { datasetPid: string; title?: string; }) {
    const [columns, setColumns] = React.useState<GridColDef[]>([]);
    const [rows, setRows] = React.useState<CsvRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [cellColorsEnabled, setCellColorsEnabled] = React.useState(true);

    React.useEffect(() => {
        if (!datasetPid) {
            setColumns([]);
            setRows([]);
            setError(null);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);

            try {
                const url = `${API_URL}/datasets/${datasetPid}/data`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Failed to fetch CSV (status ${response.status})`);
                }

                // Read as text and strip UTF-8 BOM if present
                const raw = await response.text();
                const csvString = raw.replace(/^\uFEFF/, "");

                const result: Papa.ParseResult<Record<string, unknown>> = Papa.parse(csvString, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    transformHeader: (h: string) => h.trim(),
                });

                if (cancelled) return;

                if (result.errors?.length) {
                    const aggregated = result.errors.map((e: Papa.ParseError) => e.message).join("; ");
                    throw new Error(aggregated || "Unknown CSV parse error");
                }

                const fields: string[] = result.meta.fields ?? [];
                if (!fields.length) {
                    throw new Error("CSV appears to have no header row or no columns could be detected.");
                }

                const parsedData: Record<string, unknown>[] = (result.data as Record<string, unknown>[]) ?? [];

                // Preserve existing 'id' if present; else add incremental id
                const withIds: CsvRow[] = parsedData.map((row, idx) => {
                    const hasOwnId =
                        Object.prototype.hasOwnProperty.call(row, "id") &&
                            (row as Record<string, unknown>)["id"] !== undefined &&
                            (row as Record<string, unknown>)["id"] !== null &&
                            (row as Record<string, unknown>)["id"] !== "";
                    return hasOwnId ? (row as CsvRow) : ({ id: idx, ...row } as CsvRow);
                });

                // Add cellClassName for all columns (only shades numeric cells)
                const parsedColumns: GridColDef[] = fields.map((field: string) => ({
                    field,
                    headerName: field,
                    // flex: 1,
                    minWidth: 120,
                    cellClassName: (params: any) => getCellClassName(params, cellColorsEnabled),
                }));

                if (cancelled) return;
                setColumns(parsedColumns);
                setRows(withIds);
            } catch (e: unknown) {
                if (cancelled || (e instanceof DOMException && e.name === "AbortError")) {
                    return;
                }
                const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
                setError(msg);
                setColumns([]);
                setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [datasetPid, cellColorsEnabled]);

    return (
        <Box sx={{ my: 3 }}>
            {cellColorsEnabled && <CssInjector />}
            {loading && (
                <Box sx={{ my: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <CircularProgress />
                    <Box mt={2}><span>Loading CSV…</span></Box>
                </Box>
            )}

            {!loading && error && (
                <Alert severity="error" sx={{ my: 2 }}>
                    <AlertTitle>Error loading CSV</AlertTitle>
                    {error}
                </Alert>
            )}

            {!loading && !error && (
                <Box sx={{ height: 500, width: '100%' }}>
                    <DataGrid
                        columns={columns}
                        rows={rows}
                        slots={{
                            toolbar: CustomToolbar
                        }}
                        slotProps={{
                            toolbar: {
                                cellColorsEnabled,
                                setCellColorsEnabled
                            } as any
                        }}
                        showToolbar
                        autosizeOnMount
                    />
                </Box>
            )}
        </Box>
    );
}

/** ---- Parent: render one grid per unique description ---- */
export const CsvDatasetGridByMeasurement = ({
    title: _title,
    data
}: CsvDataByDescriptionGridProps) => {
    const descriptions = React.useMemo(() => {
        const list = (data ?? [])
        .map((m) => m?.description?.trim())
        .filter((d): d is string => !!d && d.length > 0);
        return Array.from(new Set(list));
    }, [data]);

    if (!descriptions.length) {
        return <Box>No dataset PIDs found in measurements' descriptions.</Box>;
    }

    return (
        <Box>
            {descriptions.map((pid) => (
                <CsvGridForPid key={pid} datasetPid={pid} title={pid} />
            ))}
        </Box>
    );
};

export default CsvDatasetGridByMeasurement;
