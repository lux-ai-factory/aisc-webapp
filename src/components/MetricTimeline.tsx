/**
 * @fileoverview MetricTimeline component for visualizing time-series metric data
 * using Chart.js. Supports zooming, panning, and feature-based grouping of metrics.
 */

import { useState, useEffect, useRef } from "react";

// TODO: kebab case for file name

import { Box, Typography, Card, CardContent, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables, ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { mapMetricsName } from "../utils";
ChartJS.register(...registerables, zoomPlugin);
import { enGB } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';
import { CenterFocusWeak, Home, OpenWith } from "@mui/icons-material";

/**
 * Interface representing the raw metric data from the API
 */
interface MetricApiData {
    name: string;
    time: string;
    score: number;
    feature: {
        name: string;
    }
}

/**
 * Parses raw metric data into a format compatible with Chart.js
 * @param metrics Array of metric data arrays from the API
 * @returns Formatted dataset object for Chart.js
 */
function parse_datas(metrics: MetricApiData[][]) {
    const datasets = metrics.map(metric => {
        const parsed_data = metric.map((d) => {
            return {
                'x': new Date(d.time).toISOString().slice(0, 19).replace('T', ' '),
                'y': d.score,
                'feature': d.feature?.name
            }
        });
        const metric_label = metric.length > 0 ? mapMetricsName(metric[0].name) || 'Unknown' : 'Unknown';

        return {
            label: metric_label,
            data: parsed_data,
            fill: false,
            tension: 0.1
        };
    });
    console.log(datasets);
    return { datasets };
}

/**
 * Interface for processed metric data ready for visualization
 */
interface MetricData {
    data: { x: string; y: number, feature: string }[];
    label: string;
    fill: boolean;
    tension: number;
}

/**
 * Extracts and groups data by feature name for a single metric
 * @param metrics Single metric dataset to process
 * @returns Array of datasets grouped by feature
 */
function extract_feature_name_one(metrics: MetricData) {
    const unique_feature = Array.from(new Set(metrics.data.map((d) => d.feature)));

    return unique_feature.map((feature) => {
        return {
            label: feature,
            data: metrics.data.filter((d) => d.feature === feature).map((d) => {
                return {
                    x: d.x,
                    y: d.y
                }
            }),
            fill: metrics.fill,
            tension: metrics.tension

        }
    }
    );
}

/**
 * Processes multiple metric datasets to group by feature names
 * @param metrics Array of metric datasets to process
 * @returns Combined datasets grouped by feature
 */
function extract_feature_name(metrics: MetricData[]) {
    const datasets = metrics.map((metric) => extract_feature_name_one(metric)).flat();
    return { datasets };
}

/**
 * Loading indicator component
 */
function Loading() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
        </Box>
    );

}

/**
 * Error display component
 */
function ErrorComponent() {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography component="h3" variant="subtitle2" gutterBottom>
                Error loading data
            </Typography>
        </Box>
    );
}

// TODO: keep only function and then export later, and not default

/**
 * Props interface for the MetricTimeline component
 */
interface MetricTimelineProps {
    /** Title displayed at the top of the metric card */
    cardTitle: string;
    /** Array of metric names to fetch and display */
    metricNames: string[];
    /** Whether to group the data by feature */
    group_by_feature?: boolean;
    /** Whether to sort datasets by maximum value */
    sort_by_value?: boolean;
}

/**
 * Fetches metric data from the API
 * @param url API endpoint URL
 * @returns Promise resolving to metric data
 */
function fetchMetricData(url: string) {
    return fetch(url)
        .then(response => response.json())
        .then(data => data);
}

/** Type for interaction mode state */
type InteractionMode = 'Pan' | 'Zoom';

/**
 * Interface for processed metric data without feature information
 */
interface MetricData2 {
    data: { x: string; y: number }[];
    label: string;
    fill: boolean;
    tension: number;
}

/**
 * Sorts datasets by their maximum values
 * @param datasets_in Input datasets to sort
 * @returns Sorted datasets
 */
function sort_datasets(datasets_in: MetricData2[]) {
    const datasets = datasets_in.sort((a, b) => {
        const a_max = Math.max(...a.data.map((d) => d.y));
        const b_max = Math.max(...b.data.map((d) => d.y));
        return b_max - a_max;
    });
    return { datasets };
}

/**
 * Props interface for the GraphControls component
 */
interface GraphControlsProps {
    /** Reference to the Chart.js instance */
    chart?: ChartJS<'line', { x: string; y: number }[], unknown> | null;
}

/**
 * Component providing zoom and pan controls for the graph
 */
export function GraphControls(props: GraphControlsProps) {

    const { chart } = props;
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('Zoom');

    const handleZoom = () => {
        if (!chart) return;
        if (chart.options.plugins?.zoom?.zoom?.drag?.enabled !== undefined)
            chart.options.plugins.zoom.zoom.drag.enabled = true;
        if (chart.options.plugins?.zoom?.pan?.enabled !== undefined)
            chart.options.plugins.zoom.pan.enabled = false;
        setInteractionMode('Zoom');
        chart.update();
    }

    const handlePan = () => {
        console.log("Chart object in Zoom:", chart);
        if (!chart) return;
        if (chart.options.plugins?.zoom?.zoom?.drag?.enabled !== undefined)
            chart.options.plugins.zoom.zoom.drag.enabled = false;
        if (chart.options.plugins?.zoom?.pan?.enabled !== undefined)
            chart.options.plugins.zoom.pan.enabled = true;
        setInteractionMode('Pan');
        chart.update();
    }

    const handleResetZoom = () => {
        if (!chart) return;
        chart.resetZoom();
    }

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Zoom">
                <IconButton size="small"
                    onClick={() => handleZoom()}
                    sx={{
                        color: interactionMode === "Zoom" ? 'primary.main' : 'gray',
                        '&:hover': { color: 'primary.main' },
                    }}
                >
                    <CenterFocusWeak />
                </IconButton>
            </Tooltip>
            <Tooltip title="Pan">
                <IconButton size="small"
                    onClick={() => handlePan()}
                    sx={{
                        color: interactionMode === "Pan" ? 'primary.main' : 'gray',
                        '&:hover': { color: 'primary.main' },
                    }}
                >
                    <OpenWith />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset Zoom">
                <IconButton size="small"
                    onClick={() => handleResetZoom()}
                    sx={{
                        color: 'gray',
                        '&:hover': { color: 'primary.main' },
                    }}
                >
                    <Home />
                </IconButton>
            </Tooltip>
        </Box>

    );
}

/**
 * Main component for displaying time-series metric data with interactive controls
 * Supports zooming, panning, and various data grouping options
 */
export default function MetricTimeline({
    cardTitle,
    metricNames,
    group_by_feature = false,  // Default value
    sort_by_value = false      // Default value
}: MetricTimelineProps) {
    // const { metricNames, cardTitle, group_by_feature,  sort_by_value} = props;
    const [chartData, setChartData] = useState<{ datasets: { label: string; data: { x: string; y: number }[]; fill: boolean; tension: number }[] }>({ datasets: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const options: ChartOptions<'line'> = {
        responsive: true,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day'
                },
                adapters: {
                    date: {
                        locale: enGB
                    }
                }
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
            },
            // htmlLegend: {
            //     // ID of the container to put the legend in
            //     containerID: 'legend-container',
            //   },
            zoom: {

                pan: {
                    enabled: false, // Enable panning
                    mode: 'xy', // Allow panning on both x and y axes
                },
                zoom: {
                    // wheel: {
                    //     enabled: true, // Enable zooming with the mouse wheel
                    //     modifierKey: 'ctrl', // Require Ctrl key to zoom (similar to Plotly)
                    // },
                    // pinch: {
                    //     enabled: true, // Enable zooming with pinch gestures
                    // },
                    drag: {
                        enabled: true, // Enable drag-to-zoom box (similar to Plotly)
                        backgroundColor: 'rgba(0, 0, 255, 0.1)', // Highlight area being zoomed
                        borderColor: 'blue', // Border of the drag box
                        borderWidth: 1,
                    },
                    mode: 'xy', // Zoom both axes simultaneously
                    // limits: {
                    //     x: { min: 'original', max: 'original' }, // Do not exceed original data range
                    //     y: { min: 'original', max: 'original' },
                    // },
                },
            },
        },
    }

    const chartRef = useRef<ChartJS<'line', { x: string; y: number }[]>>(null);

    const API_URL = import.meta.env.VITE_API_URL;


    useEffect(() => {
        Promise.all(metricNames.map(metricName => `${API_URL}/api/projects/1/metrics?name=${metricName}`).map((url: string) => fetchMetricData(url)))
            .then(metrics => {
                const parsedData = parse_datas(metrics);
                const chartData = group_by_feature ? extract_feature_name(parsedData.datasets) : parsedData;
                const chartDataSorted = sort_by_value ? sort_datasets(chartData.datasets) : chartData;
                // const chartData = extract_feature_name(parsedData.datasets);
                setChartData(chartDataSorted);
                setLoading(false);
            })
            .catch(() => {
                console.error('Error loading data');
                setError(true);
                setLoading(false);
            });

    }, [metricNames, group_by_feature, sort_by_value, API_URL]);

    useEffect(() => {
        const chart = chartRef.current;

        console.log("Chart object in useEffect:", chart);
      }, [chartRef]);

    if (loading) return <Loading />;
    if (error) return <ErrorComponent />;

    // console.log(chartData);

    return (
        <Box sx={{ width: 1 }}>
            <Card variant="outlined" sx={{ flexGrow: 1, mb: 2, }}>
                <CardContent>
                    <Typography component="h3" variant="h5" gutterBottom>
                        {cardTitle}
                    </Typography>
                    {/* <GraphControls currentMode={interactionMode} onModeChange={setInteractionMode} /> */}
                    <Box display="flex" justifyContent="flex-end">
                        <GraphControls chart={chartRef.current} />
                    </Box>
                    <Box>
                        <Line ref={chartRef} data={chartData} options={options} />
                    </Box>
                    <div id="legend-container"></div>
                </CardContent>
            </Card>
        </Box>
    );
}
