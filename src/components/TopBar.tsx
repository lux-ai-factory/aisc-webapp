import {
    AppBar,
    Box,
    Button,
    createTheme,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Link,
    TextField,
    Toolbar,
    Typography
} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useProject} from '../context/ProjectContext';
import {API_VERSION_PREFIX} from '../config';
import {ThemeProvider} from '@emotion/react';
import {useNavigate} from 'react-router-dom';

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
}> = ({open, onClose, onAdd}) => {
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
    onAddProject: (name: string) => void;
}> = ({onAddProject}) => {
    const [dialogOpen, setDialogOpen] = useState(false);


    return (
        <ThemeProvider theme={darkTheme}>
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
    const {setProjectUUID, projectName, setProjectName} = useProject();
    const [projects, setProjects] = useState<Project[]>([]);

    const navigate = useNavigate();

    const fetchProjects = async () => {
        const data = await apiCall('/projects');
        if (data) setProjects(data);
    };

    const addProject = async (name: string) => {
        const newProject = await apiCall('/projects', 'POST', {name});
        if (newProject) {
            setProjects([...projects, newProject]);
            setProjectUUID(newProject.pid);
            setProjectName(newProject.name);

            const redirectUrl = `/projects/${newProject.name}/settings`;
            navigate(redirectUrl)
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <AppBar position="fixed" sx={{zIndex: (theme) => theme.zIndex.drawer + 1}} style={{backgroundColor: '#001075'}}>
            <Toolbar>
                <Box style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>

                    <Link
                        href="/"
                        underline="none"
                        color="inherit"
                    >
                        <Box display="flex" alignItems="center" gap={1}>
                            <img
                                src="/laif_logo.png"
                                alt="Luxembourg AI Factory Logo"
                                height={50}
                            />
                            <Typography
                                variant="h6"
                                noWrap
                                component="div"
                            >
                                AI Testing Sandbox
                            </Typography>
                        </Box>
                    </Link>
                    <Typography variant="h6" component="div">
                        {projectName ? `/ ${projectName}` : ""}
                    </Typography>
                </Box>

                <div style={{flexGrow: 1}}/>
                <ProjectSelector
                    onAddProject={addProject}
                />
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
