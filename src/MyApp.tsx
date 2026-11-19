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
import { useAuth } from './context/AuthContext';
import { API_VERSION_PREFIX } from './config';
import Plugins from "./pages/Plugins.tsx";
import CataloguePage from "./pages/CataloguePage.tsx";
import PluginConfig from "./pages/PluginsConfig.tsx";
import PluginStartEvaluation from "./pages/PluginStartEvaluation.tsx";
import PluginEvaluations from "./pages/PluginEvaluations.tsx";
import PluginEvaluationMeasurements from "./pages/PluginEvaluationMeasurements.tsx";
import PluginEvaluationsTasks from "./pages/PluginEvaluationsTasks.tsx";
import PluginInstallDialog from "./components/PluginInstallDialog.tsx";
import ProtocolRegisterPrompt from "./components/ProtocolRegisterPrompt.tsx";
import CeleryTasks from "./pages/CeleryTasks.tsx";
import QualificationPage from "./pages/QualificationPage.tsx";
import ControlObjectivesPage from "./pages/ControlObjectivesPage.tsx";
import ChecklistsPage from "./pages/ChecklistsPage.tsx";
import SandboxPage from "./pages/SandboxPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import ReportPage from "./pages/ReportPage.tsx";
import LogsPage from "./pages/LogsPage.tsx";
import RiskRegister from "./pages/RiskRegister.tsx";
import EvidenceHub from "./pages/EvidenceHub.tsx";
import EvidenceMapPage from "./pages/EvidenceMapPage.tsx";
import ConnectionsPage from "./pages/ConnectionsPage.tsx";
import HelpersPage from "./pages/HelpersPage.tsx";
import './App.css';
// I must add this for files to take it into consideration


/** Width of the left drawer in pixels (expanded / collapsed) */
const drawerWidth = 320;
const collapsedWidth = 72;
const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const SHOW_CELERY_TASKS =
    String(import.meta.env.VITE_SHOW_CELERY_TASKS).toLowerCase() === 'true';

const AUTH_ENABLED =
    String(import.meta.env.VITE_AUTH_ENABLED || 'true').toLowerCase() !== 'false';


type ProjectContextWrapperProps = {
    children: React.ReactNode;
};

const ProjectContextWrapper: React.FC<ProjectContextWrapperProps> = ({ children }) => {
    const { setProjectUUID, setProjectName } = useProject();
    const { project_name } = useParams();
    const { authenticated } = useAuth();

    useEffect(() => {
        if (!authenticated) return;
        if (!project_name) return;

        fetch(`${API_URL}/projects/by-name/${project_name}`).then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
            .then((data) => {
                setProjectName(data.name)
                setProjectUUID(data.pid);
            })


    }, [authenticated, project_name]);

    if (!authenticated) return <Navigate to="/" replace />;

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
    const { roles } = useAuth();

    // Admin-only monitoring shows when SHOW_CELERY_TASKS is on; without auth,
    // roles is empty, so treat a disabled AUTH_ENABLED as "admin" for the gate.
    const showMonitoring =
        SHOW_CELERY_TASKS && (roles.includes('admin') || !AUTH_ENABLED);

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
        { id: 32, name: 'Catalogue', path: '/projects/:project_name/catalogue', element: <ProjectContextWrapper><CataloguePage /></ProjectContextWrapper> },
        { id: 5, name: 'Plugins', path: '/projects/:project_name/plugins', element: <ProjectContextWrapper><Plugins /></ProjectContextWrapper> },
        { id: 6, name: 'Plugin Config', path: '/projects/:project_name/plugins/:plugin_name', element: <ProjectContextWrapper><PluginConfig /></ProjectContextWrapper> },
        { id: 7, name: 'Plugin Start Evaluation', path: '/projects/:project_name/plugins/evaluation', element: <ProjectContextWrapper><PluginStartEvaluation /></ProjectContextWrapper> },
        { id: 8, name: 'Plugin Evaluations', path: '/projects/:project_name/plugins/evaluations', element: <ProjectContextWrapper><PluginEvaluations /></ProjectContextWrapper> },
        { id: 9, name: 'Plugin Evaluation Measurements', path: '/projects/:project_name/plugins/evaluations/:evaluation_uuid', element: <ProjectContextWrapper><PluginEvaluationMeasurements /></ProjectContextWrapper> },
        { id: 10, name: 'Plugin Evaluations Tasks', path: '/projects/:project_name/plugins/evaluations/tasks', element: <ProjectContextWrapper><PluginEvaluationsTasks /></ProjectContextWrapper> },
        ...(showMonitoring ? [{ id: 12, name: 'Tasks', path: '/projects/:project_name/tasks', element: <ProjectContextWrapper><CeleryTasks /></ProjectContextWrapper> }] : []),
        { id: 20, name: 'Qualification', path: '/projects/:project_name/qualification', element: <ProjectContextWrapper><QualificationPage /></ProjectContextWrapper> },
        { id: 26, name: 'Control objectives', path: '/projects/:project_name/control-objectives', element: <ProjectContextWrapper><ControlObjectivesPage /></ProjectContextWrapper> },
        { id: 28, name: 'Risk register', path: '/projects/:project_name/risks', element: <ProjectContextWrapper><RiskRegister /></ProjectContextWrapper> },
        { id: 21, name: 'Checklists', path: '/projects/:project_name/checklists', element: <ProjectContextWrapper><ChecklistsPage /></ProjectContextWrapper> },
        { id: 22, name: 'Sandbox', path: '/projects/:project_name/sandbox', element: <ProjectContextWrapper><SandboxPage /></ProjectContextWrapper> },
        { id: 23, name: 'Dashboard', path: '/projects/:project_name/dashboard', element: <ProjectContextWrapper><DashboardPage /></ProjectContextWrapper> },
        { id: 24, name: 'Report', path: '/projects/:project_name/report', element: <ProjectContextWrapper><ReportPage /></ProjectContextWrapper> },
        { id: 25, name: 'Logs', path: '/projects/:project_name/logs', element: <ProjectContextWrapper><LogsPage /></ProjectContextWrapper> },
        { id: 27, name: 'Collect evidence', path: '/projects/:project_name/evidence', element: <ProjectContextWrapper><EvidenceHub /></ProjectContextWrapper> },
        { id: 29, name: 'Evidence map', path: '/projects/:project_name/evidence-map', element: <ProjectContextWrapper><EvidenceMapPage /></ProjectContextWrapper> },
        { id: 30, name: 'Connections', path: '/projects/:project_name/connections', element: <ProjectContextWrapper><ConnectionsPage /></ProjectContextWrapper> },
        { id: 31, name: 'Helper models', path: '/projects/:project_name/helpers', element: <ProjectContextWrapper><HelpersPage /></ProjectContextWrapper> },
    ];
    const theme = useTheme();
    const autoCollapse = useMediaQuery(theme.breakpoints.down('lg'));
    const overlayMode = useMediaQuery('(max-width:899px)');
    // Keep the collapsed/expanded choice across refreshes (localStorage).
    const COLLAPSED_KEY = 'sidebarCollapsed';
    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem(COLLAPSED_KEY);
        return saved !== null ? saved === 'true' : autoCollapse;
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // Once the user collapses/expands by hand, width changes stop overriding
    // their choice (in particular: no auto-uncollapse when crossing the lg
    // breakpoint). Mobile overlay still wins while in overlay mode.
    const [userToggled, setUserToggled] = useState(false);
    useEffect(() => {
        if (overlayMode) {
            setCollapsed(true);
            setMobileMenuOpen(false);
            return;
        }
        // Respect a saved choice; otherwise follow the breakpoint.
        if (!userToggled && localStorage.getItem(COLLAPSED_KEY) === null) setCollapsed(autoCollapse);
        setMobileMenuOpen(false);
    }, [autoCollapse, overlayMode, userToggled]);
    useEffect(() => {
        if (!overlayMode && userToggled) localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    }, [collapsed, overlayMode, userToggled]);
    const effectiveWidth = overlayMode ? collapsedWidth : (collapsed ? collapsedWidth : drawerWidth);
    const isRootPage = location.pathname === '/';
    const showSidebar = !isRootPage;
    const layoutSidebarWidth = showSidebar && !overlayMode ? effectiveWidth : 0;

    const contentTheme = React.useMemo(() => {
        const values = theme.breakpoints.values;
        return createTheme({
            ...theme,
            components: {
                ...theme.components,
                MuiDialog: {
                    styleOverrides: {
                        paper: {
                            maxHeight: 'calc(100vh - 48px)',
                        },
                    },
                },
            },
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
        setUserToggled(true);
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
                        overflow: 'clip',
                    }}
                >
                    <Toolbar className="brand-toolbar" />

                    <Box sx={{width: '100%', maxWidth: isRootPage ? 980 : 'none', mx: isRootPage ? 'auto' : 0}}>
                        <Routes>
                            {
                                navs.map((nav) => {
                                    return (
                                        <Route key={nav.id} path={nav.path} element={nav.element} />
                                    );
                                })
                            }
                            {/* Route the protocol-handler /receiver through to the app root. The
                                URI is consumed on boot by PluginInstallProvider (which
                                sets the install modal and strips the query), so no
                                NotFound is shown here. */}
                            <Route path="/receiver" element={<Navigate to="/" replace />} />
                            <Route path="/protocol-receiver" element={<Navigate to="/" replace />} />
                            <Route path='*' element={<NotFound />} />
                        </Routes>
                    </Box>

                </Box>
            </ThemeProvider>
            <PluginInstallDialog />
            <ProtocolRegisterPrompt />
        </Box>
    );
}
