import { AppBar, CircularProgress, createTheme, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Toolbar, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { API_VERSION_PREFIX } from '../config';
import { ThemeProvider } from '@emotion/react';

interface Project {
    project_pid: string;
    project_name: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const apiCall = async (url: string) => {
    try {
        const response = await fetch(API_URL + url);
        return response.ok ? await response.json() : null;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return null;
    }
};

/**
 * TopBar component
 * Renders the application's top navigation bar with the A4S branding
 * Uses Material-UI's AppBar with a custom gradient background
 * Fixed position with elevated z-index to stay above other content
 *
 * @returns {JSX.Element} A fixed position top bar with the application title
 */

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

function ProjectSelector(projectUUID: string | null, handleProjectChange: (event: SelectChangeEvent<string | null>) => void, projects: Project[]) {


    const loading = !projects.length;
    if (loading) {
        return <CircularProgress />;
    }

    return <ThemeProvider theme={darkTheme}>
        <FormControl variant="standard" sx={{ minWidth: '14rem' }}>
            <InputLabel id="project-select-label">Select a project </InputLabel>
            <Select
                labelId="project-select-label"
                id="project-select"
                value={projectUUID}
                onChange={handleProjectChange}
            >
                {projects.map((project) => (
                    <MenuItem key={project.project_pid} value={project.project_pid}>
                        {project.project_name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    </ThemeProvider>;
}

const TopBar: React.FC = () => {

    const { projectUUID, setProjectUUID, projectName, setProjectName } = useProject();

    const [projects, setProjects] = useState<Project[]>([]);

    const fetchProjects = async () => {
        const data = await apiCall(`/projects`);
        if (data) setProjects(data);
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleProjectChange = (event: SelectChangeEvent<string | null>) => {
        const selectedProjectUUID = event.target.value as string;
        setProjectUUID(selectedProjectUUID);
        const selectedProject = projects.find(p => p.project_pid === selectedProjectUUID);
        if (selectedProject) {
            setProjectName(selectedProject.project_name);
        }
    };


    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} className='gradient'>
            <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    A4S - AI Testing Sandbox - {projectName ? projectName : "Please select a project"}
                </Typography>
                <div style={{ flexGrow: 1 }} />
                {ProjectSelector(projectUUID, handleProjectChange, projects)}
            </Toolbar>

        </AppBar>
    );
};

export default TopBar;
