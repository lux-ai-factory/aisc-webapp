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
    const datasets = metrics.map((metric, _index) => {
        // Remove duplicates based on time and feature
        const uniqueData = metric.filter((item, idx, self) => 
            idx === self.findIndex(t => 
                t.time === item.time && 
                t.feature?.name === item.feature?.name &&
                t.name === item.name
            )
        );
        
        const parsed_data = uniqueData.map((d) => {
            return {
                'x': new Date(d.time).toISOString(),
                'y': d.score,
                'feature': d.feature?.name || 'Unknown'
            }
        });
        
        // Sort data by time to ensure proper line connections
        parsed_data.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
        
        const metric_label = metric.length > 0 ? mapMetricsName(metric[0].name) || 'Unknown' : 'Unknown';

        return {
            label: metric_label,
            data: parsed_data,
            fill: false,
            tension: 0,
            borderWidth: 3,
            pointRadius: 4,
        };
    });
    console.log('Parsed datasets:', datasets);
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
    /** Project PID to fetch metrics for */
    projectPid?: string;
    /** Evaluation PID to fetch metrics for (optional, if not provided uses project-level metrics) */
    evaluationPid?: string;
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
    projectPid,
    evaluationPid,
    group_by_feature = false,  // Default value
    sort_by_value = false      // Default value
}: MetricTimelineProps) {
    // const { metricNames, cardTitle, group_by_feature,  sort_by_value} = props;
    const [chartData, setChartData] = useState<{ datasets: { label: string; data: { x: string; y: number }[]; fill: boolean; tension: number }[] }>({ datasets: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    displayFormats: {
                        day: 'MMM dd, yyyy',   // Show date in day format
                        week: 'MMM dd, yyyy',  // Show date in week format
                        month: 'MMM yyyy',     // Show date in month format
                        year: 'yyyy'           // Show date in year format
                    },
                    tooltipFormat: 'MMM dd, yyyy HH:mm', // Full date
                },
                adapters: {
                    date: {
                        locale: enGB
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)', // Subtle grid lines
                },
                ticks: {
                    maxTicksLimit: 10, // Limit number of ticks for readability
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)', // Subtle grid lines
                },
                ticks: {
                    callback: function(value) {
                        const numValue = Number(value);
                        
                        // Determine appropriate number of decimal places based on magnitude
                        if (Math.abs(numValue) >= 1000) {
                            return numValue.toFixed(0); // No decimals for large numbers
                        } else if (Math.abs(numValue) >= 10) {
                            return numValue.toFixed(1); // 1 decimal for numbers ≥ 10
                        } else if (Math.abs(numValue) >= 1) {
                            return numValue.toFixed(2); // 2 decimals for numbers ≥ 1
                        } else if (Math.abs(numValue) >= 0.1) {
                            return numValue.toFixed(3); // 3 decimals for numbers ≥ 0.1
                        } else if (Math.abs(numValue) >= 0.01) {
                            return numValue.toFixed(4); // 4 decimals for numbers ≥ 0.01
                        } else if (Math.abs(numValue) >= 0.001) {
                            return numValue.toFixed(5); // 5 decimals for numbers ≥ 0.001
                        } else if (numValue === 0) {
                            return '0'; // Just 0 for zero
                        } else {
                            // For very small numbers, use scientific notation or more decimals
                            return numValue < 0.0001 ? numValue.toExponential(2) : numValue.toFixed(6);
                        }
                    }
                }
            }
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true, // Use circular points in legend
                    pointStyle: 'circle',
                    padding: 20,
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                cornerRadius: 8,
                callbacks: {
                    title: function(context) {
                        const date = new Date(context[0].parsed.x);
                        return date.toLocaleDateString('en-GB', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    },
                    label: function(context) {
                        const numValue = Number(context.parsed.y);
                        let formattedValue;
                        
                        // Use the same formatting logic as Y-axis ticks
                        if (Math.abs(numValue) >= 1000) {
                            formattedValue = numValue.toFixed(0);
                        } else if (Math.abs(numValue) >= 10) {
                            formattedValue = numValue.toFixed(1);
                        } else if (Math.abs(numValue) >= 1) {
                            formattedValue = numValue.toFixed(2);
                        } else if (Math.abs(numValue) >= 0.1) {
                            formattedValue = numValue.toFixed(3);
                        } else if (Math.abs(numValue) >= 0.01) {
                            formattedValue = numValue.toFixed(4);
                        } else if (Math.abs(numValue) >= 0.001) {
                            formattedValue = numValue.toFixed(5);
                        } else if (numValue === 0) {
                            formattedValue = '0';
                        } else {
                            formattedValue = numValue < 0.0001 ? numValue.toExponential(2) : numValue.toFixed(6);
                        }
                        
                        return `${context.dataset.label}: ${formattedValue}`;
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: false, // Enable panning
                    mode: 'xy', // Allow panning on both x and y axes
                },
                zoom: {
                    drag: {
                        enabled: true, // Enable drag-to-zoom box
                        backgroundColor: 'rgba(54, 162, 235, 0.1)', // Modern blue highlight
                        borderColor: '#36A2EB', // Modern blue border
                        borderWidth: 2,
                    },
                    mode: 'xy', // Zoom both axes simultaneously
                },
            },
        },
    }

    const chartRef = useRef<ChartJS<'line', { x: string; y: number }[]>>(null);

    const API_URL = import.meta.env.VITE_BACKEND_API_URL;


    useEffect(() => {
        if (!projectPid) {
            console.warn('No project PID provided to MetricTimeline');
            setError(true);
            setLoading(false);
            return;
        }

        // Reset loading state
        setLoading(true);
        setError(false);

        // Create URLs for each metric
        const urls = metricNames.map(metricName => {
            if (evaluationPid) {
                return `${API_URL}/projects/${projectPid}/evaluations/${evaluationPid}/metrics?name=${metricName}`;
            } else {
                return `${API_URL}/metrics?project_pid=${projectPid}&name=${metricName}`;
            }
        });
        
        console.log('Fetching metrics from URLs:', urls);
        
        Promise.all(urls.map((url: string) => fetchMetricData(url)))
            .then(metricsArrays => {
                console.log('Raw metrics received:', metricsArrays);
                
                const parsedData = parse_datas(metricsArrays);
                console.log('After parsing:', parsedData);
                
                // Apply modern color palette
                const modernColors = [
                    '#FF6B6B', // Coral
                    '#4ECDC4', // Teal 
                    '#45B7D1', // Sky Blue
                    '#96CEB4', // Mint Green
                    '#FFEAA7', // Light Yellow
                    '#DDA0DD', // Plum
                    '#98D8C8', // Aquamarine
                    '#F7DC6F', // Banana Yellow
                    '#BB8FCE', // Light Purple
                    '#85C1E9', // Light Blue
                    '#F8C471', // Orange
                    '#82E0AA'  // Light Green
                ];
                
                parsedData.datasets.forEach((dataset: any, index) => {
                    const colorIndex = index % modernColors.length;
                    dataset.borderColor = modernColors[colorIndex];
                    dataset.backgroundColor = modernColors[colorIndex];
                    dataset.pointBackgroundColor = modernColors[colorIndex];
                    dataset.pointBorderColor = '#ffffff';
                    dataset.pointBorderWidth = 2;
                });
                
                let finalChartData = parsedData;
                
                if (group_by_feature) {
                    finalChartData = extract_feature_name(parsedData.datasets as any) as any;
                    console.log('After feature grouping:', finalChartData);
                    
                    // Apply colors to feature-grouped data
                    (finalChartData.datasets as any[]).forEach((dataset: any, index) => {
                        const colorIndex = index % modernColors.length;
                        dataset.borderColor = modernColors[colorIndex];
                        dataset.backgroundColor = modernColors[colorIndex];
                        dataset.pointBackgroundColor = modernColors[colorIndex];
                        dataset.pointBorderColor = '#ffffff';
                        dataset.pointBorderWidth = 2;
                        dataset.borderWidth = 3;
                        dataset.pointRadius = 4;
                        dataset.tension = 0; // No curve smoothing - straight lines between points
                    });
                }
                
                if (sort_by_value) {
                    finalChartData = sort_datasets(finalChartData.datasets as any) as any;
                    console.log('After sorting:', finalChartData);
                }
                
                setChartData(finalChartData as any);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error loading data:', error);
                setError(true);
                setLoading(false);
            });

    }, [metricNames, group_by_feature, sort_by_value, API_URL, projectPid, evaluationPid]);

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
                    <Box sx={{ height: '500px', width: '100%' }}>
                        <Line ref={chartRef} data={chartData} options={options} />
                    </Box>
                    <div id="legend-container"></div>
                </CardContent>
            </Card>
        </Box>
    );
}
