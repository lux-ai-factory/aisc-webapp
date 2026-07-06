import {
    AppBar,
    Box,
    Button,
    createTheme,
    Icon,
    Link,
    Toolbar,
    Typography
} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useProject} from '../context/ProjectContext';
import {useAuth} from '../context/AuthContext';
import {API_VERSION_PREFIX} from '../config';
import {ThemeProvider} from '@emotion/react';
import {useNavigate} from 'react-router-dom';
import toast from 'react-hot-toast';
import "./TopBar.css";
import "./addProjectButton.css";
import AddProjectWizard from "./addProjectWizard.tsx";


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

const ProjectSelector: React.FC<{
    onAddProject: (wizardData: any) => void;
    datasets: any[];
    models: any[];
    plugins: any[];
    fetchDatasets: () => void;
    fetchModels: () => void;
    fetchPlugins: () => void;
}> = ({ onAddProject, datasets, models, plugins, fetchDatasets, fetchModels, fetchPlugins }) => {
    const [wizardOpen, setWizardOpen] = useState(false);

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
                datasets={datasets}
                models={models}
                plugins={plugins}
                fetchDatasets={fetchDatasets}
                fetchModels={fetchModels}
                fetchPlugins={fetchPlugins}
            />
        </>
    );
};


const TopBar: React.FC = () => {
    const [datasets, setDatasets] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [plugins, setPlugins] = useState<any[]>([]);

    const fetchDatasets = async () => {
        const data = null;
        if (data) setDatasets(data);
    };

    const fetchModels = async () => {
        const data = null;
        if (data) setModels(data);
    };

    const fetchPlugins = async () => {
        const data = await apiCall('/plugins');
        if (!data) return;

        const normalized = data.map((p: any) => ({
            name: p.package_name,
            version: p.version,
            source: p.source
        }));

        setPlugins(normalized);
    };




    const {setProjectUUID, projectName, setProjectName, addFileUploadingPid, removeFileUploadingPid} = useProject();
    const [projects, setProjects] = useState<Project[]>([]);

    // Keycloak auth: who is logged in + login/logout actions
    const {authenticated, username, login, logout} = useAuth();

    const navigate = useNavigate();

    const fetchProjects = async () => {
        const data = await apiCall('/projects');
        if (data) setProjects(data);
    };

    const addProject = async (wizardData: any) => {
        const { name, datasets, models, plugins } = wizardData;

        // 1. Create project
        const newProject = await apiCall('/projects', 'POST', { name });
        if (!newProject) return;

        setProjects([...projects, newProject]);

        const uploads: Promise<unknown>[] = [];

        // 2. Create DATASETS
        for (const ds of datasets) {
            if (!ds.name || ds.name.trim().length < 1) continue;

            // 2a. Create dataset row
            const created = await fetch(
                `${API_URL}/projects/${newProject.pid}/datasets`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: ds.name })
                }
            ).then(r => r.json());

            ds.pid = created.pid;

            // 2b. Add dataset file to uploads
            if (ds.file) {
                addFileUploadingPid(ds.pid);
                const formData = new FormData();
                formData.append("file", ds.file);
                uploads.push(
                    fetch(`${API_URL}/datasets/${ds.pid}/data`, { method: "PUT", body: formData }).then(() => {
                        toast.success(`Dataset \`${ds.name}\` uploaded`, { position: 'bottom-right' });
                    }).finally(() => removeFileUploadingPid(ds.pid))
                );
            }
        }

        // 3. Create MODELS
        for (const m of models) {
            if (!m.name || m.name.trim().length < 1) continue;

            // 3a. Create model row
            const created = await fetch(
                `${API_URL}/projects/${newProject.pid}/models`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: m.name })
                }
            ).then(r => r.json());

            m.pid = created.pid;

            // 3b. Add model file to uploads
            if (m.file) {
                addFileUploadingPid(m.pid);
                const formData = new FormData();
                formData.append("file", m.file);
                uploads.push(
                    fetch(`${API_URL}/models/${m.pid}/data`, { method: "PUT", body: formData }).then(() => {
                        toast.success(`Model \`${m.name}\` uploaded`, { position: 'bottom-right' });
                    }).finally(() => removeFileUploadingPid(m.pid))
                );
            }
        }

        // 4. Enable all packages in parallel
        await Promise.all(Object.keys(plugins).map(async (key) => {
            const pkg = plugins[key];
            await fetch(`${API_URL}/plugins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    package_name: pkg.name,
                    version: pkg.version,
                    project_uuid: newProject.pid,
                    config: null
                }),
            });
        }));

        setProjectUUID(newProject.pid);
        setProjectName(newProject.name);

        // 5. Navigate
        navigate(`/projects/${newProject.name}/plugins`);

        // 6. Upload files in background
        await Promise.allSettled(uploads);
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
                        className="topbar-link"
                        sx={{ m: 0 }}
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
                                sx={{ ml: 0 }}
                            >
                                AI Assessment Sandbox
                            </Typography>
                        </Box>
                    </Link>
                    {projectName && (
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
                <ProjectSelector
                    onAddProject={addProject}
                    datasets={datasets}
                    models={models}
                    plugins={plugins}
                    fetchDatasets={fetchDatasets}
                    fetchModels={fetchModels}
                    fetchPlugins={fetchPlugins}
                />

                {/* Keycloak login / logout */}
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, ml: 2}}>
                    {authenticated ? (
                        <>
                            <Typography variant="body1" data-testid="auth-username">
                                {username}
                            </Typography>
                            <Button color="inherit" variant="outlined" data-testid="logout-button"
                                    onClick={() => logout()}>
                                Logout
                            </Button>
                        </>
                    ) : (
                        <Button color="inherit" variant="outlined" data-testid="login-button"
                                onClick={() => login()}>
                            Login
                        </Button>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
