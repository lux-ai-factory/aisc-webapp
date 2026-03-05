import React from "react";
import { Box, Typography, Grid, Container, Card, CardHeader, CardContent, Stack, Button } from "@mui/material";
import { green, orange, red } from "@mui/material/colors";
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';

/**
 * Props interface for the MetricCard component
 * @interface MetricCardProps
 * @property {string} title - The title of the metric card
 * @property {string | number} metric - The main metric value to display
 * @property {string | number} change - The change in metric value (with direction)
 * @property {string} changeColor - Color to display the change (from MUI colors)
 * @property {string} observations - Detailed observations about the metric
 * @property {string} takeaway - Key takeaway or conclusion
 * @property {string} recommendation - Action recommendation
 * @property {string} recommendationColor - Color for the recommendation chip
 */
interface MetricCardProps {
    title: string;
    metric: number;
    change: number;
    changeColor: string;
    observations: string;
    takeaway: string;
    recommendation: string;
    recommendationColor: string;
}

/**
 * Returns a directional arrow icon (up or down) depending on the sign of `change`.
 * The icon’s color and size can be customized.
 *
 * @param change - The direction value: positive for up, negative for down, zero for none (returns null).
 * @param changeColor - The color for the icon (any valid CSS color).
 * @param fontSize - The icon size; one of "inherit" (default), "small", "medium", or "large".
 *                   "inherit" will use the parent Typography size.
 * @returns A NorthIcon for positive, SouthIcon for negative, or null for zero.
 *
 * @example
 *   getArrowIcon(5, "#008000", "small"); // Green upward arrow, small size
 *   getArrowIcon(-2, "red");             // Red downward arrow, size inherits from parent
 *   getArrowIcon(0, "grey");             // Returns null (renders nothing)
 */
const getArrowIcon = (change: number, changeColor: string, fontSize: "inherit" | "small" | "medium" | "large" = "inherit") => {
    if (change > 0)
        return <NorthIcon fontSize={fontSize} sx={{ verticalAlign: "middle", color: changeColor }} />;
    if (change < 0)
        return <SouthIcon fontSize={fontSize} sx={{ verticalAlign: "middle", color: changeColor }} />;
    return null;
};

const metricsData = [
    {
        title: "Model Performance",
        metric: 44.3,
        change: 0.1,
        changeColor: green[500],
        observations: "F1-score is increasing, but the still not ideal.",
        takeaway: "A better model can be used.",
        recommendation: "Warning: Act later",
        recommendationColor: orange[500],
    },
    {
        title: "Data Anomalies",
        metric: 18.66,
        change: 8,
        changeColor: red[500],
        observations: "Levels of low severity data anomalies stable",
        takeaway: "High levels of severe Data Anomalies.",
        recommendation: "Urgent: Act now!",
        recommendationColor: red[500],
    },
    // {
    //     title: "Data Drift",
    //     metric: 3.6,
    //     change: 0.3,
    //     changeColor: red[500],
    //     observations: "High levels of data drift, with 2 highly drifted features.",
    //     takeaway: "Warning threshold reached.",
    //     recommendation: "Urgent: Act now!",
    //     recommendationColor: red[500],
    // },
    // TODO:
    {
        title: "Fairness",
        metric: 5.3,
        change: -0.1,
        changeColor: green[500],
        observations: "The unfairest feature 'purpose' has become more fair",
        takeaway: "Unfairest feature 'purpose' is still within acceptable bounds",
        recommendation: "No Action required",
        recommendationColor: green[500],
    },
    {
        title: "Model Robustness",
        metric: 69.1,
        change: -2.3,
        changeColor: red[500],
        observations: "Success rate of adversarial generation increased",
        takeaway: "Robustness has triggered a warning but is still within acceptable range",
        recommendation: "Warning: Act later",
        recommendationColor: orange[500],
    },
    {
        title: "Explainability",
        metric: 0.78,
        change: 0.09,
        changeColor: red[500],
        observations: "Slight decrease in explainability of the model.",
        takeaway: "SHAP values are within the threshold",
        recommendation: "No Action required",
        recommendationColor: green[500],
    },
];


/**
 * MetricCard component
 * Displays a single metric card with title, value, change, observations, and recommendations
 * Used as a child component in the SummaryTable
 *
 * @param {MetricCardProps} props - Component props
 * @returns {JSX.Element} A paper component containing metric information
 */
const MetricCard: React.FC<MetricCardProps> = ({
    title,
    metric,
    change,
    changeColor,
    observations,
    takeaway,
    recommendation,
    recommendationColor,
}) => (
        <Card
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                minWidth: 250,
                maxWidth: 350,
                mx: "auto",
                boxSizing: "border-box",
            }}
        >
            <CardHeader
                title={
                    <Typography
                        variant="h5"
                        fontWeight="bold"
                        noWrap={false}
                    >
                        {title}
                    </Typography>
                }
                sx={{ pb: 0 }}
            />
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", py: 1 }}>
                {/* Metric & Change aligned horizontally */}
                <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 1 }}>
                    <Typography variant="h3" fontWeight="bold">{metric}</Typography>
                    {change !== 0 && (
                        <Typography variant="h5" sx={{ color: changeColor, display: "flex", alignItems: "center" }}>
                            {getArrowIcon(change, changeColor)}
                            &nbsp;
                            {change > 0 ? `+${change}` : change}
                        </Typography>
                    )}
                </Stack>

                {/* Observations */}
                <Typography variant="body1" color="textSecondary" sx={{ mb: 2 }}>
                    {observations}
                </Typography>

                {/* Takeaway */}
                <Typography variant="body1" sx={{ mb: 3 }}>
                    <b>Takeaway:</b> {takeaway}
                </Typography>

                <Box flexGrow={1} />

                {/* Recommendation Button */}
                <Button
                    variant="contained"
                    fullWidth
                    sx={{
                        backgroundColor: recommendationColor,
                        color: "#fff",
                        fontWeight: "bold",
                        mt: "auto",
                        ":hover": { backgroundColor: recommendationColor, opacity: 0.9 },
                    }}
                    disableElevation
                >
                    {recommendation}
                </Button>
            </CardContent>
        </Card>
    );


/**
 * SummaryTable component
 * Displays a grid of metric cards showing various model and data metrics
 * Includes metrics for:
 * - Training & Test Data
 * - Production Data & Anomalies
 * - Model Output & Performance
 * - Model Robustness
 * - Explainability
 * - Fairness
 *
 * Each metric is displayed with its current value, change, observations,
 * and recommended actions using color coding for status indication
 *
 * @returns {JSX.Element} A grid of metric cards showing model and data health
 */
const SummaryTable: React.FC = () => (
    <Container maxWidth="lg" disableGutters sx={{ p: 0, m: 0 }}>
        <Box sx={{ p: 2, m: 0, width: "100%" }}>
            <Typography component="h2" variant="h4" gutterBottom>
                Summary
            </Typography>
            <Grid container spacing={3} sx={{ p: 0, m: 0 }}>
                {metricsData.map((metric, idx) => (
                    <Grid item key={idx} xs={12} sm={12} md={6} lg={4} xl={3} sx={{ p: 0, m: 0 }}>
                        <MetricCard {...metric} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    </Container>
);

export default SummaryTable;
