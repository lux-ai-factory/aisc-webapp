import {
    AppBar,
    Box,
    Button,
    createTheme,
    Icon,
    Menu,
    MenuItem,
    Toolbar,
    Typography
} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useProject} from '../context/ProjectContext';
import {useAuth} from '../context/AuthContext';
import {API_VERSION_PREFIX} from '../config';
import {NavLink, useLocation} from 'react-router-dom';
import {ThemeProvider} from '@emotion/react';
import {useNavigate} from 'react-router-dom';
import toast from 'react-hot-toast';
import AppDialog from './AppDialog';
import "./TopBar.css";
import "./addProjectButton.css";
import AddProjectWizard from "./addProjectWizard.tsx";


interface Project {
    pid: string;
    name: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
const AUTH_ENABLED = String(import.meta.env.VITE_AUTH_ENABLED || "true").toLowerCase() !== "false";

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

const ProjectSelector: React.FC<{
    onAddProject: (wizardData: any) => void;
    authenticated: boolean;
}> = ({ onAddProject, authenticated }) => {
    const [wizardOpen, setWizardOpen] = useState(false);

    if (!authenticated) return null;

    return (
        <>
            <ThemeProvider theme={darkTheme}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => setWizardOpen(true)}
                    className="add-project-btn"
                >
                    <span className="icon"><Icon>add</Icon></span>
                    <span className="label">ADD PROJECT</span>
                </Button>
            </ThemeProvider>

            <AddProjectWizard
                open={wizardOpen}
                onClose={() => setWizardOpen(false)}
                onFinish={onAddProject}
            />
        </>
    );
};


const TopBar: React.FC = () => {
    const {setProjectUUID, projectName, setProjectName, addFileUploadingPid, removeFileUploadingPid} = useProject();
    const [projects, setProjects] = useState<Project[]>([]);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Keycloak auth: who is logged in + login/logout actions
    const {authenticated, username, login, logout} = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const isRootPage = location.pathname === '/';

    const fetchProjects = async () => {
        const data = await apiCall('/projects');
        if (data) setProjects(data);
    };

    const addProject = async (wizardData: any) => {
        const { name, components } = wizardData;

        // 1. Create project
        const newProject = await apiCall('/projects', 'POST', { name });
        if (!newProject) return;

        setProjects([...projects, newProject]);

        const uploads: Promise<unknown>[] = [];

        // 2. Create COMPONENT rows (dataset/model) and schedule background file uploads
        for (const c of components ?? []) {
            if (!c.name || c.name.trim().length < 1) continue;

            const created = await fetch(
                `${API_URL}/projects/${newProject.pid}/components`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: c.name, component_type: c.type })
                }
            ).then(r => r.json());

            c.pid = created.pid;

            if (c.file) {
                addFileUploadingPid(c.pid);
                const formData = new FormData();
                formData.append("file", c.file);
                uploads.push(
                    fetch(`${API_URL}/components/${c.pid}/data`, { method: "PUT", body: formData }).then(() => {
                        toast.success(`Component \`${c.name}\` uploaded`, { position: 'bottom-right' });
                    }).finally(() => removeFileUploadingPid(c.pid))
                );
            }
        }

        setProjectUUID(newProject.pid);
        setProjectName(newProject.name);

        // 4. Navigate
        navigate(`/projects/${newProject.name}/plugins`);

        // 5. Upload files in background
        await Promise.allSettled(uploads);
    };




    useEffect(() => {
        if (!authenticated) return;
        fetchProjects();
    }, [authenticated]);


    return (
        <AppBar position="fixed" className="brand-appbar" sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}>
            <Toolbar className="brand-toolbar">
                <Box style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>

                    <NavLink
                        to="/"
                        className="topbar-link"
                        onClick={() => {
                            setProjectUUID(null);
                            setProjectName(null);
                        }}
                    >
                        <Box display="flex" alignItems="center" gap={1}>
                            <img
                                src="/laif-logo.svg"
                                alt="Luxembourg AI Factory Logo"
                                height={48}
                            />
                            <Typography
                                variant="h6"
                                noWrap
                                component="div"
                                className="brand-title"
                                sx={{ ml: 0 }}
                            >
                                AISC
                            </Typography>
                        </Box>
                    </NavLink>
                    {projectName && !isRootPage && (
                        <Typography
                            variant="h6"
                            component="span"
                            className="topbar-project-name"
                            sx={{ gap: 1.5 }}
                        >
                            <span>|</span>
                            <span>{projectName}</span>
                        </Typography>
                    )}
                </Box>

                <div style={{flexGrow: 1}}/>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <ProjectSelector
                        onAddProject={addProject}
                        authenticated={authenticated}
                    />
                    {AUTH_ENABLED && (authenticated ? (
                        <Box className="auth-box">
                            <Button
                                color="inherit"
                                variant="text"
                                size="small"
                                onClick={(e) => setMenuAnchor(e.currentTarget)}
                                className="auth-user-btn"
                            >
                                {username}
                            </Button>
                            <Menu
                                anchorEl={menuAnchor}
                                open={Boolean(menuAnchor)}
                                onClose={() => setMenuAnchor(null)}
                                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                            >
                                <MenuItem disabled className="auth-username-item">
                                    {username}
                                </MenuItem>
                                <MenuItem onClick={() => { setMenuAnchor(null); setConfirmOpen(true); }}>
                                    Sign out
                                </MenuItem>
                            </Menu>
                        </Box>
                    ) : (
                        <Button color="inherit" variant="outlined" data-testid="login-button"
                                onClick={login}>
                            Sign in
                        </Button>
                    ))}
                </Box>
                {confirmOpen && (
                    <AppDialog
                        open={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        maxWidth="sm"
                        fullWidth
                        title="Sign out?"
                        actions={
                            <>
                                <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                                <Button variant="contained" color="error" onClick={() => { setConfirmOpen(false); logout(); }}>
                                    Sign out
                                </Button>
                            </>
                        }
                    >
                        <Typography>Are you sure you want to sign out?</Typography>
                    </AppDialog>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
