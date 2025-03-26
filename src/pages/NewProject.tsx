
import { Button, TextField, Box, Typography, Stack } from '@mui/material';
import React, { useState } from 'react';

import UploadFileField from '../components/UploadFileField';



import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import axios, { AxiosResponse } from 'axios';

const step_names = ['Project settings', 'File Upload', 'Data settings'];




function ProjectSettingsForm(props: {
    nextPage: () => void;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>;
}) {

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
        }).catch(error => {
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


function FileUploadForm(props: {
    nextPage: () => void;
    projectPid: string;
}) {

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
        </Box>

    );

}


interface StepsProps {
    step: number;
    nextPage: () => void;
    projectPid: string | null;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>
}
function Steps(props: StepsProps) {

    const { step, nextPage, projectPid, setProjectPid } = props;

    switch (step) {
        case 0:
            return (
                <ProjectSettingsForm nextPage={nextPage} setProjectPid={setProjectPid} />
            );
        case 1:
            return (
                <FileUploadForm />
            );
        default:
            <Box>Not implemented</Box>
    }

}

interface HorizontalLinearStepperProps {
    projectPid: string | null;
    setProjectPid: React.Dispatch<React.SetStateAction<string | null>>

}
function HorizontalLinearStepper(props: HorizontalLinearStepperProps) {

    const { projectPid, setProjectPid } = props;
    const [activeStep, setActiveStep] = React.useState(0);

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Stepper activeStep={activeStep}>
                {step_names.map((label, index) => {
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
                    {/* <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                        <Box sx={{ flex: '1 1 auto' }} />
                        <Button onClick={handleReset}>Reset</Button>
                    </Box> */}
                </React.Fragment>
            ) : (
                <React.Fragment>
                    <Typography sx={{ mt: 2, mb: 1 }}>
                        For debug: Step {activeStep + 1}
                    </Typography>
                    <Box sx={{
                        display: 'flex'
                    }}><Steps step={activeStep} nextPage={handleNext} projectPid={projectPid} setProjectPid={setProjectPid} /></Box>

                    {/* <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                        <Button
                            color="inherit"
                            disabled={activeStep === 0}
                            onClick={handleBack}
                            sx={{ mr: 1 }}
                        >
                            Back
                        </Button>
                        <Box sx={{ flex: '1 1 auto' }} />
                        <Button onClick={handleNext}>
                            {activeStep === step_names.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </Box> */}
                </React.Fragment>
            )}
        </Box>
    );
}


export default function NewProject() {

    const API_URL = import.meta.env.VITE_API_URL;

    const [trainFileName, setTrainFileName] = useState<string | null>(null);

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
