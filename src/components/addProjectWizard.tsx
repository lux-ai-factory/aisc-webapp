import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
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

interface DatasetItem {
    name: string;
    file: File | null;
    uploaded: boolean;
}

interface ModelItem {
    name: string;
    file: File | null;
    uploaded: boolean;
}

interface PluginItem {
    name: string;
    version: string;
    source?: string;
    display_icon?: string;
}

interface AddProjectWizardProps {
    open: boolean;
    onClose: () => void;
    onFinish: (data: any) => void;
    datasets: any[];
    models: any[];
    /** Unused: tests are installed from the catalogue, not at project creation. */
    plugins?: PluginItem[];
    fetchDatasets: () => void;
    fetchModels: () => void;
    fetchPlugins: () => void;
}

export default function AddProjectWizard({
    open,
    onClose,
    onFinish,
    datasets: _datasets,
    models: _models,
    fetchDatasets,
    fetchModels,
    fetchPlugins
}: AddProjectWizardProps) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");

    // Local dataset + model lists (like Settings page)
    const [localDatasets, setLocalDatasets] = useState<DatasetItem[]>([]);
    const [localModels, setLocalModels] = useState<ModelItem[]>([]);

    // No "Plugins" step: tests are discovered in the catalogue and installed
// from there, which is the only place that knows what a test measures.
    const steps = ["Project Name", "Datasets", "Models"];

    // Load wizard data ONLY when the wizard opens
    useEffect(() => {
        if (open) {
            fetchDatasets();
            fetchModels();
            fetchPlugins();

            // Reset wizard state
            setActiveStep(0);
            setProjectName("");
            setLocalDatasets([]);
            setLocalModels([]);
        }
    }, [open]);

    const addDatasetRow = () => {
        setLocalDatasets(prev => [
            ...prev,
            { name: "", file: null, uploaded: false }
        ]);
    };

    const updateDatasetName = (index: number, name: string) => {
        setLocalDatasets(prev =>
            prev.map((ds, i) => (i === index ? { ...ds, name } : ds))
        );
    };

    const updateDatasetFile = (index: number, file: File | undefined) => {
        if (!file) return;
        setLocalDatasets(prev =>
            prev.map((ds, i) =>
                i === index ? { ...ds, file, uploaded: true } : ds
            )
        );
    };

    const deleteDatasetRow = (index: number) => {
        setLocalDatasets(prev => prev.filter((_, i) => i !== index));
    };

    const addModelRow = () => {
        setLocalModels(prev => [
            ...prev,
            { name: "", file: null, uploaded: false }
        ]);
    };

    const updateModelName = (index: number, name: string) => {
        setLocalModels(prev =>
            prev.map((m, i) => (i === index ? { ...m, name } : m))
        );
    };

    const updateModelFile = (index: number, file: File | undefined) => {
        if (!file) return;
        setLocalModels(prev =>
            prev.map((m, i) =>
                i === index ? { ...m, file, uploaded: true } : m
            )
        );
    };

    const deleteModelRow = (index: number) => {
        setLocalModels(prev => prev.filter((_, i) => i !== index));
    };

    const handleNext = () => {
        if (activeStep === 0 && projectName.trim().length === 0) return;
        setActiveStep(s => s + 1);
    };

    const handleBack = () => setActiveStep(s => s - 1);

    const handleFinish = () => {
        onFinish({
            name: projectName,
            datasets: localDatasets,
            models: localModels,
            // A project is created without tests. They are discovered in the
            // catalogue and installed from there.
            plugins: {}
        });
        onClose();
    };

    const datasetsValid = localDatasets.every(
        ds => ds.name.trim().length > 0 && ds.file
    );

    const modelsValid = localModels.every(
        m => m.name.trim().length > 0 && m.file
    );


    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    className: "dialog-paper-blue",
                }
            }}
        >
            <DialogTitle sx={{ color: "white" }}>
                Create New Project
            </DialogTitle>

            <DialogContent className="dialog-content-white">
                <Stepper activeStep={activeStep} sx={{ mb: 4, marginTop: 4 }}>
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

                {/* Datasets */}
                {activeStep === 1 && (
                    <Box className="wizard-step-column">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">
                                Datasets
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={addDatasetRow}
                                className="gradient-btn"
                            >
                                Add Dataset
                            </Button>
                        </Box>

                        {localDatasets.length > 0 && (
                        <List
                            className="step-list-container"
                        >
                            {localDatasets.map((ds, index) => (
                                <ListItem key={index}>
                                    <Box className="step-row"
                                    >
                                        <Box sx={{ flexGrow: 1 }}>
                                            <TextField
                                                label="Dataset Name"
                                                fullWidth
                                                autoFocus={index === localDatasets.length - 1}
                                                value={ds.name}
                                                onChange={e =>
                                                    updateDatasetName(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </Box>

                                        <Box className="step-actions"
                                        >
                                            {ds.uploaded ? (
                                                <CloudDoneIcon
                                                    color="success"
                                                    sx={{ mr: 2 }}
                                                />
                                            ) : (
                                                <Button
                                                    component="label"
                                                    variant="contained"
                                                    startIcon={<CloudUpload />}
                                                >
                                                    Upload
                                                    <HiddenInput
                                                        type="file"
                                                        accept="*/*"
                                                        onChange={e =>
                                                            updateDatasetFile(
                                                                index,
                                                                e.target.files?.[0]
                                                            )
                                                        }
                                                    />
                                                </Button>
                                            )}

                                            <IconButton
                                                color="error"
                                                onClick={() =>
                                                    deleteDatasetRow(index)
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

                {/* Models */}
                {activeStep === 2 && (
                    <Box className="wizard-step-column">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">
                                Models
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={addModelRow}
                                className="gradient-btn"
                            >
                                Add Model
                            </Button>
                        </Box>

                        {localModels.length > 0 && (
                        <List className="step-list-container">
                            {localModels.map((m, index) => (
                                <ListItem key={index}>
                                    <Box className="step-row">
                                        <Box sx={{ flexGrow: 1 }}>
                                            <TextField
                                                label="Model Name"
                                                fullWidth
                                                autoFocus={index === localModels.length - 1}
                                                value={m.name}
                                                onChange={e =>
                                                    updateModelName(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </Box>

                                        <Box className="step-actions">
                                            {m.uploaded ? (
                                                <CloudDoneIcon
                                                    color="success"
                                                    sx={{ mr: 2 }}
                                                />
                                            ) : (
                                                <Button
                                                    component="label"
                                                    variant="contained"
                                                    startIcon={<CloudUpload />}
                                                >
                                                    Upload
                                                    <HiddenInput
                                                        type="file"
                                                        accept=".onnx"
                                                        onChange={e =>
                                                            updateModelFile(
                                                                index,
                                                                e.target.files?.[0]
                                                            )
                                                        }
                                                    />
                                                </Button>
                                            )}

                                            <IconButton
                                                color="error"
                                                onClick={() =>
                                                    deleteModelRow(index)
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



                {/* NAVIGATION */}
                <Box className="wizard-nav">
                    <Button disabled={activeStep === 0} onClick={handleBack}>
                        Back
                    </Button>

                    {activeStep < steps.length - 1 ? (
                        <Button
                            onClick={handleNext}
                            variant="contained"
                            disabled={
                                (activeStep === 0 && projectName.trim().length === 0) ||
                                (activeStep === 1 && !datasetsValid) ||
                                (activeStep === 2 && !modelsValid)
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
                </Box>
            </DialogContent>
        </Dialog>
    );
}
