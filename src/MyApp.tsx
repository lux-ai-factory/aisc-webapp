import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';

import LeftBar from './components/LeftBar';
import ModelPerformance from './pages/ModelPerfromance';
import RegressionPerformance from './pages/RegressionPerformance';
import { Route, Routes } from 'react-router-dom';
import NotFound from './pages/NotFound';
import Construction from './pages/Construction';
import TopBar from './components/TopBar';
import DataDrift from './pages/DataDrift';
import StartEvaluation from './pages/StartEvaluation';
import SettingsPage from './pages/Settings';
import GlobalHome from './pages/GlobalHome';
import ProjectHome from './pages/ProjectHome';
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from './context/ProjectContext'; // adjust import as needed
import { API_VERSION_PREFIX } from './config';
import DataOverview from './pages/DataOverview';

/** Width of the left drawer in pixels */
const drawerWidth = 320;
const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


type ProjectContextWrapperProps = {
    children: React.ReactNode;
};

const ProjectContextWrapper: React.FC<ProjectContextWrapperProps> = ({ children }) => {
    const { setProjectUUID, setProjectName } = useProject();
    const { project_name } = useParams();

    useEffect(() => {
        if (!project_name) return;

        fetch(`${API_URL}/projects/by-name/${project_name}`).then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
            .then((data) => {
                setProjectName(data.name)
                setProjectUUID(data.pid);
            })


    }, [project_name]);

    return <>{children}</>;
};


/**
 * Main application layout component
 * Implements a permanent left drawer layout with Material-UI
 * Contains the main navigation structure and routing setup
 *
 * @returns {JSX.Element} The main application layout with navigation and content area
 */
export default function PermanentDrawerLeft() {

    /**
     * Navigation configuration array
     * Defines all available routes and their corresponding components
     * If a route doesn't have an element, it will show the Construction component
     */
    const navs = [
        { id: 1, name: 'Home', path: '/', element: <GlobalHome /> },
        { id: 2, name: 'Project', path: '/projects/:project_name', element: <ProjectContextWrapper><ProjectHome /></ProjectContextWrapper> },
        { id: 3, name: 'Start evaluation', path: '/projects/:project_name/start-eval', element: <ProjectContextWrapper><StartEvaluation /></ProjectContextWrapper> },
        { id: 4, name: 'Training Data', path: '/projects/:project_name/training-data', element: <ProjectContextWrapper><Construction title="Training Data" /></ProjectContextWrapper> },
        { id: 13, name: 'Data Overview', path: '/projects/:project_name/data-overview', element: <ProjectContextWrapper><DataOverview /></ProjectContextWrapper> },
        { id: 5, name: 'Data Anomalies', path: '/projects/:project_name/data-anomalies', element: <ProjectContextWrapper><Construction title="Data Anomalies" /></ProjectContextWrapper> },
        { id: 6, name: 'Data Drift', path: '/projects/:project_name/data-drift', element: <ProjectContextWrapper><DataDrift /></ProjectContextWrapper> },
        {
            id: 7, name: 'Model Accuracy', path: '/projects/:project_name/model-accuracy', element: (<ProjectContextWrapper><ModelPerformance /></ProjectContextWrapper>)
        },
        {
            id: 12, name: 'Regression Accuracy', path: '/projects/:project_name/regression-accuracy', element: (<ProjectContextWrapper><RegressionPerformance /></ProjectContextWrapper>)
        },
        { id: 8, name: 'Model Robustness', path: '/projects/:project_name/model-robustness', element: <ProjectContextWrapper><Construction title="Model Robustness" /></ProjectContextWrapper> },
        { id: 9, name: 'Model Fairness', path: '/projects/:project_name/model-fairness', element: <ProjectContextWrapper><Construction title="Model Fairness" /></ProjectContextWrapper> },
        { id: 10, name: 'Report', path: '/projects/:project_name/report', element: <ProjectContextWrapper><Construction title="Report" /></ProjectContextWrapper> },
        {
            id: 11, name: 'Settings', path: '/projects/:project_name/settings', element: (
                <ProjectContextWrapper>
                    <SettingsPage />
                </ProjectContextWrapper>
            )
        }
    ];
    return (
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <CssBaseline />
            <TopBar />
            <LeftBar drawerWidth={drawerWidth} />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    bgcolor: 'background.default',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'left',
                    maxWidth: 'lg',
                    margin: '0 auto',
                    width: '100%'
                }}
            >
                <Toolbar />

                <Routes>
                    {
                        navs.map((nav) => {
                            if (!nav.element) {
                                return (
                                    <Route key={nav.id} path={nav.path} element={<Construction title={nav.name} />} />
                                );
                            }
                            return (
                                <Route key={nav.id} path={nav.path} element={nav.element} />
                            );
                        })
                    }

                    <Route path='*' element={<NotFound />} />

                </Routes>

            </Box>
        </Box>
    );
}
