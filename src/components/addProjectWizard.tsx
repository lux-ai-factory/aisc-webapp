import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
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
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import CloudUpload from "@mui/icons-material/CloudUpload";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

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
    plugins: PluginItem[];
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
    plugins,
    fetchDatasets,
    fetchModels,
    fetchPlugins
}: AddProjectWizardProps) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");

    // Local dataset + model lists (like Settings page)
    const [localDatasets, setLocalDatasets] = useState<DatasetItem[]>([]);
    const [localModels, setLocalModels] = useState<ModelItem[]>([]);

    const [selectedPlugins, setSelectedPlugins] = useState<Record<string, boolean>>({});

    const groupedPlugins = useMemo(() => {
        const seen = new Set<string>();
        return plugins.filter(p => {
            if (!p.name || seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
        });
    }, [plugins]);

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
        const allEntries: Record<string, { name: string; version: string }> = {};
        plugins.forEach((p, i) => {
            if (selectedPlugins[p.name]) {
                allEntries[String(i)] = { name: p.name, version: p.version };
            }
        });
        onFinish({
            name: projectName,
            datasets: localDatasets,
            models: localModels,
            plugins: allEntries
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
                    sx: {
                        backgroundColor: "#0048ff",
                        backgroundImage: "linear-gradient(135deg, #001075, #0020b5)",
                        borderRadius: "16px",
                        boxShadow: "none",
                    }
                }
            }}
        >
            <DialogTitle sx={{ color: "white" }}>
                Create New Project
            </DialogTitle>

            <DialogContent sx={{ paddingBottom: 4, backgroundColor: "white", borderTopLeftRadius: "12px", borderTopRightRadius: "12px", mx: 1, mb: 1, mt: 1 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4, marginTop: 4 }}>
                    {steps.map(label => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {/* Project Name */}
                {activeStep === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                                                        accept=".csv"
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

                {/* PLUGINS (now packages) */}
                {activeStep === 3 && (
                    <Grid container spacing={2}>
                        {groupedPlugins.map(pkg => {
                            const selected = !!selectedPlugins[pkg.name];

                            return (
                                <Grid key={pkg.name} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <Card
                                        onClick={() =>
                                            setSelectedPlugins(prev => ({
                                                ...prev,
                                                [pkg.name]: !prev[pkg.name]
                                            }))
                                        }
                                        sx={{
                                            cursor: 'pointer',
                                            border: '2px solid',
                                            borderColor: selected ? 'primary.main' : 'grey.200',
                                            background: selected
                                                ? 'linear-gradient(135deg, rgba(69, 145, 251, 0.15), rgba(0, 52, 255, 0.1))'
                                                : 'white',
                                            transition: 'all 0.2s ease',
                                            height: '100%',
                                            '&:hover': {
                                                boxShadow: 4,
                                                borderColor: selected ? 'primary.main' : 'grey.300',
                                            },
                                        }}
                                    >
                                        <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                                    {pkg.name}
                                                </Typography>

                                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <Chip
                                                        label={`v${pkg.version}`}
                                                        size="small"
                                                        variant="outlined"
                                                        color="default"
                                                    />
                                                    {pkg.source && (
                                                        <Chip
                                                            label={pkg.source}
                                                            size="small"
                                                            color={pkg.source === 'local' ? 'info' : 'default'}
                                                            variant={pkg.source === 'local' ? 'filled' : 'outlined'}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>

                                            {selected && (
                                                <Icon sx={{ color: 'success.main', alignSelf: 'center', fontSize: 24 }}>
                                                    check_circle
                                                </Icon>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
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
