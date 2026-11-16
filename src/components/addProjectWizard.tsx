import {
    Box,
    Button,
    MenuItem,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
    Tooltip,
    IconButton,
    List,
    ListItem,
    Icon
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUpload from "@mui/icons-material/CloudUpload";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import { useEffect, useState } from "react";
import AppDialog from "./AppDialog";
import "./addProjectWizard.css";
import "../styles/common.css";

const HiddenInput = styled("input")({
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    bottom: 0,
    left: 0,
    whiteSpace: "nowrap",
    width: 1
});

type ComponentType = "dataset" | "model";

interface ComponentItem {
    name: string;
    type: ComponentType;
    file: File | null;
    uploaded: boolean;
}

interface AddProjectWizardProps {
    open: boolean;
    onClose: () => void;
    onFinish: (data: any) => void;
}

export default function AddProjectWizard({
    open,
    onClose,
    onFinish,
}: AddProjectWizardProps) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");

    const [localComponents, setLocalComponents] = useState<ComponentItem[]>([]);

    const steps = ["Project Name", "Components"];

    // Load wizard data ONLY when the wizard opens
    useEffect(() => {
        if (open) {
            // Reset wizard state
            setActiveStep(0);
            setProjectName("");
            setLocalComponents([]);
        }
    }, [open]);

    const addComponentRow = () => {
        setLocalComponents(prev => [
            ...prev,
            { name: "", type: "model", file: null, uploaded: false }
        ]);
    };

    const updateComponentName = (index: number, name: string) => {
        setLocalComponents(prev =>
            prev.map((c, i) => (i === index ? { ...c, name } : c))
        );
    };

    const updateComponentType = (index: number, type: ComponentType) => {
        setLocalComponents(prev =>
            prev.map((c, i) => (i === index ? { ...c, type } : c))
        );
    };

    const updateComponentFile = (index: number, file: File | undefined) => {
        if (!file) return;
        setLocalComponents(prev =>
            prev.map((c, i) =>
                i === index ? { ...c, file, uploaded: true } : c
            )
        );
    };

    const deleteComponentRow = (index: number) => {
        setLocalComponents(prev => prev.filter((_, i) => i !== index));
    };

    const handleNext = () => {
        if (activeStep === 0 && projectName.trim().length === 0) return;
        setActiveStep(s => s + 1);
    };

    const handleBack = () => setActiveStep(s => s - 1);

    const handleFinish = () => {
        onFinish({
            name: projectName,
            components: localComponents,
        });
        onClose();
    };

    const componentsValid = localComponents.every(
        c => c.name.trim().length > 0 && c.file
    );


    return (
        <AppDialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            title="Create New Project"
            actionsSx={{ justifyContent: 'space-between' }}
            actions={
                <>
                    <Button disabled={activeStep === 0} onClick={handleBack}>
                        Back
                    </Button>

                    {activeStep < steps.length - 1 ? (
                        <Button
                            onClick={handleNext}
                            variant="contained"
                            disabled={
                                (activeStep === 0 && projectName.trim().length === 0) ||
                                (activeStep === 1 && !componentsValid)
                            }
                        >
                            Next
                        </Button>

                    ) : (
                        <Button onClick={handleFinish} variant="contained">
                            <Icon>check</Icon>
                            Create
                        </Button>
                    )}
                </>
            }
        >
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map(label => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {/* Project Name */}
                {activeStep === 0 && (
                    <Box className="wizard-step-column">
                        <TextField
                            label="Project Name *"
                            fullWidth
                            autoFocus
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                        />
                    </Box>
                )}

                {/* Components */}
                {activeStep === 1 && (
                    <Box className="wizard-step-column">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">
                                Components
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={addComponentRow}
                                className="gradient-btn"
                            >
                                Add Component
                            </Button>
                        </Box>

                        {localComponents.length > 0 && (
                        <List className="step-list-container">
                            {localComponents.map((c, index) => (
                                <ListItem key={index} sx={{ pr: 0 }}>
                                    <Box className="step-row">
                                        <Box sx={{ flexGrow: 1 }}>
                                            <TextField
                                                label="Component Name"
                                                fullWidth
                                                autoFocus={index === localComponents.length - 1}
                                                value={c.name}
                                                onChange={e =>
                                                    updateComponentName(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </Box>

                                        <TextField
                                            select
                                            label="Type"
                                            value={c.type}
                                            onChange={e =>
                                                updateComponentType(
                                                    index,
                                                    e.target.value as ComponentType
                                                )
                                            }
                                            sx={{ minWidth: 140 }}
                                        >
                                            <MenuItem value="model">Model</MenuItem>
                                            <MenuItem value="dataset">Dataset</MenuItem>
                                        </TextField>

                                        <Box className="step-actions">
                                            <Tooltip title={c.file ? "File selected — click to change" : "Choose file"} placement="top">
                                                <IconButton
                                                    component="label"
                                                    color={c.file ? "success" : "primary"}
                                                    aria-label={c.file ? "Change file" : "Upload"}
                                                    sx={{ mr: 0.5 }}
                                                >
                                                    {c.file ? <CloudDoneIcon /> : <CloudUpload />}
                                                    <HiddenInput
                                                        type="file"
                                                        accept={c.type === 'model' ? '.onnx' : '*/*'}
                                                        onChange={e => {
                                                            updateComponentFile(
                                                                index,
                                                                e.target.files?.[0]
                                                            );
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                </IconButton>
                                            </Tooltip>

                                            <IconButton
                                                color="error"
                                                onClick={() =>
                                                    deleteComponentRow(index)
                                                }
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </ListItem>
                            ))}

                        </List>
                        )}
                    </Box>
                )}
            </AppDialog>
    );
}
