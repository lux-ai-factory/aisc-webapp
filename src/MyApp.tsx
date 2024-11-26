import * as React from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import LeftBar from './components/LeftBar';
import ModelPerformance from './pages/ModelPerfromance';

const drawerWidth = 320;

export default function PermanentDrawerLeft() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'row'}}>
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

                <ModelPerformance />
            </Box>
        </Box>
    );
}