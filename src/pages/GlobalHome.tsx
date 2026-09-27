import { Box, Button, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_VERSION_PREFIX } from "../config";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import {
    currentPlatformProject,
    projectForPlatformUrl,
    projectsUrl,
} from "../platform/currentProject";
import "../styles/common.css";
import "./GlobalHome.css";



const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface Project {
    pid: string;
    name: string;
}

const ProjectsList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(projectsUrl(API_URL))
            .then((res) => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then((data) => {
                setProjects(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <Typography sx={{ textAlign: 'center', mt: 4 }}>Loading...</Typography>;
    if (error) return <Typography color="error" sx={{ textAlign: 'center', mt: 4 }}>Error: {error}</Typography>;

    return (
        <Box sx={{ width: 1, maxWidth: 900, mx: 'auto', px: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 5 }}>
                Projects
            </Typography>
            <Grid container spacing={3}>
                {projects.map((project) => (
                    <Grid key={project.pid} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card
                            variant="outlined"
                            onClick={() => navigate(`/projects/${project.name}`)}
                            className="gradient-card"
                            sx={{ height: '100%' }}
                        >
                            <CardActionArea sx={{ height: '100%' }}>
                                <CardContent>
                                    <Typography variant="h6" fontWeight={600}>
                                        {project.name}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>
            {projects.length === 0 && (
                <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                    No projects yet.
                </Typography>
            )}
        </Box>
    );
};


/**
 * The project the engine was opened on.
 *
 * There is nothing to choose here: the project is chosen once, on the
 * launcher, and opening the engine inside it means working on it. This asks the
 * backend for its own row for that project (made on the first visit, found
 * every time after) and goes straight in.
 */
const OpenTheProject = ({ project }: { project: string }) => {
    const { setProjectUUID, setProjectName } = useProject();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(projectForPlatformUrl(API_URL, project), { method: "POST" })
            .then((res) => {
                if (!res.ok) throw new Error("Could not open this project.");
                return res.json();
            })
            .then((opened: Project) => {
                setProjectUUID(opened.pid);
                setProjectName(opened.name);
                navigate(`/projects/${opened.name}`, { replace: true });
            })
            .catch((err) => setError(err.message));
    }, [project, navigate, setProjectUUID, setProjectName]);

    if (error) {
        return (
            <Typography color="error" sx={{ textAlign: "center", mt: 4 }}>
                {error}
            </Typography>
        );
    }
    return <Typography sx={{ textAlign: "center", mt: 4 }}>Opening the project…</Typography>;
};


/**
 * Home page component
 *
 * Inside a project (opened from the launcher) there is nothing to pick: it goes
 * straight into that project. Without one, the engine is running on its own and
 * still lists what it has.
 */
const GlobalHome = () => {
    const { authenticated, login } = useAuth();
    const platformProject = currentPlatformProject();

    // Everything here is behind the gateway, so there is no sign-in screen of
    // our own: this only shows when the engine could not confirm who the
    // gateway says this is (the backend is down, or the session just ended).
    if (!authenticated) {
        return (
            <Box className="auth-message">
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    AI Assessment Sandbox
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    The engine could not confirm who you are.
                </Typography>
                <Button variant="outlined" onClick={login}>Sign in again</Button>
            </Box>
        );
    }

    if (platformProject) return <OpenTheProject project={platformProject} />;

    return <ProjectsList />;
};

export default GlobalHome;
