import { Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_VERSION_PREFIX } from "../config";
import "../styles/common.css";



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
        fetch(`${API_URL}/projects`)
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
 * Home page component
 * Main dashboard page of the AISC application
 * Displays the dashboard title and a summary table of metrics
 *
 * @returns {JSX.Element} The home page with dashboard title and summary table
 */
const GlobalHome = () => {
    return (
        <>
            {/*I remove this for now because we already have the same title in top toolbar*/}
            {/*<Typography component="h2" variant="h4" gutterBottom>*/}
            {/*    AI Assessment Sandbox*/}
            {/*</Typography>*/}

            <ProjectsList/>

        </>);
};

export default GlobalHome;
