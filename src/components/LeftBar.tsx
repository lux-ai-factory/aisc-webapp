import * as React from 'react';
import './LeftBar.css';
import MuiDrawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ExtensionIcon from '@mui/icons-material/Extension';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ChecklistIcon from '@mui/icons-material/Checklist';
import ScienceIcon from '@mui/icons-material/Science';
import InsightsIcon from '@mui/icons-material/Insights';
import DescriptionIcon from '@mui/icons-material/Description';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {Box, Icon, IconButton, Tooltip} from '@mui/material';
import {styled} from '@mui/material/styles';
import { Link, useLocation } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';

/**
 * Props interface for the MenuList component
 * @interface MenuListProps
 * @property {string} title - The title of the menu section
 * @property {Array<{text: string, icon: React.ReactNode, target: string}>} items - Array of menu items
 */
interface MenuListProps {
    title: string,
    items: { text: string, icon: React.ReactNode, target: string, nested?: boolean, needsConfig?: boolean }[],
    collapsed?: boolean,
    onNavigate?: () => void,
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
                const listItemButtonSx = {
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
                        '& .MuiListItemIcon-root': { color: '#0a56c7' },
                        '& .MuiTypography-root': { color: '#0a56c7', fontWeight: 700 },
                    },
                    '&.Mui-selected:hover': { bgcolor: '#c2d5f0' },
                };
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
                            sx={listItemButtonSx}
                            onClick={props.onNavigate}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", minWidth: 0, flex: 1 }}>
                                <ListItemIcon sx={{ minWidth: collapsed ? 0 : (item.nested ? 36 : 40), justifyContent: 'center', mr: collapsed ? 0 : 0.5, color: isSelected ? '#0a56c7' : undefined }}>
                                    {item.icon}
                                </ListItemIcon>

                                {!collapsed && (
                                    <Tooltip title={item.text} placement="right" arrow>
                                        <ListItemText
                                            primary={item.text}
                                            primaryTypographyProps={{
                                                fontSize: item.nested ? 13 : 14,
                                                fontWeight: item.nested ? (isSelected ? 700 : 500) : (isSelected ? 700 : 600),
                                                color: isSelected ? '#0a56c7' : undefined,
                                                noWrap: true,
                                                sx: { overflow: 'hidden', textOverflow: 'ellipsis' },
                                            }}
                                        />
                                    </Tooltip>
                                )}
                            </Box>

                            {!collapsed && item.needsConfig && (
                                <Icon sx={{ color: "red", ml: 0.5, flexShrink: 0 }}>error</Icon>
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

    const menuBody = (isCollapsedView: boolean, onNavigate?: () => void) => (
        <>
            <Toolbar />
            {projectName &&
                <Box sx={{ overflow: 'auto' }}>
                    {isCollapsedView ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                            <Tooltip title="Expand menu" placement="right" arrow>
                                <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                                    aria-label="expand menu"
                                    className="toggle-icon-btn"
                                >
                                    <KeyboardDoubleArrowRightRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ) : (
                        <Box className="project-header">
                            <Box
                                component={Link}
                                to="/"
                                className="project-list-link"
                                onClick={onNavigate}
                            >
                                <Icon>view_list</Icon>
                                Project list
                            </Box>
                            <Tooltip title="Collapse menu" placement="right" arrow>
                                <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                                    aria-label="collapse menu"
                                    className="toggle-icon-btn"
                                >
                                    <KeyboardDoubleArrowLeftRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                    {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                    <MenuList
                        title={isCollapsedView ? "Project" : "Project"}
                        collapsed={isCollapsedView}
                         onNavigate={onNavigate}
                         items={[
                             { text: 'Overview', icon: <DashboardIcon />, target: `/projects/${projectName}/overview` },
                             { text: 'Connections', icon: <SettingsEthernetIcon />, target: `/projects/${projectName}/connections` },
                             { text: 'Settings', icon: <SettingsIcon />, target: `/projects/${projectName}/settings` },
                         ]}
                     />
                     {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                      <MenuList
                          title="Assessment"
                          collapsed={isCollapsedView}
                          onNavigate={onNavigate}
                           items={[
                               { text: 'Qualification', icon: <FactCheckIcon />, target: `/projects/${projectName}/qualification` },
                               { text: 'Control objectives', icon: <TrackChangesIcon />, target: `/projects/${projectName}/control-objectives` },
                           ]}
                      />
                      {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                      <MenuList
                          title="Catalogue"
                          collapsed={isCollapsedView}
                          onNavigate={onNavigate}
                          items={[
                              { text: 'Checklists', icon: <ChecklistIcon />, target: `/projects/${projectName}/checklists` },
                              { text: 'Plugins', icon: <ExtensionIcon />, target: `/projects/${projectName}/plugins` },
                          ]}
                      />
                      {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                      <MenuList
                          title="Execution"
                          collapsed={isCollapsedView}
                          onNavigate={onNavigate}
                           items={[
                               { text: 'Sandbox', icon: <ScienceIcon />, target: `/projects/${projectName}/sandbox` },
                               { text: 'Collect evidence', icon: <LibraryBooksIcon />, target: `/projects/${projectName}/evidence` },
                           ]}
                      />
                      {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                      <MenuList
                          title="Results"
                          collapsed={isCollapsedView}
                          onNavigate={onNavigate}
                           items={[
                               { text: 'Dashboard', icon: <InsightsIcon />, target: `/projects/${projectName}/dashboard` },
                               { text: 'Report', icon: <DescriptionIcon />, target: `/projects/${projectName}/report` },
                               { text: 'Logs', icon: <ReceiptLongIcon />, target: `/projects/${projectName}/logs` },
                           ]}
                      />
                      {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
                      <MenuList
                          title="System"
                          collapsed={isCollapsedView}
                          onNavigate={onNavigate}
                           items={[
                               { text: 'Tasks', icon: <TaskAltIcon />, target: `/projects/${projectName}/tasks` },
                           ]}
                      />
                      {!isCollapsedView && <Divider sx={{borderColor: '#e6e8ed'}} />}
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
                    className={!projectUUID ? 'drawer-no-border' : ''}
                >
                    {menuBody(true)}
                </Drawer>

                {mobileOpen && (
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={onToggle}
                        drawerwidth={expandedDrawerWidth ?? 320}
                        className="drawer-overlay"
                        ModalProps={{ keepMounted: true }}
                    >
                        {menuBody(false, onToggle)}
                    </Drawer>
                )}

                {collapsed && !mobileOpen && projectName && (
                    <Tooltip title="Open menu" placement="right" arrow>
                        <IconButton
                            onClick={onToggle}
                            aria-label="open menu"
                            className="open-menu-btn"
                            sx={{ zIndex: (theme) => theme.zIndex.appBar + 2 }}
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
            className={!projectUUID ? 'drawer-no-border' : ''}
        >
            {menuBody(Boolean(collapsed))}
        </Drawer>
    )
};
