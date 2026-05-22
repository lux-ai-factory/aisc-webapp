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
import {API_VERSION_PREFIX} from '../config';
import {ThemeProvider} from '@emotion/react';
import {useNavigate} from 'react-router-dom';
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

// I comment this because its no longer being used with the new wizard
// const AddProjectDialog: React.FC<{
//     open: boolean;
//     onClose: () => void;
//     onAdd: (name: string) => void;
// }> = ({open, onClose, onAdd}) => {
//     const [projectName, setProjectName] = useState('');
//     const [nameError, setNameError] = useState(false);
//
//     const handleSubmit = () => {
//         if (projectName.trim().length >= 3) {
//             onAdd(projectName.trim());
//             setProjectName('');
//             setNameError(false);
//             onClose();
//         } else {
//             setNameError(true);
//         }
//     };
//
//     return (
//         <Dialog
//             open={open}
//             onClose={onClose}
//             slotProps={{
//                 paper: {
//                     sx: {
//                         backgroundColor: "#0048ff", // fallback base
//                         backgroundImage: "linear-gradient(135deg, #001075, #0020b5)",
//                         borderRadius: "16px",
//                         padding: "8px 0",
//                         boxShadow: "none",
//                     }
//                 }
//             }}
//
//         >
//             <DialogTitle sx={{ color: "white" }}>Add New Project</DialogTitle>
//
//             <DialogContent sx={{ color: "white" }}>
//                 <TextField
//                     autoFocus
//                     margin="dense"
//                     label="Project Name"
//                     fullWidth
//                     value={projectName}
//                     onChange={(e) => {
//                         setProjectName(e.target.value);
//                         if (e.target.value.trim().length >= 3) {
//                             setNameError(false);
//                         }
//                     }}
//                     error={nameError}
//                     helperText={nameError ? "Project name must be at least 3 characters" : ""}
//                     variant="outlined"
//                     InputProps={{
//                         sx: {
//                             color: "white", // text color
//                             "& .MuiOutlinedInput-notchedOutline": {
//                                 borderColor: "white",
//                             },
//                             "&:hover .MuiOutlinedInput-notchedOutline": {
//                                 borderColor: "white",
//                             },
//                             "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
//                                 borderColor: "white",
//                             },
//                         }
//                     }}
//                     InputLabelProps={{
//                         sx: {
//                             color: "white",
//                             "&.Mui-focused": {
//                                 color: "white",
//                             }
//                         }
//                     }}
//                 />
//             </DialogContent>
//             <DialogActions>
//                 <Button onClick={onClose}>Cancel</Button>
//                 <Button onClick={handleSubmit}>Add</Button>
//             </DialogActions>
//         </Dialog>
//     );
//
// };

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
        // const data = await apiCall('/datasets');'
        const data = null;
        if (data) setDatasets(data);
    };

    const fetchModels = async () => {
        // const data = await apiCall('/models');
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




    const {setProjectUUID, projectName, setProjectName} = useProject();
    const [projects, setProjects] = useState<Project[]>([]);

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

        // 2. Create DATASETS (exact same as DatasetSettings)
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

            // 2b. Upload dataset file
            if (ds.file) {
                const formData = new FormData();
                formData.append("file", ds.file);

                await fetch(`${API_URL}/datasets/${ds.pid}/data`, {
                    method: "PUT",
                    body: formData
                });
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

            // 3b. Upload model file
            if (m.file) {
                const formData = new FormData();
                formData.append("file", m.file);

                await fetch(`${API_URL}/models/${m.pid}/data`, {
                    method: "PUT",
                    body: formData
                });
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
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            m: 0,
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
                    </Link>
                    {projectName && (
                        <Typography
                            variant="h6"
                            component="span"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 1.5
                            }}
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


            </Toolbar>
        </AppBar>
    );
};

export default TopBar;
