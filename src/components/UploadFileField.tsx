import React, { useState } from "react";
import { TextField, Box, Stack, IconButton } from '@mui/material';
import { FileDownloadDone, Replay, UploadFile } from '@mui/icons-material';
import CircularProgressWithLabel from "./CircularProgressWithLabel";
import axios, { AxiosProgressEvent } from "axios";

// Simplified enum - removed verbose comments
enum FileUploadState {
    EMPTY = "empty",
    SELECTED = "selected",
    UPLOADING = "uploading",
    SUCCESS = "success",
    ERROR = "error",
}

interface UploadFileFieldProps {
    label: string;
    fileType: string;
    uploadUrl: string;
    onSuccess: (fileName: string) => void;
}

function UploadFileField({ label, fileType, uploadUrl, onSuccess }: UploadFileFieldProps) {
    const [progress, setProgress] = useState(0);
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [status, setStatus] = useState<FileUploadState>(FileUploadState.EMPTY);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLocalFile(file);
            setStatus(FileUploadState.SELECTED);
        }
    };

    const handleUpload = async () => {
        if (!localFile) return;

        setStatus(FileUploadState.UPLOADING);
        setProgress(0);

        const formData = new FormData();
        formData.append("file", localFile);

        try {
            const response = await axios.put(uploadUrl, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                    if (progressEvent.total) {
                        const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        setProgress(percentComplete);
                    }
                },
            });

            if (response.status === 200) {
                setStatus(FileUploadState.SUCCESS);
                onSuccess(response.data.file_name);
            } else {
                setStatus(FileUploadState.ERROR);
            }
        } catch {
            setStatus(FileUploadState.ERROR);
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case FileUploadState.EMPTY:
                return <IconButton disabled><UploadFile /></IconButton>;
            case FileUploadState.SELECTED:
                return <IconButton onClick={handleUpload}><UploadFile /></IconButton>;
            case FileUploadState.UPLOADING:
                return <CircularProgressWithLabel value={progress} />;
            case FileUploadState.SUCCESS:
                return <FileDownloadDone color="primary" />;
            case FileUploadState.ERROR:
                return <IconButton onClick={handleUpload}><Replay /></IconButton>;
            default:
                return null;
        }
    };

    return (
        <Box>
            <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                    type="file"
                    variant="outlined"
                    label={label}
                    slotProps={{
                        htmlInput: { accept: fileType },
                        inputLabel: { shrink: true },
                    }}
                    fullWidth
                    margin="normal"
                    onChange={handleFileSelect}
                    disabled={status === FileUploadState.UPLOADING || status === FileUploadState.SUCCESS}
                />
                {getStatusIcon()}
            </Stack>
        </Box>
    );
}

export default UploadFileField;
