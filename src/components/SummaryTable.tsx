import React from "react";
import { Box, Grid, Typography, Paper, Chip } from "@mui/material";
import { green, orange, red } from "@mui/material/colors";

interface MetricCardProps {
    title: string;
    metric: string | number;
    change: string | number;
    changeColor: string;
    observations: string;
    takeaway: string;
    recommendation: string;
    recommendationColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    metric,
    change,
    changeColor,
    observations,
    takeaway,
    recommendation,
    recommendationColor,
}) => {
    return (
        <Paper elevation={3} sx={{ padding: 2, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight="bold">
                {title}
            </Typography>
            <Box display="flex" alignItems="center" mt={1}>
                <Typography variant="h3" fontWeight="bold">
                    {metric}
                </Typography>
                <Typography
                    variant="body1"
                    sx={{ color: changeColor, fontWeight: "bold", marginLeft: 1 }}
                >
                    {change}
                </Typography>
            </Box>
            <Typography variant="body1" color="textSecondary" mt={1}>
                {observations}
            </Typography>
            <Typography variant="body1" mt={2}>
                <strong>Takeaway: </strong>
                {takeaway}
            </Typography>
            <Box mt={2}>
                <Chip
                    label={recommendation}
                    sx={{
                        backgroundColor: recommendationColor,
                        color: "#fff",
                        fontWeight: "bold",
                    }}
                />
            </Box>
        </Paper>
    );
};

const SummaryTable: React.FC = () => {
    const metricsData = [
        {
            title: "Training & Test Data",
            metric: 0.82,
            change: "↓ -0.04",
            changeColor: green[500],
            observations: "Bias strongest in gender feature",
            takeaway: "Bias has decreased",
            recommendation: "No Action required",
            recommendationColor: green[500],
        },
        {
            title: "Production Data & Data Anomalies",
            metric: 25.2,
            change: "↑ 2.1",
            changeColor: red[500],
            observations: "Levels of low severity data anomalies stable",
            takeaway: "High levels of severe Data Anomalies",
            recommendation: "Immediate Action required",
            recommendationColor: red[500],
        },
        {
            title: "Model Output & Performance",
            metric: 0.79,
            change: "↓ -0.18",
            changeColor: red[500],
            observations:
                "Significant drop in model accuracy, while other metrics remain stable",
            takeaway: "Warning threshold reached",
            recommendation: "Action required at some point",
            recommendationColor: orange[500],
        },
        {
            title: "Model Robustness",
            metric: 69.1,
            change: "↓ -2.3",
            changeColor: red[500],
            observations: "Success rate of adversarial generation increased",
            takeaway: "Robustness has triggered a warning but is still within acceptable range",
            recommendation: "Action required at some point",
            recommendationColor: orange[500],
        },
        {
            title: "Explainability",
            metric: 0.98,
            change: "↑ 0.09",
            changeColor: red[500],
            observations:
                "Slight decrease in explainability of the model, especially in examples with 'total_acc' > 5",
            takeaway: "SHAP values are within the threshold",
            recommendation: "No Action required",
            recommendationColor: green[500],
        },
        {
            title: "Fairness",
            metric: 5.3,
            change: "↓ -0.1",
            changeColor: green[500],
            observations: "The unfairest feature 'purpose' has become more fair",
            takeaway:
                "Unfairest feature 'purpose' is still within acceptable bounds",
            recommendation: "No Action required",
            recommendationColor: green[500],
        },
    ];

    return (
        <Box sx={{ padding: 3 }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Summary
            </Typography>
            <Grid container spacing={2}>
                {metricsData.map((metric, index) => (
                    <Grid item xs={12} sm={6} md={2} key={index}>
                        <MetricCard {...metric} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default SummaryTable;