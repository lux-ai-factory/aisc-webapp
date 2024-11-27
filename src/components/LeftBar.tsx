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
import { Link } from 'react-router-dom';

interface MenuListProps { title: string, items: { text: string, icon: React.ReactNode, target: string }[] }

function MenuList(props: MenuListProps) {
    return (<List>

        {props.title && (
            <ListItem>
                <ListItemText primary={props.title} />
            </ListItem>
        )}
        {props.items.map((item, index) => (
            <ListItem key={index} disablePadding>
                <ListItemButton component={Link} to={item.target}>
                    <ListItemIcon>
                        {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                </ListItemButton>
            </ListItem>
        ))}
    </List>);
}

interface LeftBarProps {
    drawerWidth: number;
}

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
                ]} />

                <Divider />

                <MenuList title="Data" items={[
                    { text: 'Training Data Analysis', icon: <DatasetIcon />, target: '/training-data' },
                    { text: 'Data Anomalies', icon: <FlagIcon />, target: '/data-anomalies' },
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
