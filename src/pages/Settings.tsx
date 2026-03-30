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
import DatasetSettings from "../components/DatasetSettings";
import ModelSettings from "../components/ModelSettngs";

const validators = {
    projectName: (name: string) => {
        if (name.trim().length < 3) {
            return {
                isValid: false,
                error: "Project name must be at least 3 characters"
            };
        }
        return { isValid: true };
    }
};

interface MinimalProject {
    pid: string;
    name: string;
}



interface ProjectResponse {
    pid: string;
    name: string;
    status: string;
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
    }>({});

    useEffect(() => {
        async function fetchProject() {
            try {
                const response = await fetch(
                    `${API_URL}/projects/${projectUUID}`
                );
                const data: ProjectResponse = await response.json();


                const minimal: MinimalProject = {
                    pid: data.pid,
                    name: data.name ?? ''
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
                fetchedProject.name.trim() === project.name.trim()
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
                    name: project.name
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update project');
            }

            const updatedProject: ProjectResponse = await response.json();
            const minimal: MinimalProject = {
                pid: updatedProject.pid,
                name: updatedProject.name ?? ''
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Project id: {project?.pid}
            </Typography>
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

            <DatasetSettings/>
            <ModelSettings />
        </Box>
    );
}
