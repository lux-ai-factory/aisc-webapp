import Box from '@mui/material/Box';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {Measurement} from "../../models/models.tsx";
import {formatDate, formatFloatTo3Decimals} from "../../util/util.ts";

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
        valueGetter: (value, row) => formatFloatTo3Decimals(row.score),
        flex: 1,
        minWidth: 120,
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
        valueGetter: (value, row) => formatDate(row.time),
        flex: 1,
        minWidth: 160,
    },
    {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        minWidth: 200,
    },
    {
        field: 'error',
        headerName: 'Error',
        type: 'boolean',
        flex: 0.5,
        minWidth: 90,
    }
];

interface MeasurementsDataGridProps {
    title?: string;
    data: Measurement[];
}

export const MeasurementsDataGrid = ({ title, data }: MeasurementsDataGridProps) => {
    const rows = data.map((row, index) => ({ ...row, id: index }));

    return (
        <Box sx={{ height: 500, width: '100%' }}>
            <DataGrid
                rows={rows}
                columns={columns}
                showToolbar={true}
            />
        </Box>
    );
}

export default MeasurementsDataGrid;