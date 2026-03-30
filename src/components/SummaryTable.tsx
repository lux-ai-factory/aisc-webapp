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
 * @property {string} observations - Detailed observations about the metric
 * @property {string} takeaway - Key takeaway or conclusion
 * @property {string} recommendation - Action recommendation
 * @property {string} changeColor - Color to display the change and the recommendation (from MUI colors)
 */
interface MetricCardProps {
    title: string;
    metric: number;
    change: number;
    observations: string;
    takeaway: string;
    recommendation: string;
    changeColor: string;
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
        title: "Data Anomalies",
        metric: 2.2,
        change: -0.2,
        observations: "Low levels of anomalies, with no severe anomalies.",
        takeaway: "The observed anomalies do not have a significant effect.",
        recommendation: "No Action required",
        changeColor: green[500],
    },
    {
        title: "Data Drift",
        metric: 3.6,
        change: 0.3,
        observations: "High levels of data drift, with some highly drifted features.",
        takeaway: "Warning threshold reached.",
        recommendation: "Urgent: Act now!",
        changeColor: red[500],
    },
    {
        title: "Model Performance",
        metric: 44.3,
        change: 0.1,
        observations: "F1-score is increasing, but the still not ideal.",
        takeaway: "A better model can be used.",
        recommendation: "Warning: Act later",
        changeColor: orange[500],
    },
    {
        title: "Model Fairness",
        metric: 5.4,
        change: -0.1,
        observations: "The unfairest feature 'purpose' has become more fair.",
        takeaway: "Unfairest feature 'purpose' is still within acceptable bounds.",
        recommendation: "No Action required",
        changeColor: green[500],
    },
    {
        title: "Robustness",
        metric: 84.8,
        change: 2.5,
        observations: "Success rate of adversarial generation increased",
        takeaway: "Robustness has triggered a warning but is still within acceptable range",
        recommendation: "Warning: Act later",
        changeColor: orange[500],
    },
    {
        title: "Explainability",
        metric: 54.3,
        change: 0.9,
        observations: "Slight increase in explainability of the model.",
        takeaway: "Trustworthiness values are within the threshold",
        recommendation: "No Action required",
        changeColor: green[500],
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
    observations,
    takeaway,
    recommendation,
    changeColor,
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
                        backgroundColor: changeColor,
                        color: "#fff",
                        fontWeight: "bold",
                        mt: "auto",
                        ":hover": { backgroundColor: changeColor, opacity: 0.9 },
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
