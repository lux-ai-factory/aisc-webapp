import React, { useState } from "react";
import axios, { AxiosResponse } from "axios";

import { TextField, Box, Stack, IconButton } from '@mui/material';

import FileDownloadDoneIcon from '@mui/icons-material/FileDownloadDone';
import ReplayIcon from '@mui/icons-material/Replay';

import UploadFileIcon from '@mui/icons-material/UploadFile';
import CircularProgressWithLabel from "./CircularProgressWithLabel";

/**
 * Enum representing the different states of file upload
 * @enum {string}
 */
enum FileUploadStateEnum {
    /** No file selected */
    EMPTY = "empty",
    /** File selected but not uploaded */
    SELECTED = "selected",
    /** File is currently being uploaded */
    UPLOADING = "uploading",
    /** File upload completed successfully */
    SUCCESS = "success",
    /** File upload failed */
    ERROR = "error",
};

/**
 * Props interface for the UploadFileField component
 * @interface UploadFileFieldProps
 * @property {string} label - Label text for the file input field
 * @property {string} fileType - Accepted file type (e.g., ".csv")
 * @property {string} uploadUrl - URL endpoint for file upload
 * @property {React.Dispatch<React.SetStateAction<string | null>>} setSuccessResponse - Callback to handle successful upload
 */
interface UploadFileFieldProps {
    label: string;
    fileType: string;
    uploadUrl: string;
    setSuccessResponse: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * UploadFileField component
 * A file upload field with progress indicator and status icons
 * Handles file selection, upload, and displays upload progress
 * 
 * Features:
 * - File type validation
 * - Upload progress indicator
 * - Status icons for different states
 * - Error handling with retry option
 * - Disabled state during upload
 * 
 * @param {UploadFileFieldProps} props - Component props
 * @returns {JSX.Element} A file upload field with progress and status indicators
 */
function UploadFileField(props: UploadFileFieldProps){


    const { label, fileType, setSuccessResponse, uploadUrl } = props;
    const [progress, setProgress] = useState<number>(0);
    const [localFile, setLocalFile] = useState<File | null>(null);

    const [status, setStatus] = useState<FileUploadStateEnum>(FileUploadStateEnum.EMPTY);

    const handleSelectedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setLocalFile(selectedFile);
            setStatus(FileUploadStateEnum.SELECTED)
        }
    };

    const handleUpload = async () => {
        if (!localFile) {
            alert("Please select a file first.");
            return;
        }

        setStatus(FileUploadStateEnum.UPLOADING)

        const formData = new FormData();
        formData.append("file", localFile);
        try {
            const response = await axios.post(uploadUrl, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        setProgress(percentComplete);
                    }
                },
            });

            if (response.status === 201) {
                handleSuccess(response)
            } else {
                handleError();
            }
        } catch {
            handleError();
        }
    };

    const handleSuccess = (response: AxiosResponse) => {
        setStatus(FileUploadStateEnum.SUCCESS)
        setSuccessResponse(response.data["file_name"])


    }

    const handleError = () => {
        setStatus(FileUploadStateEnum.ERROR)
    }


    // https://stackoverflow.com/questions/35711724/upload-progress-indicators-for-fetch


    const uploadStatusIcons = {
        [FileUploadStateEnum.EMPTY]: (
            <IconButton disabled>
                <UploadFileIcon />
            </IconButton>
        ),
        [FileUploadStateEnum.SELECTED]: (
            <IconButton onClick={handleUpload}>
                <UploadFileIcon />
            </IconButton>
        ),
        [FileUploadStateEnum.UPLOADING]: (
            <CircularProgressWithLabel value={progress} />
        ),
        [FileUploadStateEnum.SUCCESS]: <FileDownloadDoneIcon color="primary" />,
        [FileUploadStateEnum.ERROR]: (
            <IconButton onClick={handleUpload}>
                <ReplayIcon />
            </IconButton>
        ),
    };

    return (
        <Box>
            <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                    type="file"
                    variant="outlined"
                    label={label}
                    slotProps={{
                        htmlInput: {
                            accept: fileType, // Only accept CSV files
                        },
                        inputLabel: {
                            shrink: true,
                        },
                    }}
                    fullWidth
                    margin="normal"
                    onChange={handleSelectedFile}
                    disabled={status === FileUploadStateEnum.UPLOADING || status === FileUploadStateEnum.SUCCESS}
                />
                {uploadStatusIcons[status] || null}
            </Stack>
        </Box>

    );
}

export default UploadFileField;
