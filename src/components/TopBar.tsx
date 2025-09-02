import { AppBar, Box, Button, createTheme, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, TextField, Toolbar, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { API_VERSION_PREFIX } from '../config';
import { ThemeProvider } from '@emotion/react';

interface Project {
    pid: string;
    name: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const apiCall = async (url: string, method: string = 'GET', body?: any) => {
    try {
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(API_URL + url, options);
        return response.ok ? await response.json() : null;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
};

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const AddProjectDialog: React.FC<{
    open: boolean;
    onClose: () => void;
    onAdd: (name: string) => void;
}> = ({ open, onClose, onAdd }) => {
    const [projectName, setProjectName] = useState('');
    const [nameError, setNameError] = useState(false);

    const handleSubmit = () => {
        if (projectName.trim().length >= 3) {
            onAdd(projectName.trim());
            setProjectName('');
            setNameError(false);
            onClose();
        } else {
            setNameError(true);
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Project Name"
                    fullWidth
                    value={projectName}
                    onChange={(e) => {
                        setProjectName(e.target.value);
                        if (e.target.value.trim().length >= 3) {
                            setNameError(false);
                        }
                    }}
                    error={nameError}
                    helperText={nameError ? "Project name must be at least 3 characters" : ""}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit}>Add</Button>
            </DialogActions>
        </Dialog>
    );

};

const ProjectSelector: React.FC<{
    projectUUID: string | null;
    handleProjectChange: (event: SelectChangeEvent<string | null>) => void;
    projects: Project[];
    onAddProject: (name: string) => void;
}> = ({ projectUUID, handleProjectChange, projects, onAddProject }) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    const loading = !projects.length;

    return (
        <ThemeProvider theme={darkTheme}>
            {!loading && (
                <FormControl variant="standard" sx={{ minWidth: '14rem', mr: 2 }}>
                    <InputLabel id="project-select-label">Select a project</InputLabel>
                    <Select
                        labelId="project-select-label"
                        id="project-select"
                        value={projectUUID}
                        onChange={handleProjectChange}
                    >
                        {projects.map((project) => (
                            <MenuItem key={project.pid} value={project.pid}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
            <Button
                variant="contained"
                color="primary"
                onClick={() => setDialogOpen(true)}
            >
                Add Project
            </Button>
            <AddProjectDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onAdd={onAddProject}
            />
        </ThemeProvider>
    );
};

const TopBar: React.FC = () => {
    const { projectUUID, setProjectUUID, projectName, setProjectName } = useProject();
    const [projects, setProjects] = useState<Project[]>([]);

    const fetchProjects = async () => {
        const data = await apiCall('/projects');
        if (data) setProjects(data);
    };

    const addProject = async (name: string) => {
        const newProject = await apiCall('/projects', 'POST', { name });
        if (newProject) {
            setProjects([...projects, newProject]);
            setProjectUUID(newProject.pid);
            setProjectName(newProject.name);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleProjectChange = (event: SelectChangeEvent<string | null>) => {
        const selectedProjectUUID = event.target.value as string;
        setProjectUUID(selectedProjectUUID);
        const selectedProject = projects.find(p => p.pid === selectedProjectUUID);
        if (selectedProject) {
            setProjectName(selectedProject.name);
        }
    };

    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} className='gradient'>
            <Toolbar>
                <Box style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Typography variant="h6" noWrap component="div">
                        A4S - AI Testing Sandbox
                    </Typography>
                    <Typography variant="h6" component="div">
                        {projectName ? `/ ${projectName}` : ""}
                    </Typography>
                </Box>

                <div style={{ flexGrow: 1 }} />
                <ProjectSelector
                    projectUUID={projectUUID}
                    handleProjectChange={handleProjectChange}
                    projects={projects}
                    onAddProject={addProject}
                />
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
