
import { Button, TextField, Box, Typography, Stack } from '@mui/material';
import React, { useState } from 'react';

import UploadFileField from '../components/UploadFileField';



import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';

const step_names = ['Project settings', 'File Upload', 'Data settings'];


function ProjectSettingsForm() {

    return (
        <Box width={0.5} component="form" noValidate autoComplete="off">
            <TextField label="Project name" />
        </Box>
    );

}


interface StepsProps {
    step: number;
}
function Steps(props: StepsProps) {

    const { step } = props;

    switch (step) {
        case 0:
            return (
                <ProjectSettingsForm/>
            );
        default:
            <Box>Not implemented</Box>
    }

}


function HorizontalLinearStepper() {
    const [activeStep, setActiveStep] = React.useState(0);
    const [skipped, setSkipped] = React.useState(new Set<number>());

    const isStepOptional = (step: number) => {
        return false;
    };

    const isStepSkipped = (step: number) => {
        return skipped.has(step);
    };

    const handleNext = () => {
        let newSkipped = skipped;
        if (isStepSkipped(activeStep)) {
            newSkipped = new Set(newSkipped.values());
            newSkipped.delete(activeStep);
        }

        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        setSkipped(newSkipped);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleSkip = () => {
        if (!isStepOptional(activeStep)) {
            // You probably want to guard against something like this,
            // it should never occur unless someone's actively trying to break something.
            throw new Error("You can't skip a step that isn't optional.");
        }

        setActiveStep((prevActiveStep) => prevActiveStep + 1);
        setSkipped((prevSkipped) => {
            const newSkipped = new Set(prevSkipped.values());
            newSkipped.add(activeStep);
            return newSkipped;
        });
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
                    if (isStepOptional(index)) {
                        labelProps.optional = (
                            <Typography variant="caption">Optional</Typography>
                        );
                    }
                    if (isStepSkipped(index)) {
                        stepProps.completed = false;
                    }
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
                    <Steps step={activeStep} />
                    <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                        <Button
                            color="inherit"
                            disabled={activeStep === 0}
                            onClick={handleBack}
                            sx={{ mr: 1 }}
                        >
                            Back
                        </Button>
                        <Box sx={{ flex: '1 1 auto' }} />
                        {isStepOptional(activeStep) && (
                            <Button color="inherit" onClick={handleSkip} sx={{ mr: 1 }}>
                                Skip
                            </Button>
                        )}
                        <Button onClick={handleNext}>
                            {activeStep === step_names.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </Box>
                </React.Fragment>
            )}
        </Box>
    );
}


export default function NewProject() {

    const API_URL = import.meta.env.VITE_API_URL;

    const [trainFileName, setTrainFileName] = useState<string | null>(null);

    return (
        <Box width={1}>
            <Typography variant="h6" gutterBottom>
                New project Upload
            </Typography>
            <Stack spacing={2}>

                <HorizontalLinearStepper />

                <TextField label="Project name" />
                <Box width={0.5} component="form" noValidate autoComplete="off">
                    <UploadFileField label="Training dataset" fileType='.csv' uploadUrl={`${API_URL}/api/dataset_file`} setSuccessResponse={setTrainFileName} />
                </Box>
                <Button
                    // onClick={handleSubmit}
                    variant="contained"
                    disabled={!trainFileName}
                >
                    Upload
                </Button>
            </Stack>

        </Box>
    );
}
