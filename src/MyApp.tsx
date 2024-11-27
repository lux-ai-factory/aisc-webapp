import * as React from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import LeftBar from './components/LeftBar';
import ModelPerformance from './pages/ModelPerfromance';
import { Route, Router, Link, BrowserRouter, Routes } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

const drawerWidth = 320;

export default function PermanentDrawerLeft() {

    const navs = [
        {id: 1, name: 'Home', path: '/', element: <Home/>},
        {id: 2, name: 'About', path: '/model-performance', element: <ModelPerformance />},
    ];
    return (
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} className='gradient'>
                <Toolbar>
                    <Typography variant="h6" noWrap component="div">
                        A4S - AI Testing Sandbox
                    </Typography>
                </Toolbar>
            </AppBar>
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
                            return (
                                <Route key={nav.id} path={nav.path} element={nav.element}/>
                            );
                        })
                    }

                    <Route path='*' element={<NotFound />} />

                </Routes>

            </Box>
        </Box>
    );
}