/**
 * @fileoverview MetricTimeline component for visualizing time-series metric data
 * using Chart.js. Supports zooming, panning, and feature-based grouping of metrics.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Typography, Card, CardContent, CircularProgress, IconButton, Tooltip, Modal } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables, ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { mapMetricsName } from "../utils";
import { enGB } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';
import { CenterFocusWeak, Home, OpenWith, Fullscreen, FullscreenExit } from "@mui/icons-material";
import { API_VERSION_PREFIX } from "../config";

ChartJS.register(...registerables, zoomPlugin);

// Constants
const MODERN_COLORS = [
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
] as const;

const DEFAULT_CHART_OPTIONS = {
    borderWidth: 3,
    pointRadius: 4,
    pointBorderWidth: 2,
    pointBorderColor: '#ffffff',
    tension: 0,
} as const;

// Types
interface MetricApiData {
    name: string;
    time: string;
    score: number;
    feature: {
        name: string;
    };
}

interface ChartDataPoint {
    x: string;
    y: number;
}

interface ChartDataPointWithFeature extends ChartDataPoint {
    feature: string;
}

interface ChartDataset {
    label: string;
    data: ChartDataPoint[];
    fill: boolean;
    tension: number;
    borderWidth?: number;
    pointRadius?: number;
    borderColor?: string;
    backgroundColor?: string;
    pointBackgroundColor?: string;
    pointBorderColor?: string;
    pointBorderWidth?: number;
}

interface ChartData {
    datasets: ChartDataset[];
}

interface ProcessedMetricData {
    label: string;
    data: ChartDataPointWithFeature[];
    fill: boolean;
    tension: number;
}

type InteractionMode = 'Pan' | 'Zoom';

interface MetricTimelineProps {
    cardTitle: string;
    metricNames: string[];
    projectPid: string;
    evaluationPid?: string;
    group_by_feature?: boolean;
    sort_by_value?: boolean;
}

interface GraphControlsProps {
    chart?: ChartJS<'line', ChartDataPoint[], unknown> | null;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}

// Utility functions
const removeDuplicates = (items: MetricApiData[]): MetricApiData[] => {
    return items.filter((item, idx, self) =>
        idx === self.findIndex(t =>
            t.time === item.time &&
            t.feature?.name === item.feature?.name &&
            t.name === item.name
        )
    );
};

const sortByTime = <T extends { x: string }>(data: T[]): T[] => {
    return [...data].sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());
};

const formatNumber = (value: number): string => {
    const absValue = Math.abs(value);

    if (absValue >= 1000) return value.toFixed(0);
    if (absValue >= 10) return value.toFixed(1);
    if (absValue >= 1) return value.toFixed(2);
    if (absValue >= 0.1) return value.toFixed(3);
    if (absValue >= 0.01) return value.toFixed(4);
    if (absValue >= 0.001) return value.toFixed(5);
    if (value === 0) return '0';

    return value < 0.0001 ? value.toExponential(2) : value.toFixed(6);
};

const createDataPoint = (apiData: MetricApiData): ChartDataPointWithFeature => ({
    x: new Date(apiData.time).toISOString(),
    y: apiData.score,
    feature: apiData.feature?.name || 'Unknown'
});

const stripFeatureFromDataPoint = ({ x, y }: ChartDataPointWithFeature): ChartDataPoint => ({ x, y });

// Data processing functions
const parseMetricData = (metricsArrays: MetricApiData[][]): ChartData => {
    const datasets: ChartDataset[] = metricsArrays.map(metric => {
        const uniqueData = removeDuplicates(metric);
        const parsedData = uniqueData.map(createDataPoint);
        const sortedData = sortByTime(parsedData);
        const metricLabel = metric.length > 0 ? mapMetricsName(metric[0].name) || 'Unknown' : 'Unknown';

        return {
            label: metricLabel,
            data: sortedData.map(stripFeatureFromDataPoint),
            fill: false,
            ...DEFAULT_CHART_OPTIONS,
        };
    });

    return { datasets };
};

const processMetricDataWithFeatures = (metricsArrays: MetricApiData[][]): ProcessedMetricData[] => {
    return metricsArrays.map(metric => {
        const uniqueData = removeDuplicates(metric);
        const parsedData = uniqueData.map(createDataPoint);
        const sortedData = sortByTime(parsedData);
        const metricLabel = metric.length > 0 ? mapMetricsName(metric[0].name) || 'Unknown' : 'Unknown';

        return {
            label: metricLabel,
            data: sortedData,
            fill: false,
            tension: 0,
        };
    });
};

const groupDatasetsByFeature = (processedData: ProcessedMetricData[]): ChartData => {
    const datasets: ChartDataset[] = processedData.flatMap(metric => {
        const uniqueFeatures = Array.from(new Set(metric.data.map(d => d.feature)));

        return uniqueFeatures.map(feature => ({
            label: feature,
            data: metric.data
                .filter(d => d.feature === feature)
                .map(stripFeatureFromDataPoint),
            fill: metric.fill,
            tension: metric.tension,
        }));
    });

    return { datasets };
};

const sortDatasetsByMaxValue = (chartData: ChartData): ChartData => {
    const sortedDatasets = [...chartData.datasets].sort((a, b) => {
        const aMax = Math.max(...a.data.map(d => d.y));
        const bMax = Math.max(...b.data.map(d => d.y));
        return bMax - aMax;
    });

    return { datasets: sortedDatasets };
};

const applyModernColors = (chartData: ChartData): ChartData => {
    const datasetsWithColors = chartData.datasets.map((dataset, index) => {
        const colorIndex = index % MODERN_COLORS.length;
        const color = MODERN_COLORS[colorIndex];

        return {
            ...dataset,
            borderColor: color,
            backgroundColor: color,
            pointBackgroundColor: color,
            pointBorderColor: DEFAULT_CHART_OPTIONS.pointBorderColor,
            pointBorderWidth: DEFAULT_CHART_OPTIONS.pointBorderWidth,
            borderWidth: DEFAULT_CHART_OPTIONS.borderWidth,
            pointRadius: DEFAULT_CHART_OPTIONS.pointRadius,
            tension: DEFAULT_CHART_OPTIONS.tension,
        };
    });

    return { datasets: datasetsWithColors };
};

// API functions
const fetchMetricData = async (url: string): Promise<MetricApiData[]> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
    }
    return response.json();
};

// Components
const Loading = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
    </Box>
);

const ErrorComponent = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography component="h3" variant="subtitle2" gutterBottom>
            Error loading data
        </Typography>
    </Box>
);

export const GraphControls = ({ chart, isFullscreen, onToggleFullscreen }: GraphControlsProps) => {
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('Zoom');

    const handleZoom = useCallback(() => {
        if (!chart?.options.plugins?.zoom) return;

        const zoomOptions = chart.options.plugins.zoom;
        if (zoomOptions.zoom?.drag?.enabled !== undefined) {
            zoomOptions.zoom.drag.enabled = true;
        }
        if (zoomOptions.pan?.enabled !== undefined) {
            zoomOptions.pan.enabled = false;
        }

        setInteractionMode('Zoom');
        chart.update();
    }, [chart]);

    const handlePan = useCallback(() => {
        if (!chart?.options.plugins?.zoom) return;

        const zoomOptions = chart.options.plugins.zoom;
        if (zoomOptions.zoom?.drag?.enabled !== undefined) {
            zoomOptions.zoom.drag.enabled = false;
        }
        if (zoomOptions.pan?.enabled !== undefined) {
            zoomOptions.pan.enabled = true;
        }

        setInteractionMode('Pan');
        chart.update();
    }, [chart]);

    const handleResetZoom = useCallback(() => {
        if (!chart) return;
        chart.resetZoom();
    }, [chart]);

    const buttonStyle = useCallback((mode: InteractionMode) => ({
        color: interactionMode === mode ? 'primary.main' : 'gray',
        '&:hover': { color: 'primary.main' },
    }), [interactionMode]);

    const toggleButtonStyle = {
        color: 'gray',
        '&:hover': { color: 'primary.main' },
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Zoom">
                <IconButton size="small" onClick={handleZoom} sx={buttonStyle('Zoom')}>
                    <CenterFocusWeak />
                </IconButton>
            </Tooltip>
            <Tooltip title="Pan">
                <IconButton size="small" onClick={handlePan} sx={buttonStyle('Pan')}>
                    <OpenWith />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset Zoom">
                <IconButton size="small" onClick={handleResetZoom} sx={toggleButtonStyle}>
                    <Home />
                </IconButton>
            </Tooltip>
            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                <IconButton size="small" onClick={onToggleFullscreen} sx={toggleButtonStyle}>
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

// Chart content component for reusability
const ChartContent = ({
    cardTitle,
    chartData,
    chartOptions,
    chartRef,
    isFullscreen,
    onToggleFullscreen
}: {
    cardTitle: string;
    chartData: ChartData;
    chartOptions: ChartOptions<'line'>;
    chartRef: React.RefObject<ChartJS<'line', ChartDataPoint[]>>;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) => (
    <>
        <Typography component="h3" variant="h5" gutterBottom>
            {cardTitle}
        </Typography>
        <Box display="flex" justifyContent="flex-end">
            <GraphControls
                chart={chartRef.current}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
            />
        </Box>
        <Box sx={{ height: isFullscreen ? 'calc(100vh - 200px)' : '500px', width: '100%' }}>
            <Line ref={chartRef} data={chartData} options={chartOptions} />
        </Box>
    </>
);

// Main component
const MetricTimeline = ({
    cardTitle,
    metricNames,
    projectPid,
    evaluationPid,
    group_by_feature = false,
    sort_by_value = false
}: MetricTimelineProps) => {
    const [chartData, setChartData] = useState<ChartData>({ datasets: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const chartRef = useRef<ChartJS<'line', ChartDataPoint[]>>(null);
    const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => !prev);
    }, []);

    // Handle escape key to exit fullscreen
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleEscapeKey);
            return () => document.removeEventListener('keydown', handleEscapeKey);
        }
    }, [isFullscreen]);

    // Memoized chart options
    const chartOptions: ChartOptions<'line'> = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        scales: {
            x: {
                type: 'time' as const,
                time: {
                    unit: 'day' as const,
                    displayFormats: {
                        day: 'MMM dd, yyyy',
                        week: 'MMM dd, yyyy',
                        month: 'MMM yyyy',
                        year: 'yyyy'
                    },
                    tooltipFormat: 'MMM dd, yyyy HH:mm',
                },
                adapters: {
                    date: { locale: enGB }
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: { maxTicksLimit: 10 },
            },
            y: {
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    callback: (value) => formatNumber(Number(value))
                }
            }
        },
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle' as const,
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
                    title: (context) => {
                        const date = new Date(context[0].parsed.x);
                        return date.toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    },
                    label: (context) => {
                        const formattedValue = formatNumber(Number(context.parsed.y));
                        return `${context.dataset.label}: ${formattedValue}`;
                    }
                }
            },
            zoom: {
                pan: {
                    enabled: false,
                    mode: 'xy' as const,
                },
                zoom: {
                    drag: {
                        enabled: true,
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderColor: '#36A2EB',
                        borderWidth: 2,
                    },
                    mode: 'xy' as const,
                },
            },
        },
    }), []);

    // Memoized URLs
    const urls = useMemo(() => {
        if (!projectPid) return [];

        return metricNames.map(metricName => {
            if (evaluationPid) {
                return `${API_URL}/projects/${projectPid}/evaluations/${evaluationPid}/metrics?name=${metricName}`;
            }
            return `${API_URL}/metrics?project_pid=${projectPid}&name=${metricName}`;
        });
    }, [metricNames, projectPid, evaluationPid, API_URL]);

    // Data processing logic
    const processChartData = useCallback((metricsArrays: MetricApiData[][]) => {
        let result: ChartData;

        if (group_by_feature) {
            const processedData = processMetricDataWithFeatures(metricsArrays);
            result = groupDatasetsByFeature(processedData);
        } else {
            result = parseMetricData(metricsArrays);
        }

        if (sort_by_value) {
            result = sortDatasetsByMaxValue(result);
        }

        return applyModernColors(result);
    }, [group_by_feature, sort_by_value]);

    // Main data fetching effect
    useEffect(() => {
        if (!projectPid || urls.length === 0) {
            setError('No project PID provided or no metric names specified');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        Promise.all(urls.map(fetchMetricData))
            .then(metricsArrays => {
                const processedData = processChartData(metricsArrays);
                setChartData(processedData);
            })
            .catch(err => {
                console.error('Error loading metric data:', err);
                setError(err.message || 'Failed to load metric data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [urls, processChartData, projectPid]);

    if (loading) return <Loading />;
    if (error) return <ErrorComponent />;

    const chartContent = (
        <ChartContent
            cardTitle={cardTitle}
            chartData={chartData}
            chartOptions={chartOptions}
            chartRef={chartRef}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
        />
    );

    return (
        <>
            <Box sx={{ width: 1 }}>
                <Card variant="outlined" sx={{ flexGrow: 1, mb: 2 }}>
                    <CardContent>
                        {!isFullscreen && chartContent}
                    </CardContent>
                </Card>
            </Box>

            {/* Fullscreen Modal */}
            <Modal
                open={isFullscreen}
                onClose={toggleFullscreen}
                aria-labelledby="fullscreen-chart-modal"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Box
                    sx={{
                        width: '95vw',
                        height: '95vh',
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        boxShadow: 24,
                        p: 3,
                        outline: 'none',
                        overflow: 'hidden',
                    }}
                >
                    {chartContent}
                </Box>
            </Modal>
        </>
    );
};

export default MetricTimeline;
