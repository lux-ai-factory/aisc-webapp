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
    Select,
    MenuItem,
    InputLabel,
    Icon
} from "@mui/material";
import { useEffect, useState } from "react";

export default function AddProjectWizard({
     open,
     onClose,
     onFinish,
     datasets,
     models,
     plugins,
     fetchDatasets,
     fetchModels,
     fetchPlugins
}) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");
    const [dataset, setDataset] = useState("");
    const [model, setModel] = useState("");
    const [selectedPlugins, setSelectedPlugins] = useState({});

    const steps = ["Project Name", "Datasets & Models", "Plugins"];

    // Load wizard data ONLY when the wizard opens
    useEffect(() => {
        if (open) {
            fetchDatasets();
            fetchModels();
            fetchPlugins();
        }
    }, [open]);

    const handleNext = () => setActiveStep((s) => s + 1);
    const handleBack = () => setActiveStep((s) => s - 1);

    const handleFinish = () => {
        onFinish({
            name: projectName,
            dataset,
            model,
            plugins: selectedPlugins
        });
        onClose();
    };

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
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{ color: "white !important" }}>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {activeStep === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <TextField
                            label="Project Name"
                            fullWidth
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            InputProps={{
                                sx: {
                                    color: "white",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" }
                                }
                            }}
                            InputLabelProps={{
                                sx: { color: "white", "&.Mui-focused": { color: "white" } }
                            }}
                        />
                    </Box>
                )}

                {activeStep === 1 && (
                    <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "center", gap: 3 }}>
                        <Box>
                            <InputLabel sx={{ color: "white" }}>Dataset</InputLabel>
                            <Select
                                value={dataset}
                                onChange={(e) => setDataset(e.target.value)}
                                sx={{
                                    width: "300px",
                                    color: "white",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "& .MuiSvgIcon-root": { color: "white" }
                                }}
                            >
                                {datasets.map((d) => (
                                    <MenuItem key={d.pid} value={d.pid}>{d.name}</MenuItem>
                                ))}
                            </Select>
                        </Box>

                        <Box>
                            <InputLabel sx={{ color: "white" }}>Model</InputLabel>
                            <Select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                sx={{
                                    width: "300px",
                                    color: "white",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                                    "& .MuiSvgIcon-root": { color: "white" }
                                }}
                            >
                                {models.map((m) => (
                                    <MenuItem key={m.pid} value={m.pid}>{m.name}</MenuItem>
                                ))}
                            </Select>
                        </Box>
                    </Box>
                )}

                {activeStep === 2 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {plugins.map((plugin) => {
                            if (!plugin.name) return null;

                            const selected = !!selectedPlugins[plugin.name];

                            return (
                                <Box
                                    key={plugin.name}
                                    onClick={() =>
                                        setSelectedPlugins(prev => {
                                            const next = { ...prev };
                                            if (next[plugin.name]) delete next[plugin.name];
                                            else next[plugin.name] = [];
                                            return next;
                                        })
                                    }
                                    sx={{
                                        border: selected ? "2px solid #00e676" : "2px solid #4591FB",
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
                                        transition: "0.2s",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                        <Icon>{plugin.display_icon}</Icon>
                                        <Typography>{plugin.name}</Typography>
                                    </Box>

                                    {selected && (
                                        <Icon sx={{ color: "#00e676" }}>check_circle</Icon>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
                    <Button disabled={activeStep === 0} onClick={handleBack}>
                        Back
                    </Button>

                    {activeStep < steps.length - 1 ? (
                        <Button onClick={handleNext} variant="contained">
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
