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
            <List>

                <ListItem key={0} disablePadding>
                        <ListItemButton>
                            <ListItemIcon>
                                <DashboardIcon  />
                            </ListItemIcon>
                            <ListItemText primary="Overview" />
                        </ListItemButton>
                </ListItem>
            </List>
            <Divider />
            <List>
                <ListItem>
                    <ListItemText primary="Data Quality" />
                </ListItem>
                {[
                    { text: 'Training Data Analysis', icon: <DatasetIcon /> },
                    { text: 'Data Anomalies', icon: <FlagIcon /> },
                ].map((item, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <Divider />
            <List>
                <ListItem>
                    <ListItemText primary="Model Evaluation" />
                </ListItem>
                {[
                    
                    { text: 'Accuracy and Correctness', icon: <TimelineIcon /> },
                    { text: 'Robustness', icon: <SecurityIcon /> },
                    { text: 'Fairness', icon: <BalanceIcon /> },
                ].map((item, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <Divider />
            <List>
                <ListItem>
                    <ListItemText primary="Risk Management" />
                </ListItem>
                {[
                    
                    { text: 'Report Generation', icon: <AssignmentIcon /> },
                    { text: 'Settings & Alerts', icon: <SettingsIcon /> },
                ].map((item, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            </Box>
        </Drawer>)
};