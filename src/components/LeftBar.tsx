import * as React from 'react';
import MuiDrawer from '@mui/material/Drawer';
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
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {Box, Icon, IconButton, Tooltip} from '@mui/material';
import {styled} from '@mui/material/styles';
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
    items: { text: string, icon: React.ReactNode, target: string, nested?: boolean, needsConfig?: boolean }[],
    collapsed?: boolean
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
    const normalizePath = (path: string) => path.replace(/\/+$/, '') || '/';
    const currentPath = normalizePath(decodeURIComponent(location));
    const collapsed = props.collapsed;

    return (
        <List sx={{px: collapsed ? 0.5 : 1, py: 0.5}}>

            {props.title && !collapsed && (
                <ListItem sx={{px: 1, py: 0.25}}>
                    <ListItemText
                        primary={props.title}
                        primaryTypographyProps={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                        }}
                    />
                </ListItem>
            )}
            {props.title && collapsed && (
                <Divider sx={{my: 0.8, borderColor: '#d8dde5'}} />
            )}

            {props.items.map((item, index) => {
                const itemPath = normalizePath(item.target);
                const isSelected = currentPath === itemPath || (item.nested && currentPath.startsWith(`${itemPath}/`));
                return (
                <ListItem
                    key={index}
                    disablePadding
                    sx={{
                        pl: collapsed ? 0 : (item.nested ? 4 : 0)
                    }}
                >
                    <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                        <ListItemButton
                            component={Link}
                            to={item.target}
                            selected={isSelected}
                            sx={{
                                minHeight: 38,
                                display: "flex",
                                justifyContent: collapsed ? "center" : "space-between",
                                alignItems: "center",
                                borderRadius: 2,
                                mx: collapsed ? 0.5 : 1,
                                px: collapsed ? 1 : 1.25,
                                color: isSelected ? '#0a56c7' : 'text.primary',
                                bgcolor: isSelected ? '#d2e0f5' : 'transparent',
                                fontWeight: isSelected ? 700 : 400,
                                opacity: isSelected ? 1 : (item.nested ? 0.88 : 1),
                                '&:hover': {
                                    opacity: 1,
                                    bgcolor: isSelected ? '#c2d5f0' : '#eef2f7',
                                },
                                '&.Mui-selected': {
                                    bgcolor: '#d2e0f5',
                                    color: '#0a56c7',
                                    fontWeight: 700,
                                    '& .MuiListItemIcon-root': {
                                        color: '#0a56c7',
                                    },
                                    '& .MuiTypography-root': {
                                        color: '#0a56c7',
                                        fontWeight: 700,
                                    },
                                },
                                '&.Mui-selected:hover': {
                                    bgcolor: '#c2d5f0',
                                },
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                                <ListItemIcon sx={{ minWidth: collapsed ? 0 : (item.nested ? 36 : 40), justifyContent: 'center', mr: collapsed ? 0 : 0.5, color: isSelected ? '#0a56c7' : undefined }}>
                                    {item.icon}
                                </ListItemIcon>

                                {!collapsed && (
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: item.nested ? 13 : 14,
                                            fontWeight: item.nested ? (isSelected ? 700 : 500) : (isSelected ? 700 : 600),
                                            color: isSelected ? '#0a56c7' : undefined,
                                        }}
                                    />
                                )}
                            </Box>

                            {!collapsed && item.needsConfig && (
                                <Icon sx={{ color: "red"}}>error</Icon>
                            )}
                        </ListItemButton>
                    </Tooltip>

                </ListItem>
                )
            })}

        </List>
    )
}

/**
 * Props interface for the LeftBar component
 * @interface LeftBarProps
 * @property {number} drawerWidth - The width of the drawer in pixels
 */
interface LeftBarProps {
    drawerWidth: number;
    expandedDrawerWidth?: number;
    collapsed?: boolean;
    mobileOpen?: boolean;
    onToggle?: () => void;
    overlayMode?: boolean;
}

const Drawer = styled(MuiDrawer, {
    shouldForwardProp: (prop) => prop !== 'drawerwidth',
})<{ open?: boolean; drawerwidth: number }>(({theme, open, drawerwidth}) => ({
    width: drawerwidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open
        ? {
            [`& .MuiDrawer-paper`]: {
                width: drawerwidth,
                backgroundColor: '#f7f7f8',
                borderRight: '1px solid #e5e7eb',
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
                overflowX: 'hidden',
            },
        }
        : {
            [`& .MuiDrawer-paper`]: {
                width: drawerwidth,
                backgroundColor: '#f7f7f8',
                borderRight: '1px solid #e5e7eb',
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
                overflowX: 'hidden',
            },
        }),
}));

const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    const project = await res.json() as Project;
    for (const plugin of project.plugins) {
        if (!plugin.enabled) continue;
        plugin.display_icon = await getDisplayIcon(plugin.pid)
    }
    return project;
};

const getDisplayIcon = async (plugin_pid: string) => {
    if (!plugin_pid) return 'extension';
    try {
        const res = await fetch(`${API_URL}/plugins/${plugin_pid}/display_icon`);
        if (!res.ok) return 'extension';
        return await res.json() as string;
    } catch {
        return 'extension';
    }
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
export default function LeftBar({ drawerWidth, expandedDrawerWidth, collapsed, mobileOpen = false, onToggle, overlayMode = false }: LeftBarProps) {

    const { projectName } = useProject()

    const {projectUUID} = useProject();

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID, 'withIcons'],
        queryFn: () => getProject(projectUUID ?? ""),
        enabled: !!projectUUID,
    })

    let pluginMenuHeader = { text: 'Plugins', icon: <ExtensionIcon />, target: `/projects/${projectName}/plugins` }

    let pluginsMenuItems = (project?.plugins ?? []).filter(p => p.enabled).map((plugin: Plugin) => {
        return {
            text: plugin.display_name,
            icon: <Icon>{plugin.display_icon}</Icon>,
            target: `/projects/${projectName}/plugins/${plugin.name}`,
            nested: true,
            needsConfig: plugin.config === null
        }
    }) ?? []


    let pluginsMenu = [pluginMenuHeader].concat(pluginsMenuItems)

    const menuBody = (isCollapsedView: boolean) => (
        <>
            <Toolbar />
            {projectName &&
                <Box sx={{ overflow: 'auto' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            px: 1,
                            py: 1,
                            gap: 1,
                        }}
                    >
                        <Tooltip title={isCollapsedView ? 'Expand menu' : 'Collapse menu'} placement="right" arrow>
                            <IconButton
                                size="small"
                                onClick={onToggle}
                                aria-label="toggle menu"
                                sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1.5,
                                    color: '#4b5563',
                                    bgcolor: '#eef0f3',
                                    border: '1px solid #dde2ea',
                                    transition: 'all 0.18s ease',
                                    '&:hover': {
                                        bgcolor: '#e4e9f2',
                                        borderColor: '#cfd7e5',
                                        transform: 'translateY(-1px)',
                                    },
                                }}
                            >
                                {isCollapsedView ? <KeyboardDoubleArrowRightRoundedIcon fontSize="small" /> : <KeyboardDoubleArrowLeftRoundedIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Divider sx={{borderColor: '#e6e8ed'}} />
                    <MenuList
                        title="Project"
                        collapsed={isCollapsedView}
                        items={[
                            { text: 'Overview', icon: <DashboardIcon />, target: `/projects/${projectName}/overview` },
                            { text: 'Settings', icon: <SettingsIcon />, target: `/projects/${projectName}/settings` },
                        ]}
                    />
                    <Divider sx={{borderColor: '#e6e8ed'}} />
                    <MenuList
                        title="Plugin Management"
                        collapsed={isCollapsedView}
                        items={pluginsMenu}
                    />
                    <Divider sx={{borderColor: '#e6e8ed'}} />
                    <MenuList
                        title="Evaluations"
                        collapsed={isCollapsedView}
                        items={[
                            { text: 'Start Evaluations', icon: <Icon>play_circle</Icon>, target: `/projects/${projectName}/plugins/evaluation` },
                            { text: 'Evaluations', icon: <Icon>sports_score</Icon>, target: `/projects/${projectName}/plugins/evaluations` }
                        ]}
                    />
                    <Divider sx={{borderColor: '#e6e8ed'}} />
                </Box>
            }
        </>
    );

    if (overlayMode) {
        return (
            <>
                <Drawer
                    variant="permanent"
                    open
                    drawerwidth={drawerWidth}
                    sx={{
                        [`& .MuiDrawer-paper`]: {
                            borderRight: projectUUID ? undefined : 'none',
                        },
                    }}
                >
                    {menuBody(true)}
                </Drawer>

                {mobileOpen && (
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={onToggle}
                        drawerwidth={expandedDrawerWidth ?? 320}
                        ModalProps={{ keepMounted: true }}
                        slotProps={{
                            paper: {
                                onClick: onToggle,
                            },
                        }}
                        sx={{
                            [`& .MuiDrawer-paper`]: {
                                boxShadow: '0 8px 28px rgba(15, 23, 42, 0.18)',
                            },
                        }}
                    >
                        {menuBody(false)}
                    </Drawer>
                )}

                {collapsed && !mobileOpen && projectName && (
                    <Tooltip title="Open menu" placement="right" arrow>
                        <IconButton
                            onClick={onToggle}
                            aria-label="open menu"
                            sx={{
                                position: 'fixed',
                                left: 12,
                                top: 12,
                                zIndex: (theme) => theme.zIndex.appBar + 2,
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                color: '#4b5563',
                                bgcolor: '#eef0f3',
                                border: '1px solid #dde2ea',
                                '&:hover': {
                                    bgcolor: '#e4e9f2',
                                    borderColor: '#cfd7e5',
                                },
                            }}
                        >
                            <MenuRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </>
        );
    }

    return (
        <Drawer
            variant="permanent"
            open={!collapsed}
            drawerwidth={drawerWidth}
            sx={{
                [`& .MuiDrawer-paper`]: {
                    borderRight: projectUUID ? undefined : 'none',
                },
            }}
        >
            {menuBody(Boolean(collapsed))}
        </Drawer>
    )
};
