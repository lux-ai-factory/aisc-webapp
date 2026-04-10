import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Box
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import React from "react";

const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface File {
    file_name: string;
    file_size: number;
}

interface ZipFileListProps {
  files: File[];
}

export const ZipFileList: React.FC<ZipFileListProps> = ({ files }) => {
    return (
        <TableContainer component={Paper} variant="outlined" sx={{borderRadius: 2}}>
            <Table size="small" aria-label="file list table">
                <TableHead>
                    <TableRow sx={{backgroundColor: 'action.hover'}}>
                        <TableCell sx={{fontWeight: 'bold'}}>Name</TableCell>
                        <TableCell sx={{fontWeight: 'bold'}}>Type</TableCell>
                        <TableCell align="right" sx={{fontWeight: 'bold'}}>Size</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {files.length > 0 ? (
                        files.map((file, index) => (
                            <TableRow
                                key={file.file_name || index}
                                hover
                                sx={{'&:last-child td, &:last-child th': {border: 0}, cursor: 'pointer'}}
                            >
                                <TableCell>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                                        <InsertDriveFileIcon fontSize="small" color="action"/>
                                        <Typography variant="body2" noWrap>
                                            {file.file_name}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption"
                                                sx={{textTransform: 'uppercase', color: 'text.secondary'}}>
                                        {file.file_name.split('.').pop()}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" color="text.secondary">
                                        {formatFileSize(file.file_size)}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} align="center" sx={{py: 3}}>
                                <Typography variant="body2" color="text.secondary italic">
                                    No files found in resources.
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ZipFileList;