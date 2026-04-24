import { Typography } from "@mui/material";
import SummaryTable from "../components/SummaryTable";
import { useProject } from "../context/ProjectContext";

const ProjectHome = () => {
    const { projectUUID } = useProject();

    return (
        <>
            <Typography component="h2" variant="h4" sx={{ mb: 3 }}>
                Overview
            </Typography>

            <SummaryTable projectPid={projectUUID} />
        </>
    );
};

export default ProjectHome;
