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
        </ThemeProvider>
    );
};


const TopBar: React.FC = () => {
    const [datasets, setDatasets] = useState([]);
    const [models, setModels] = useState([]);
    const [plugins, setPlugins] = useState([]);

    const fetchDatasets = async () => {
        const data = await apiCall('/datasets');
        if (data) setDatasets(data);
    };

    const fetchModels = async () => {
        const data = await apiCall('/models');
        if (data) setModels(data);
    };

    const fetchPlugins = async () => {
        const data = await apiCall('/plugins');
        if (!data) return;

        // Convert string plugins → objects with a name field
        const normalized = data.map((p: string) => ({
            name: p
        }));

        // Fetch display icons for each plugin
        const withIcons = await Promise.all(
            normalized.map(async (p) => {
                const icon = await apiCall(`/plugins/${p.name}/display_icon`);
                return {
                    ...p,
                    display_icon: icon || "extension"
                };
            })
        );

        setPlugins(withIcons);
    };




    const {setProjectUUID, projectName, setProjectName} = useProject();
    const [projects, setProjects] = useState<Project[]>([]);

    const navigate = useNavigate();

    const fetchProjects = async () => {
        const data = await apiCall('/projects');
        if (data) setProjects(data);
    };

    const addProject = async (wizardData: any) => {
        const { name, dataset, model, plugins } = wizardData;

        const newProject = await apiCall('/projects', 'POST', { name });
        if (!newProject) return;

        setProjects([...projects, newProject]);
        setProjectUUID(newProject.pid);
        setProjectName(newProject.name);

        await apiCall(`/projects/${newProject.pid}/dataset`, 'POST', { dataset });
        await apiCall(`/projects/${newProject.pid}/model`, 'POST', { model });

        // Im starting the configs null so we configure them later
        for (const pluginName of Object.keys(plugins)) {
            await apiCall('/plugins', 'POST', {
                name: pluginName,
                project_uuid: newProject.pid,
                config: null
            });
        }

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
