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
    Divider,
    Icon
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUpload from "@mui/icons-material/CloudUpload";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import { useEffect, useState } from "react";

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

export default function AddProjectWizard({
                                             open,
                                             onClose,
                                             onFinish,
                                             plugins,
                                             fetchDatasets,
                                             fetchModels,
                                             fetchPlugins
                                         }) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");

    // Local dataset + model lists (like Settings page)
    const [localDatasets, setLocalDatasets] = useState([]);
    const [localModels, setLocalModels] = useState([]);

    const [selectedPlugins, setSelectedPlugins] = useState({});

    const steps = ["Project Name", "Datasets", "Models", "Plugins"];

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
            setSelectedPlugins({});
        }
    }, [open]);

    const addDatasetRow = () => {
        setLocalDatasets(prev => [
            ...prev,
            { name: "", file: null, uploaded: false }
        ]);
    };

    const updateDatasetName = (index, name) => {
        setLocalDatasets(prev =>
            prev.map((ds, i) => (i === index ? { ...ds, name } : ds))
        );
    };

    const updateDatasetFile = (index, file) => {
        setLocalDatasets(prev =>
            prev.map((ds, i) =>
                i === index ? { ...ds, file, uploaded: true } : ds
            )
        );
    };

    const deleteDatasetRow = index => {
        setLocalDatasets(prev => prev.filter((_, i) => i !== index));
    };

    const addModelRow = () => {
        setLocalModels(prev => [
            ...prev,
            { name: "", file: null, uploaded: false }
        ]);
    };

    const updateModelName = (index, name) => {
        setLocalModels(prev =>
            prev.map((m, i) => (i === index ? { ...m, name } : m))
        );
    };

    const updateModelFile = (index, file) => {
        setLocalModels(prev =>
            prev.map((m, i) =>
                i === index ? { ...m, file, uploaded: true } : m
            )
        );
    };

    const deleteModelRow = index => {
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
            plugins: selectedPlugins
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
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ color: "white", backgroundColor: "AccentColor" }}>
                Create New Project
            </DialogTitle>

            <DialogContent
                sx={{
                    backgroundImage: "linear-gradient(135deg, #001075, #0020b5)",
                    color: "white",
                    paddingBottom: 4
                }}
            >
                <Stepper activeStep={activeStep} sx={{ mb: 4, marginTop: 4 }}>
                    {steps.map(label => (
                        <Step key={label}>
                            <StepLabel sx={{ color: "white !important" }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {/* Project Name */}
                {activeStep === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <TextField
                            label="Project Name *"
                            fullWidth
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            InputProps={{
                                sx: {
                                    color: "white",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        borderColor: "white"
                                    }
                                }
                            }}
                            InputLabelProps={{
                                sx: { color: "white" }
                            }}
                        />
                    </Box>
                )}

                {/* Datasets */}
                {activeStep === 1 && (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Datasets
                        </Typography>

                        <List
                            sx={{
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1,
                                mb: 1,
                                p: 2,
                                background: "rgba(255,255,255,0.05)"
                            }}
                        >
                            {localDatasets.map((ds, index) => (
                                <ListItem key={index}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            width: "100%"
                                        }}
                                    >
                                        <Box sx={{ flexGrow: 1 }}>
                                            <TextField
                                                label="Dataset Name"
                                                fullWidth
                                                value={ds.name}
                                                onChange={e =>
                                                    updateDatasetName(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                                InputProps={{
                                                    sx: {
                                                        color: "white",
                                                        "& .MuiOutlinedInput-notchedOutline":
                                                            { borderColor: "white" }
                                                    }
                                                }}
                                                InputLabelProps={{
                                                    sx: { color: "white" }
                                                }}
                                            />
                                        </Box>

                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                ml: 2
                                            }}
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

                            <Divider sx={{ my: 2 }} />

                            <ListItem>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={addDatasetRow}
                                >
                                    Add Dataset
                                </Button>
                            </ListItem>
                        </List>
                    </Box>
                )}

                {/* Models */}
                {activeStep === 2 && (
                    <Box>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Models
                        </Typography>

                        <List
                            sx={{
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1,
                                mb: 1,
                                p: 2,
                                background: "rgba(255,255,255,0.05)"
                            }}
                        >
                            {localModels.map((m, index) => (
                                <ListItem key={index}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            width: "100%"
                                        }}
                                    >
                                        <Box sx={{ flexGrow: 1 }}>
                                            <TextField
                                                label="Model Name"
                                                fullWidth
                                                value={m.name}
                                                onChange={e =>
                                                    updateModelName(
                                                        index,
                                                        e.target.value
                                                    )
                                                }
                                                InputProps={{
                                                    sx: {
                                                        color: "white",
                                                        "& .MuiOutlinedInput-notchedOutline":
                                                            { borderColor: "white" }
                                                    }
                                                }}
                                                InputLabelProps={{
                                                    sx: { color: "white" }
                                                }}
                                            />
                                        </Box>

                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                ml: 2
                                            }}
                                        >
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

                            <Divider sx={{ my: 2 }} />

                            <ListItem>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={addModelRow}
                                >
                                    Add Model
                                </Button>
                            </ListItem>
                        </List>
                    </Box>
                )}

                {/* Plugins */}
                {activeStep === 3 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {plugins.map(plugin => {
                            if (!plugin.name) return null;

                            const selected = !!selectedPlugins[plugin.name];

                            return (
                                <Box
                                    key={plugin.name}
                                    onClick={() =>
                                        setSelectedPlugins(prev => {
                                            const next = { ...prev };
                                            if (next[plugin.name])
                                                delete next[plugin.name];
                                            else next[plugin.name] = [];
                                            return next;
                                        })
                                    }
                                    sx={{
                                        border: selected
                                            ? "2px solid #00e676"
                                            : "2px solid #4591FB",
                                        borderRadius: "10px",
                                        padding: "14px 18px",
                                        cursor: "pointer",
                                        background: selected
                                            ? "linear-gradient(135deg, #4591FB, #0048ff)"
                                            : "white",
                                        color: selected ? "white" : "black",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        transition: "0.2s"
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2
                                        }}
                                    >
                                        <Icon>{plugin.display_icon}</Icon>
                                        <Typography>{plugin.name}</Typography>
                                    </Box>

                                    {selected && (
                                        <Icon sx={{ color: "#00e676" }}>
                                            check_circle
                                        </Icon>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {/* NAVIGATION */}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: 4
                    }}
                >
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
