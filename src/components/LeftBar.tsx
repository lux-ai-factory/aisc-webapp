import * as React from 'react';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExtensionIcon from '@mui/icons-material/Extension';
import {Box, Icon} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import {useQuery} from "@tanstack/react-query";
import {API_VERSION_PREFIX} from "../config.tsx";
import {Project, Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

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

const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    const project = await res.json() as Project;
    for (const plugin of project.plugins) {
        plugin.display_icon = await getDisplayIcon(plugin.pid)
    }
    return project;
};

const getDisplayIcon = async (plugin_pid: string) => {
    if (!plugin_pid) throw new Error('Invalid plugin PID');
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/display_icon`);
    return await res.json() as string;
};

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

    const { projectName } = useProject()

    const {projectUUID} = useProject();

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID, 'withIcons'],
        queryFn: () => getProject(projectUUID ?? ""),
    })

    let pluginMenuHeader = { text: 'Plugins', icon: <ExtensionIcon />, target: `/projects/${projectName}/plugins` }

    let pluginsMenuItems = project?.plugins.map((plugin: Plugin) => {
        return {text: plugin.display_name, icon: <Icon>{plugin.display_icon}</Icon>, target: `/projects/${projectName}/plugins/${plugin.name}`}
    }) ?? []


    let pluginsMenu = [pluginMenuHeader].concat(pluginsMenuItems)

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
            {projectName &&
                <Box sx={{ overflow: 'auto' }}>
                    <MenuList
                        title="Project"
                        items={[
                            { text: 'Overview', icon: <DashboardIcon />, target: `/projects/${projectName}/overview` },
                            { text: 'Settings', icon: <SettingsIcon />, target: `/projects/${projectName}/settings` },
                        ]}
                    />
                    <Divider />
                    <MenuList
                        title="Plugin Management"
                        items={pluginsMenu}
                    />
                    <Divider />
                    <MenuList
                        title="Evaluations"
                        items={[
                            { text: 'Start Evaluations', icon: <Icon>play_circle</Icon>, target: `/projects/${projectName}/plugins/evaluation` },
                            { text: 'Evaluations', icon: <Icon>sports_score</Icon>, target: `/projects/${projectName}/plugins/evaluations` },
                            { text: 'Recommendations', icon: <Icon>reviews</Icon>, target: `/projects/${projectName}/recommendations` }
                        ]}
                    />
                    <Divider />
                    <MenuList
                        title="Tasks"
                        items={[
                            { text: 'Tasks', icon: <Icon>directions_run</Icon>, target: `/projects/${projectName}/plugins/evaluations/tasks` },
                        ]}
                    />

                </Box>
            }
        </Drawer >)
};
