import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';

import LeftBar from './components/LeftBar';
import ModelPerformance from './pages/ModelPerfromance';
import { Route, Routes } from 'react-router-dom';
import NotFound from './pages/NotFound';
import Construction from './pages/Construction';
import TopBar from './components/TopBar';
import DataDrift from './pages/DataDrift';
import StartEvaluation from './pages/StartEvaluation';
import SettingsPage from './pages/Settings';
import GlobalHome from './pages/GlobalHome';
import ProjectHome from './pages/ProjectHome';

/** Width of the left drawer in pixels */
const drawerWidth = 320;

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
        { id: 2, name: 'Project', path: '/projects/:project_pid', element: <ProjectHome /> },
        { id: 3, name: 'Start evaluation', path: '/start-eval', element: <StartEvaluation />},
        { id: 4, name: 'Training Data', path: '/training-data' },
        { id: 5, name: 'Data Anomalies', path: '/data-anomalies' },
        { id: 6, name: 'Data Drift', path: '/data-drift', element: <DataDrift /> },
        { id: 7, name: 'Model Accuracy', path: '/model-accuracy', element: <ModelPerformance /> },
        { id: 8, name: 'Model Robustness', path: '/model-robustness' },
        { id: 9, name: 'Model Fairness', path: '/model-fairness' },
        { id: 10, name: 'Report', path: '/report' },
        { id: 11, name: 'Settings', path: '/settings', element: <SettingsPage/> }
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
