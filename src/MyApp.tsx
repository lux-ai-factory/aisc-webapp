import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';

import LeftBar from './components/LeftBar';
import { Route, Routes, useLocation } from 'react-router-dom';
import NotFound from './pages/NotFound';
import TopBar from './components/TopBar';
import StartEvaluation from './pages/StartEvaluation';
import SettingsPage from './pages/Settings';
import GlobalHome from './pages/GlobalHome';
import ProjectHome from './pages/ProjectHome';
import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useProject } from './context/ProjectContext';
import { API_VERSION_PREFIX } from './config';
import Plugins from "./pages/Plugins.tsx";
import PluginConfig from "./pages/PluginsConfig.tsx";
import PluginStartEvaluation from "./pages/PluginStartEvaluation.tsx";
import PluginEvaluations from "./pages/PluginEvaluations.tsx";
import PluginEvaluationMeasurements from "./pages/PluginEvaluationMeasurements.tsx";
import PluginEvaluationsTasks from "./pages/PluginEvaluationsTasks.tsx";
import './App.css';
// I must add this for files to take it into consideration


/** Width of the left drawer in pixels (expanded / collapsed) */
const drawerWidth = 320;
const collapsedWidth = 72;
const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


type ProjectContextWrapperProps = {
    children: React.ReactNode;
};

const ProjectContextWrapper: React.FC<ProjectContextWrapperProps> = ({ children }) => {
    const { setProjectUUID, setProjectName } = useProject();
    const { project_name } = useParams();

    useEffect(() => {
        if (!project_name) return;

        fetch(`${API_URL}/projects/by-name/${project_name}`).then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
            .then((data) => {
                setProjectName(data.name)
                setProjectUUID(data.pid);
            })


    }, [project_name]);

    return <>{children}</>;
};


/**
 * Main application layout component
 * Implements a permanent left drawer layout with Material-UI
 * Contains the main navigation structure and routing setup
 *
 * @returns {JSX.Element} The main application layout with navigation and content area
 */
export default function PermanentDrawerLeft() {
    const location = useLocation();

    /**
     * Navigation configuration array
     * Defines all available routes and their corresponding components
     * If a route doesn't have an element, it will show the Construction component
     */
    const navs = [
        { id: 1, name: 'Home', path: '/', element: <GlobalHome /> },
        { id: 2, name: 'Project', path: '/projects/:project_name', element: <ProjectContextWrapper><Navigate to="overview" replace /></ProjectContextWrapper> },
        { id: 11, name: 'Overview', path: '/projects/:project_name/overview', element: <ProjectContextWrapper><ProjectHome /></ProjectContextWrapper> },
        { id: 3, name: 'Start evaluation', path: '/projects/:project_name/start-eval', element: <ProjectContextWrapper><StartEvaluation /></ProjectContextWrapper> },
        {
            id: 4, name: 'Settings', path: '/projects/:project_name/settings', element: (
                <ProjectContextWrapper>
                    <SettingsPage />
                </ProjectContextWrapper>
            )
        },
        { id: 5, name: 'Plugins', path: '/projects/:project_name/plugins', element: <ProjectContextWrapper><Plugins /></ProjectContextWrapper> },
        { id: 6, name: 'Plugin Config', path: '/projects/:project_name/plugins/:plugin_name', element: <ProjectContextWrapper><PluginConfig /></ProjectContextWrapper> },
        { id: 7, name: 'Plugin Start Evaluation', path: '/projects/:project_name/plugins/evaluation', element: <ProjectContextWrapper><PluginStartEvaluation /></ProjectContextWrapper> },
        { id: 8, name: 'Plugin Evaluations', path: '/projects/:project_name/plugins/evaluations', element: <ProjectContextWrapper><PluginEvaluations /></ProjectContextWrapper> },
        { id: 9, name: 'Plugin Evaluation Measurements', path: '/projects/:project_name/plugins/evaluations/:evaluation_uuid', element: <ProjectContextWrapper><PluginEvaluationMeasurements /></ProjectContextWrapper> },
        { id: 10, name: 'Plugin Evaluations Tasks', path: '/projects/:project_name/plugins/evaluations/tasks', element: <ProjectContextWrapper><PluginEvaluationsTasks /></ProjectContextWrapper> }
    ];
    const theme = useTheme();
    const autoCollapse = useMediaQuery(theme.breakpoints.down('lg'));
    const overlayMode = useMediaQuery('(max-width:899px)');
    const [collapsed, setCollapsed] = useState(autoCollapse);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        if (overlayMode) {
            setCollapsed(true);
            setMobileMenuOpen(false);
            return;
        }
        setCollapsed(autoCollapse);
        setMobileMenuOpen(false);
    }, [autoCollapse, overlayMode]);
    const effectiveWidth = overlayMode ? collapsedWidth : (collapsed ? collapsedWidth : drawerWidth);
    const isRootPage = location.pathname === '/';
    const showSidebar = !isRootPage;
    const layoutSidebarWidth = showSidebar && !overlayMode ? effectiveWidth : 0;

    const contentTheme = React.useMemo(() => {
        const values = theme.breakpoints.values;
        return createTheme({
            ...theme,
            breakpoints: {
                unit: theme.breakpoints.unit,
                values: {
                    xs: values.xs,
                    sm: values.sm + layoutSidebarWidth,
                    md: values.md + layoutSidebarWidth,
                    lg: values.lg + layoutSidebarWidth,
                    xl: values.xl + layoutSidebarWidth,
                },
            },
        });
    }, [theme, layoutSidebarWidth]);

    const handleSidebarToggle = () => {
        if (overlayMode) {
            setMobileMenuOpen((open) => !open);
            return;
        }
        setCollapsed((c) => !c);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <CssBaseline />
            <TopBar />
            {showSidebar && (
                <LeftBar
                    drawerWidth={effectiveWidth}
                    expandedDrawerWidth={drawerWidth}
                    collapsed={overlayMode ? true : collapsed}
                    mobileOpen={mobileMenuOpen}
                    onToggle={handleSidebarToggle}
                    overlayMode={overlayMode}
                />
            )}
            <ThemeProvider key={`content-theme-${layoutSidebarWidth}`} theme={contentTheme}>
                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        bgcolor: 'background.default',
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: isRootPage ? 'center' : 'flex-start',
                        margin: '0 auto',
                        width: '100%',
                        minWidth: 0,
                        overflow: 'hidden',
                    }}
                >
                    <Toolbar />

                    <Box sx={{width: '100%', maxWidth: isRootPage ? 980 : 'none', mx: isRootPage ? 'auto' : 0}}>
                        <Routes>
                            {
                                navs.map((nav) => {
                                    return (
                                        <Route key={nav.id} path={nav.path} element={nav.element} />
                                    );
                                })
                            }
                            <Route path='*' element={<NotFound />} />
                        </Routes>
                    </Box>

                </Box>
            </ThemeProvider>
        </Box>
    );
}
