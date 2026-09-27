import {
    AppBar,
    Box,
    Button,
    createTheme,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Icon,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
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
import "./TopBar.css";
import "./addProjectButton.css";
import AddProjectWizard from "./addProjectWizard.tsx";
import { openPublicCatalogue, isProtocolHandlerSupported } from "../pluginCatalogue/installUri.ts";
import { usePluginInstall } from "../pluginCatalogue/PluginInstallContext.tsx";
import {
    currentPlatformProject,
    projectPageUrl,
    projectsUrl,
} from "../platform/currentProject.ts";


interface Project {
    pid: string;
    name: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type ComponentType = "dataset" | "model";

/** A dataset or model row as the add-project wizard hands it over. */
interface WizardComponent {
    name: string;
    file?: File | null;
    pid?: string;
}

const UPLOAD_LABEL: Record<ComponentType, string> = { dataset: "Dataset", model: "Model" };

// The launcher: where the project was chosen and where the other five steps
// are. Substituted into the bundle at container start, like every other URL
// this app is told about.
const LAUNCHER_URL = (import.meta.env.VITE_LAUNCHER_URL as string) || 'http://localhost:8100/';

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
    authenticated: boolean;
}> = ({ onAddProject, datasets, models, plugins, fetchDatasets, fetchModels, fetchPlugins, authenticated }) => {
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
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Who the gateway says is signed in; signing in and out happen at the gateway.
    const {authenticated, username, login, logout} = useAuth();
    const {registerProtocol} = usePluginInstall();
    const [registering, setRegistering] = useState(false);
    const supportsProtocolHandler = isProtocolHandlerSupported();

    const navigate = useNavigate();
    const location = useLocation();
    const isRootPage = location.pathname === '/';

    const fetchProjects = async () => {
        // Only this project's workspaces: the launcher already decided which
        // project is being worked on.
        const data = await apiCall(projectsUrl('', currentPlatformProject()));
        if (data) setProjects(data);
    };

    const handleRegisterProtocol = async () => {
        setRegistering(true);
        // This is a user gesture, so it's safe to do the destructive
        // unregister-then-register to reset any cached refusal and force the
        // browser prompt to reappear.
        const status = await registerProtocol(true);
        setRegistering(false);
        if (status === 'registered') {
            toast.success('Deep-link protocol enabled.', { position: 'bottom-right' });
        } else if (status === 'unsupported') {
            toast.error('Protocol handlers need localhost or HTTPS.', { position: 'bottom-right' });
        } else {
            toast.error('Could not register the protocol handler.', { position: 'bottom-right' });
        }
    };

    /**
     * Create one component row per named wizard entry, in order, and queue the
     * upload of each attached file on `uploads`. The new pid is written back
     * onto the entry.
     */
    const createComponents = async (
        projectPid: string,
        entries: WizardComponent[],
        componentType: ComponentType,
        uploads: Promise<unknown>[],
    ) => {
        for (const entry of entries) {
            if (!entry.name || entry.name.trim().length < 1) continue;

            const created = await fetch(
                `${API_URL}/projects/${projectPid}/components`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: entry.name, component_type: componentType })
                }
            ).then(r => r.json());

            const pid: string = created.pid;
            entry.pid = pid;

            if (entry.file) {
                addFileUploadingPid(pid);
                const formData = new FormData();
                formData.append("file", entry.file);
                uploads.push(
                    fetch(`${API_URL}/components/${pid}/data`, { method: "PUT", body: formData }).then(() => {
                        toast.success(`${UPLOAD_LABEL[componentType]} \`${entry.name}\` uploaded`, { position: 'bottom-right' });
                    }).finally(() => removeFileUploadingPid(pid))
                );
            }
        }
    };

    const addProject = async (wizardData: any) => {
        const { name, datasets, models, plugins } = wizardData;

        // 1. Create project. When the launcher opened this engine on a project,
        // the workspace belongs to it: one list of projects for the platform.
        const platformProject = currentPlatformProject();
        const newProject = await apiCall('/projects', 'POST',
            platformProject ? { name, platform_project_id: platformProject } : { name });
        if (!newProject) return;

        setProjects([...projects, newProject]);

        const uploads: Promise<unknown>[] = [];

        // 2. Create DATASET components
        await createComponents(newProject.pid, datasets, "dataset", uploads);

        // 3. Create MODEL components
        await createComponents(newProject.pid, models, "model", uploads);

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
                    <Button
                        color="inherit"
                        variant="outlined"
                        size="small"
                        href={projectPageUrl(LAUNCHER_URL)}
                        aria-label="Back to the project"
                        sx={{textTransform: 'none'}}
                    >
                        <Icon sx={{fontSize: 18, mr: 0.5}}>arrow_back</Icon>
                        Back
                    </Button>
                    <Button
                        color="inherit"
                        variant="outlined"
                        size="small"
                        onClick={openPublicCatalogue}
                        className="catalogue-btn"
                        sx={{textTransform: 'none'}}
                    >
                        <Icon sx={{fontSize: 18, mr: 0.5}}>storefront</Icon>
                        Public Catalogue
                    </Button>
                    {supportsProtocolHandler && (
                        <Tooltip title="Register this app to handle one-click installs from the public catalogue">
                            <span>
                                <Button
                                    color="inherit"
                                    variant="outlined"
                                    size="small"
                                    disabled={registering}
                                    onClick={handleRegisterProtocol}
                                    sx={{textTransform: 'none', minWidth: 0}}
                                >
                                    <Icon sx={{fontSize: 18}}>link</Icon>
                                </Button>
                            </span>
                        </Tooltip>
                    )}
                    {/* Projects are created on the launcher, not here: inside
                        one, the engine has no project of its own to add. */}
                    {!currentPlatformProject() && (
                        <ProjectSelector
                            onAddProject={addProject}
                            datasets={datasets}
                            models={models}
                            plugins={plugins}
                            fetchDatasets={fetchDatasets}
                            fetchModels={fetchModels}
                            fetchPlugins={fetchPlugins}
                            authenticated={authenticated}
                        />
                    )}
                    {authenticated ? (
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
                    )}
                </Box>
                {confirmOpen && (
                    <Dialog
                        open={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        maxWidth="xs"
                    >
                        <DialogTitle>Sign out?</DialogTitle>
                        <DialogContent>
                            <Typography>Are you sure you want to sign out?</Typography>
                        </DialogContent>
                        <DialogActions className="auth-dialog-actions">
                            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                            <Button color="error" onClick={() => { setConfirmOpen(false); logout(); }}>
                                Sign out
                            </Button>
                        </DialogActions>
                    </Dialog>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
