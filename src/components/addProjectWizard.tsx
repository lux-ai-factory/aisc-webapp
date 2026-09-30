import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
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
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import CloudUpload from "@mui/icons-material/CloudUpload";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
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
    plugins: PluginItem[];
    fetchPlugins: () => void;
}

export default function AddProjectWizard({
    open,
    onClose,
    onFinish,
    plugins,
    fetchPlugins
}: AddProjectWizardProps) {
    const [activeStep, setActiveStep] = useState(0);

    const [projectName, setProjectName] = useState("");

    const [localComponents, setLocalComponents] = useState<ComponentItem[]>([]);

    const [selectedPlugins, setSelectedPlugins] = useState<Record<string, boolean>>({});

    const groupedPlugins = useMemo(() => {
        const seen = new Set<string>();
        return plugins.filter(p => {
            if (!p.name || seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
        });
    }, [plugins]);

    const steps = ["Project Name", "Components", "Plugins"];

    // Load wizard data ONLY when the wizard opens
    useEffect(() => {
        if (open) {
            fetchPlugins();

            // Reset wizard state
            setActiveStep(0);
            setProjectName("");
            setLocalComponents([]);
            setSelectedPlugins({});
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
        const allEntries: Record<string, { name: string; version: string }> = {};
        plugins.forEach((p, i) => {
            if (selectedPlugins[p.name]) {
                allEntries[String(i)] = { name: p.name, version: p.version };
            }
        });
        onFinish({
            name: projectName,
            components: localComponents,
            plugins: allEntries
        });
        onClose();
    };

    const componentsValid = localComponents.every(
        c => c.name.trim().length > 0 && c.file
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

                {/* PLUGINS (now packages) */}
                {activeStep === 2 && (
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
                                        className="plugins-card"
                                        sx={{
                                            border: '2px solid',
                                            borderColor: selected ? 'primary.main' : 'grey.200',
                                            background: selected
                                                ? 'linear-gradient(135deg, rgba(69, 145, 251, 0.15), rgba(0, 52, 255, 0.1))'
                                                : 'white',
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
                </Box>
            </DialogContent>
        </Dialog>
    );
}
