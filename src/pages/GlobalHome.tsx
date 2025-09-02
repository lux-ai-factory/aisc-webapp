// src/components/Home.jsx

import { Link, List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import SummaryTable from "../components/SummaryTable";
import { useEffect, useState } from "react";
import axios from "axios";
import { API_VERSION_PREFIX } from "../config";



const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface Project {
    pid: string;
    name: string;
}

const ProjectsList = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

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

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (

        <>
            <Typography component="h3" variant="h5" gutterBottom>
                Projects
            </Typography>
            <List>
                {projects.map((project) => (
                    <ListItem key={project.pid} disablePadding>
                        <Link href={`/projects/${project.pid}`} underline="hover">
                            {project.name}
                        </Link>
                    </ListItem>
                ))}
            </List>
        </>

    );
};


/**
 * Home page component
 * Main dashboard page of the A4S application
 * Displays the dashboard title and a summary table of metrics
 *
 * @returns {JSX.Element} The home page with dashboard title and summary table
 */
const GlobalHome = () => {
    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                A4S AI Testing
            </Typography>

            <ProjectsList/>

        </>);
};

export default GlobalHome;
