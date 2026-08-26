import Box from '@mui/material/Box';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {Measurement} from "../../models/models.tsx";
import {formatDate, formatFloatTo3Decimals, getColorFromString} from "../../util/util.ts";
import { Chip, Stack, Tooltip, Typography } from "@mui/material";

const columns: GridColDef[] = [
    {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 140
    },
    {
        field: 'score',
        headerName: 'Score',
        valueGetter: (_value, row) => formatFloatTo3Decimals(row.score),
        flex: 1,
        minWidth: 100,
    },
    {
        field: 'unit',
        headerName: 'Unit',
        flex: 0.6,
        minWidth: 100,
    },
    {
        field: 'time',
        headerName: 'Time',
        valueGetter: (_value, row) => formatDate(row.time),
        flex: 0.5,
        minWidth: 150,
    },
    {
        field: 'description',
        headerName: 'Description',
        flex: 0.5,
        minWidth: 150,
    },
    {
        field: 'error',
        headerName: 'Error',
        type: 'boolean',
        flex: 0.25,
        minWidth: 50,
    },
    {
        field: 'dimensions',
        headerName: 'Dimensions',
        flex: 3,
        minWidth: 300,
        valueGetter: (_value, row) => row.dimensions ? Object.values(row.dimensions).join(",") : "",
        renderCell: (params) => {
            const dimensions = params.row.dimensions;
            if (!dimensions || typeof dimensions !== 'object') return null;

            return (
                <Stack direction="row" spacing={1} sx={{ height: '100%', alignItems: 'center', overflowX: 'auto', overflowY: 'clip' }}>
                    {Object.entries(dimensions).map(([key, value]) => (
                        <Tooltip title={`${key}: ${value}`}>
                        <Chip
                            key={key}
                            label={`${key[0]}: ${value}`}
                            size="small"
                            variant="outlined"
                            style={{backgroundColor: getColorFromString(key)}}
                        />
                        </Tooltip>
                    ))}
                </Stack>
            );
        }
    }
];

interface MeasurementsDataGridProps {
    title?: string;
    description?: string;
    data: Measurement[];
}

export const MeasurementsDataGrid = ({ title, description, data }: MeasurementsDataGridProps) => {
    const rows = data.map((row, index) => ({ ...row, id: index }));

    return (
        <Box>
            {title && (
                <Typography variant="h6" gutterBottom>
                    {title}
                </Typography>
            )}
            {description && (
                <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                    {description}
                </Typography>
            )}
            <Box sx={{ height: 500, width: '100%' }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    showToolbar={true}
                />
            </Box>
        </Box>
    );
}

export default MeasurementsDataGrid;
