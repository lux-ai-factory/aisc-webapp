import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';

import LeftBar from './components/LeftBar';
import ModelPerformance from './pages/ModelPerfromance';
import NewProject from './pages/NewProject';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Construction from './pages/Construction';
import TopBar from './components/TopBar';
import DataDrift from './pages/DataDrift';
const drawerWidth = 320;

export default function PermanentDrawerLeft() {

    const navs = [
        { id: 1, name: 'Home', path: '/', element: <Home /> },
        { id: 2, name: 'Training Data', path: '/training-data' },
        { id: 3, name: 'Data Anomalies', path: '/data-anomalies' },
        { id: 4, name: 'Data Drift', path: '/data-drift', element: <DataDrift /> },
        { id: 5, name: 'Model Accuracy', path: '/model-accuracy', element: <ModelPerformance /> },
        { id: 6, name: 'Model Robustness', path: '/model-robustness' },
        { id: 7, name: 'Model Fairness', path: '/model-fairness' },
        { id: 8, name: 'Report', path: '/report' },
        { id: 9, name: 'Settings', path: '/settings' },
        { id: 10, name: 'New Project', path: '/new-project', element:<NewProject /> }
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
                    alignItems: 'flex-start' // Ensures left-alignment as well
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
