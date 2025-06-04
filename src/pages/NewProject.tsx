import { Button, TextField, Box, Typography, Stack } from '@mui/material';
import React, { useState } from 'react';

import UploadFileField from '../components/UploadFileField';

import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import axios, { AxiosResponse } from 'axios';

/** Names of the steps in the project creation process */
const step_names = ['Project settings', 'File Upload', 'Data settings'];

/**
 * Props interface for the ProjectSettingsForm component
 * @interface ProjectSettingsFormProps
 * @property {() => void} nextPage - Function to move to the next step
 * @property {React.Dispatch<React.SetStateAction<string | null>>} setProjectPid - Function to set the project ID
 */
interface ProjectSettingsFormProps {
    nextPage: () => void;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * ProjectSettingsForm component
 * First step in project creation where user enters basic project details
 * Validates project name and creates a new project on the server
 * 
 * @param {ProjectSettingsFormProps} props - Component props
 * @returns {JSX.Element} A form for project settings
 */
function ProjectSettingsForm(props: ProjectSettingsFormProps) {

    const API_URL = import.meta.env.VITE_API_URL;

    const MIN_PROJECT_NAME = 3;

    const { nextPage, setProjectPid } = props;

    const [projectName, setProjectName] = useState<string | null>(null);

    const handleInputProjectName = (event: { target: { value: string; }; }) => {
        setProjectName(event.target.value);
    };

    const handleError = () => {
        console.error('Error')
    }

    const handleSuccess = (response: AxiosResponse) => {
        setProjectPid(response.data["pid"])
    }

    function handleNext() {
        if (!projectName) {
            alert("Set project name")
            return;
        }
        if (projectName.length < MIN_PROJECT_NAME) {
            alert("Project name too short!")
            return;
        }

        axios.post(
            `${API_URL}/api/projects`,
            {
                name: `${projectName}`,
            }
        ).then(response => {
            if (response.status === 201) {
                handleSuccess(response)
                nextPage()
            } else {
                handleError();
            }
        }).catch(_ => {
            handleError();
        });
    }

    return (
        <Box width={1} component="form" noValidate autoComplete="off">
            <TextField label="Project name" onChange={handleInputProjectName} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2, width: 1 }}>
                <Button onClick={handleNext}>
                    {'Next'}
                </Button>
            </Box>
        </Box>
    );
}

/**
 * Props interface for the FileUploadForm component
 * @interface FileUploadFormProps
 * @property {() => void} nextPage - Function to move to the next step
 * @property {string | null} projectPid - Project ID to associate uploaded files with
 */
interface FileUploadFormProps {
    nextPage: () => void;
    projectPid: string | null;
}

/**
 * FileUploadForm component
 * Second step in project creation where user uploads required files
 * Handles upload of training data, test data, and model file
 * 
 * @param {FileUploadFormProps} props - Component props
 * @returns {JSX.Element} A form with file upload fields
 */
function FileUploadForm(props: FileUploadFormProps) {

    const { projectPid } = props;
    const API_URL = import.meta.env.VITE_API_URL;

    const [trainFileName, setTrainFileName] = useState<string | null>(null);
    const [testFileName, setTestFileName] = useState<string | null>(null);
    const [modelFileName, setModelFileName] = useState<string | null>(null);

    function handleNext() {
        if (!trainFileName || !testFileName || !modelFileName) {
            alert("Please upload the files first.")
            return
        }
    }

    return (
        <Box width={0.5} component="form" noValidate autoComplete="off" >
            <Stack spacing={2}>
                <UploadFileField label="Training dataset" fileType='.csv' uploadUrl={`${API_URL}/api/dataset_file?project_pid=${projectPid}`} setSuccessResponse={setTrainFileName} />
                <UploadFileField label="Test dataset" fileType='.csv' uploadUrl={`${API_URL}/api/dataset_file?project_pid=${projectPid}`} setSuccessResponse={setTestFileName} />
                <UploadFileField label="Model (as ONNX)" fileType='.onnx' uploadUrl={`${API_URL}/api/model_file?project_pid=${projectPid}`} setSuccessResponse={setModelFileName} />
            </Stack>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2, width: 1 }}>
                <Button onClick={handleNext}>
                    {'Next'}
                </Button>
            </Box>
        </Box>
    );
}

/**
 * Props interface for the Steps component
 * @interface StepsProps
 * @property {number} step - Current step number
 * @property {() => void} nextPage - Function to move to the next step
 * @property {string | null} projectPid - Current project ID
 * @property {React.Dispatch<React.SetStateAction<string | null>>} setProjectPid - Function to set the project ID
 */
interface StepsProps {
    step: number;
    nextPage: () => void;
    projectPid: string | null;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * Steps component
 * Manages the different steps in project creation
 * Renders the appropriate form based on current step
 * 
 * @param {StepsProps} props - Component props
 * @returns {JSX.Element} The current step's form component
 */
function Steps(props: StepsProps) {

    const { step, nextPage, projectPid, setProjectPid } = props;

    switch (step) {
        case 0:
            return (
                <ProjectSettingsForm nextPage={nextPage} setProjectPid={setProjectPid} />
            );
        case 1:
            return (
                <FileUploadForm nextPage={nextPage} projectPid={projectPid} />
            );
        default:
            <Box>Not implemented</Box>
    }
}

/**
 * Props interface for the HorizontalLinearStepper component
 * @interface HorizontalLinearStepperProps
 * @property {string | null} projectPid - Current project ID
 * @property {React.Dispatch<React.SetStateAction<string | null>>} setProjectPid - Function to set the project ID
 */
interface HorizontalLinearStepperProps {
    projectPid: string | null;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * HorizontalLinearStepper component
 * Main stepper component that manages the project creation workflow
 * Shows progress through steps and handles navigation between them
 * 
 * @param {HorizontalLinearStepperProps} props - Component props
 * @returns {JSX.Element} A stepper component with the current step's content
 */
function HorizontalLinearStepper(props: HorizontalLinearStepperProps) {

    const { projectPid, setProjectPid } = props;
    const [activeStep, setActiveStep] = React.useState(0);

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Stepper activeStep={activeStep}>
                {step_names.map((label, _) => {
                    const stepProps: { completed?: boolean } = {};
                    const labelProps: {
                        optional?: React.ReactNode;
                    } = {};
                    return (
                        <Step key={label} {...stepProps}>
                            <StepLabel {...labelProps}>{label}</StepLabel>
                        </Step>
                    );
                })}
            </Stepper>
            {activeStep === step_names.length ? (
                <React.Fragment>
                    <Typography sx={{ mt: 2, mb: 1 }}>
                        All steps completed - you&apos;re finished
                    </Typography>
                </React.Fragment>
            ) : (
                <React.Fragment>
                    <Typography sx={{ mt: 2, mb: 1 }}>
                        For debug: Step {activeStep + 1}
                    </Typography>
                    <Box sx={{
                        display: 'flex'
                    }}><Steps step={activeStep} nextPage={handleNext} projectPid={projectPid} setProjectPid={setProjectPid} /></Box>
                </React.Fragment>
            )}
        </Box>
    );
}

/**
 * NewProject page component
 * Main page for creating a new project in the A4S system
 * Manages the project creation workflow including:
 * - Project settings
 * - File uploads (training data, test data, model)
 * - Data configuration
 * 
 * @returns {JSX.Element} The new project creation page with stepper workflow
 */
export default function NewProject() {

    const [projectPid, setProjectPid] = useState<string | null>(null);

    return (
        <Box width={1}>
            <Typography variant="h6" gutterBottom>
                New project Upload
            </Typography>
            <Stack spacing={2}>
                <HorizontalLinearStepper projectPid={projectPid} setProjectPid={setProjectPid} />
            </Stack>
        </Box>
    );
}
