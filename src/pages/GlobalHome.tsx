// src/components/Home.jsx

import { Link, List, ListItem, Typography } from "@mui/material";
import { useEffect, useState } from "react";
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
            {/*I would add more information to the project list, like creation date*/}
            {/*Also I'm not a fan of leaving the empty left bar when on project list, to be thought about later*/}
            <List className="project-list">
                {projects.map((project) => (
                    <ListItem key={project.pid} disablePadding>
                        <Link
                            href={`/projects/${project.name}`}
                            underline="none"
                            className="project-card"
                        >
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
