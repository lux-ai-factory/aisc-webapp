import {
    Box,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { API_VERSION_PREFIX } from "../config";
import { useProject } from "../context/ProjectContext";

const validators = {
    projectName: (name: string) => {
        if (name.trim().length < 3) {
            return {
                isValid: false,
                error: "Project name must be at least 3 characters"
            };
        }
        return { isValid: true };
    },

    frequency: (frequency: string) => {
        if (!frequency.trim()) return { isValid: true };
        const pattern = /^\d+\s*[DWMY]$/i;
        if (!pattern.test(frequency)) {
            return {
                isValid: false,
                error: 'Format should be like "30D", "2W", "1M", or "1Y"'
            };
        }
        return { isValid: true };
    },

    windowSize: (windowSize: string) => {
        if (!windowSize.trim()) return { isValid: true };
        const pattern =
            /^\d+\s+(day|days|week|weeks|month|months|year|years)$/i;
        if (!pattern.test(windowSize)) {
            return {
                isValid: false,
                error:
                    'Format should be like "90 days", "1 week", "3 months", or "2 years"'
            };
        }
        return { isValid: true };
    }
};

interface MinimalProject {
    pid: string;
    name: string;
    frequency: string;
    window_size: string;
}



interface ProjectResponse {
    project_pid: string;
    name: string;
    status: string;
    frequency: string;
    window_size: string;
    dataset: Array<{
        id: number;
        dataset_pid: string;
        name: string;
        data: string;
        project_id: number;
        datashape_id: number;
    }>;
    model: Array<{
        model_pid: string;
        name: string;
        data: string;
        project_id: number;
        dataset_id: number;
    }>;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

function ProjectDetails() {
    const [project, setProject] = useState<MinimalProject | null>(null);
    const [fetchedProject, setFetchedProject] = useState<MinimalProject | null>(null);

    const [loading, setLoading] = useState(true);
    const [edited, setEdited] = useState(false);

    const { projectUUID } = useProject();
    const [errors, setErrors] = useState<{
        name?: string;
        frequency?: string;
        window_size?: string;
    }>({});

    useEffect(() => {
        async function fetchProject() {
            try {
                const response = await fetch(
                    `${API_URL}/projects/${projectUUID}`
                );
                const data: ProjectResponse = await response.json();


                const minimal: MinimalProject = {
                    pid: data.project_pid,
                    name: data.name ?? '',
                    frequency: data.frequency ?? '',
                    window_size: data.window_size ?? ''
                };
                setProject(minimal);
                setFetchedProject(minimal);
            } catch (error) {
                console.error("Error fetching project:", error);
            } finally {
                setLoading(false);
            }
        }

        if (projectUUID) {
            fetchProject();
        }
    }, [projectUUID]);


    useEffect(() => {
        // compare if fetchedProject and project are the same
        if (fetchedProject && project) {
            const isSame =
                fetchedProject.name.trim() === project.name.trim() &&
                fetchedProject.frequency.trim() === project.frequency.trim() &&
                fetchedProject.window_size.trim() === project.window_size.trim();
            setEdited(!isSame);
        }
    }, [fetchedProject, project]);

    if (loading || !project) {
        return <CircularProgress />;
    }

    const handleChange = (field: keyof MinimalProject, value: string) => {
        // update field in project state
        setProject((prev) => (prev ? { ...prev, [field]: value } : prev));

        // run validation
        let validation: { isValid: boolean; error?: string } | undefined;
        if (field === "name") {
            validation = validators.projectName(value);
        } else if (field === "frequency") {
            validation = validators.frequency(value);
        } else if (field === "window_size") {
            validation = validators.windowSize(value);
        }

        setErrors((prev) => ({
            ...prev,
            [field]: validation?.error
        }));


    };

    const handleSave = async () => {
        if (!project || !projectUUID) return;

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/projects/${projectUUID}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: project.name,
                    frequency: project.frequency,
                    window_size: project.window_size,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update project');
            }

            const updatedProject: ProjectResponse = await response.json();
            const minimal: MinimalProject = {
                pid: updatedProject.project_pid,
                name: updatedProject.name ?? '',
                frequency: updatedProject.frequency ?? '',
                window_size: updatedProject.window_size ?? ''
            };

            setProject(minimal);
            setFetchedProject(minimal);
            setEdited(false);
        } catch (error) {
            console.error('Error updating project:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Stack spacing={3}>
                <TextField
                    label="Project Name"
                    value={project?.name ?? ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    fullWidth
                    required
                    error={!!errors.name}
                    helperText={errors.name || "A descriptive name for your AI project"}
                />

                <TextField
                    label="Frequency (Optional)"
                    value={project?.frequency ?? ''}
                    onChange={(e) => handleChange('frequency', e.target.value)}
                    fullWidth
                    error={!!errors.frequency}
                    helperText={
                        errors.frequency ||
                        "Data frequency for time-series analysis (e.g., '30D', '1M')."
                    }
                    placeholder="e.g., 30D, 1M, 1W"
                />

                <TextField
                    label="Window Size (Optional)"
                    value={project?.window_size ?? ''}
                    onChange={(e) => handleChange('window_size', e.target.value)}
                    fullWidth
                    error={!!errors.window_size}
                    helperText={
                        errors.window_size ||
                        "Analysis window size (e.g., '90 days', '3 months')."
                    }
                    placeholder="e.g., 90 days, 3 months"
                />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!edited || Object.values(errors).some(error => !!error)}
                            onClick={handleSave}
                        >
                            Save Changes
                        </Button>
                    </Box>
            </Stack>
        </Box>
    );
}

export default function SettingsPage() {
    return (
        <Box sx={{ width: 1 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Project settings
            </Typography>

            <Typography component="h3" variant="h5" gutterBottom sx={{ mt: 4 }}>
                Project Details
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Configure your project's basic information and settings.
            </Typography>
            <ProjectDetails />

            <Typography component="h3" variant="h5" gutterBottom sx={{ mt: 4 }}>
                Datasets & Models
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Set up the datasets and models.
            </Typography>

            <Typography component="h3" variant="h5" gutterBottom sx={{ mt: 4 }}>
                Advanced Options
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Configure additional project settings and preferences.
            </Typography>
        </Box>
    );
}
