import * as React from 'react';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DatasetIcon from '@mui/icons-material/Dataset';
import FlagIcon from '@mui/icons-material/Flag';
import TimelineIcon from '@mui/icons-material/Timeline';
import SecurityIcon from '@mui/icons-material/Security';
import BalanceIcon from '@mui/icons-material/Balance';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';

/**
 * Props interface for the MenuList component
 * @interface MenuListProps
 * @property {string} title - The title of the menu section
 * @property {Array<{text: string, icon: React.ReactNode, target: string}>} items - Array of menu items
 */
interface MenuListProps { 
    title: string, 
    items: { text: string, icon: React.ReactNode, target: string }[] 
}

/**
 * MenuList component
 * Renders a section of the navigation menu with a title and list of items
 * Each item has an icon and links to a specific route
 * Highlights the currently active route
 * 
 * @param {MenuListProps} props - Component props
 * @returns {JSX.Element} A list of navigation items with icons and links
 */
function MenuList(props: MenuListProps) {

    const location = useLocation().pathname;

    return (<List>

        {props.title && (
            <ListItem>
                <ListItemText primary={props.title} />
            </ListItem>
        )}
        {props.items.map((item, index) => (
            <ListItem key={index} disablePadding>
                <ListItemButton component={Link} to={item.target} selected={location === item.target}>
                    <ListItemIcon>
                        {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                </ListItemButton>
            </ListItem>
        ))}
    </List>);
}

/**
 * Props interface for the LeftBar component
 * @interface LeftBarProps
 * @property {number} drawerWidth - The width of the drawer in pixels
 */
interface LeftBarProps {
    drawerWidth: number;
}

/**
 * LeftBar component
 * Main navigation drawer component for the application
 * Contains multiple sections of navigation items:
 * - Overview
 * - Data Analysis
 * - Model Evaluation
 * - Risk Management
 * 
 * Uses Material-UI's permanent drawer with custom width
 * 
 * @param {LeftBarProps} props - Component props
 * @returns {JSX.Element} A permanent drawer with navigation menu
 */
export default function LeftBar({ drawerWidth }: LeftBarProps) {
    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
        >
            <Toolbar />
            <Box sx={{ overflow: 'auto' }}>


                <MenuList title="" items={[
                    { text: 'Overview', icon: <DashboardIcon />, target: '/' },
                    { text: 'Start Evaluation', icon: <TimelineIcon />, target: '/start-eval' },
                ]} />

                <Divider />

                <MenuList title="Data" items={[
                    { text: 'Training Data Analysis', icon: <DatasetIcon />, target: '/training-data' },
                    { text: 'Data Anomalies', icon: <FlagIcon />, target: '/data-anomalies' },
                    { text: 'Data Drift', icon: <TimelineIcon />, target: '/data-drift' },
                ]} />
                <Divider />

                <MenuList title='Model Evaluation' items={[
                    { text: 'Accuracy and Correctness', icon: <TimelineIcon />, target: '/model-accuracy' },
                    { text: 'Robustness', icon: <SecurityIcon />, target: '/model-robustness' },
                    { text: 'Fairness', icon: <BalanceIcon />, target: '/model-fairness' },
                ]} />
                <Divider />
                <MenuList title='Risk Management' items={[
                    { text: 'Report Generation', icon: <AssignmentIcon />, target: '/report' },
                    { text: 'Settings & Alerts', icon: <SettingsIcon />, target: '/settings' },
                ]} />

            </Box>
        </Drawer >)
};
