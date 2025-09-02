// src/components/Home.jsx

import { Typography } from "@mui/material";
import SummaryTable from "../components/SummaryTable";

/**
 * Home page component
 * Main dashboard page of the A4S application
 * Displays the dashboard title and a summary table of metrics
 *
 * @returns {JSX.Element} The home page with dashboard title and summary table
 */
const ProjectHome = () => {
    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Overview
            </Typography>

            <SummaryTable />
        </>);
};

export default ProjectHome;
