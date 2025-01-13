// src/components/Home.jsx

import { Typography } from "@mui/material";
import SummaryTable from "../components/SummaryTable";

// const Home = () => <Construction title="Home" />;
const Home = () => {
    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                A4S Dashboard
            </Typography>

            <SummaryTable />
        </>);
};

export default Home;