
import { Handshake } from '@mui/icons-material';
import { Button, TextField, Box, Typography, Input } from '@mui/material';
import { Chart as ChartJS, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import React, { useState } from 'react';

ChartJS.register(...registerables, zoomPlugin);

interface UploadFileFieldProps {
    label: string;
    fileType: string;
    handleSelectedFile: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function UploadFileField(props: UploadFileFieldProps) {

    const { label, fileType, handleSelectedFile } = props;
    return (
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
        />
    );
}



export default function NewProject() {

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile)
        }
    };

    const [trainFile, setTrainFile] = useState<File | null>(null);
    const [testFile, setTestFile] = useState<File | null>(null);
    const [modelFile, setModelFile] = useState<File | null>(null);

    return (
        <Box component="form" noValidate autoComplete="off">
            <Typography variant="h6" gutterBottom>
                New project Upload
            </Typography>
            <TextField label="Project name" />
            <UploadFileField label="Training dataset" fileType='.csv' handleSelectedFile={(e) => handleFileChange(e, setTrainFile)} />
            <UploadFileField label="Production dataset" fileType='.csv' handleSelectedFile={(e) => handleFileChange(e, setTestFile)} />
            <UploadFileField label="Model (ONNX format)" fileType='.onnx' handleSelectedFile={(e) => handleFileChange(e, setModelFile)} />

            {/* <Typography variant="h6" gutterBottom>
                The selected file: {trainFile?.name}
            </Typography> */}

            <Button
                // onClick={handleSubmit}
                variant="contained"
                disabled={!trainFile || !testFile || !modelFile}
            >
                Upload
            </Button>

        </Box>
    );
}
