import { AppBar, Toolbar, Typography } from '@mui/material';
import React from 'react';

const TopBar: React.FC = () => {
    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }} className='gradient'>
            <Toolbar>
                <Typography variant="h6" noWrap component="div">
                    A4S - AI Testing Sandbox
                </Typography>
            </Toolbar>
        </AppBar>
    );
};

export default TopBar;