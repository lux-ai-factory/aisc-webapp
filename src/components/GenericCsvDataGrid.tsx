import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

interface GenericCsvDataGridProps {
  data: string[][];
  title?: string;
}

export const GenericCsvDataGrid: React.FC<GenericCsvDataGridProps> = ({ data, title }) => {
  const { columns, rows } = useMemo(() => {
    if (!data || data.length === 0) {
      return { columns: [], rows: [] };
    }

    const headers = data[0];
    const generatedColumns: GridColDef[] = headers.map((header) => ({
      field: header,
      headerName: header,
      flex: 1,
      minWidth: 120,
    }));

    const dataRows = data.slice(1);
    const generatedRows = dataRows.map((row, rowIndex) => {
      const rowObject: Record<string, any> = { id: rowIndex };
      headers.forEach((header, colIndex) => {
        rowObject[header] = row[colIndex];
      });
      return rowObject;
    });

    return { columns: generatedColumns, rows: generatedRows };
  }, [data]);

  if (rows.length === 0) {
    return <Box sx={{ p: 2 }}>No data available</Box>;
  }

  return (
    <Box sx={{ my: 2 }}>
      {title && <h3>{title}</h3>}
      <Box sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 5 },
            },
          }}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  );
};

export default GenericCsvDataGrid;