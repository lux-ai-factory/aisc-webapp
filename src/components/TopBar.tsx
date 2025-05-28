import { AppBar, Toolbar, Typography } from '@mui/material';
import React from 'react';

/**
 * TopBar component
 * Renders the application's top navigation bar with the A4S branding
 * Uses Material-UI's AppBar with a custom gradient background
 * Fixed position with elevated z-index to stay above other content
 * 
 * @returns {JSX.Element} A fixed position top bar with the application title
 */
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