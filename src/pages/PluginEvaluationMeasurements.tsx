import {useState, useMemo} from 'react';
import {useQuery, useQueries} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useParams} from "react-router-dom";
import MeasurementsLineChart from "../components/plugin/MeasurementsLineChart.tsx";
import {Artifact, Measurement, MetricVisualization, PluginFeatureFlags} from "../models/models.tsx";
import MeasurementsDataGrid from "../components/plugin/MeasurementsDataGrid.tsx";
import MeasurementsScatterChart from "../components/plugin/MeasurementsScatterChart.tsx";
import MeasurementsRadarChart from "../components/plugin/MeasurementsRadarChart.tsx";
import MeasurementsKDEChart from "../components/plugin/MeasurementsKDEChart.tsx";
import MeasurementsBarsChart from "../components/plugin/MeasurementsBarsChart.tsx";
import MeasurementsPieChart from "../components/plugin/MeasurementsPieChart.tsx";
import MeasurementsExplorer from "../components/plugin/MeasurementsExplorer.tsx";
import KpiScorecard from "../components/plugin/KpiScorecard.tsx";
import ZipFileList from "../components/ZipFileList.tsx";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import {
    Accordion,
    AccordionActions,
    AccordionDetails,
    AccordionSummary,
    Box, Button, Card, CardContent, Divider, Paper, Tooltip,
    Typography, FormControl, InputLabel, Select, MenuItem, OutlinedInput, Chip, Stack, IconButton, Alert
} from "@mui/material";
import GenericCsvDataGrid from "../components/GenericCsvDataGrid.tsx";
import GenericTextDataGrid from "../components/GenericTextDataGrid.tsx";
import {Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const DIMENSION_PALETTE = [
    '#d32f2f', // Red
    '#2e7d32', // Green
    '#ed6c02', // Orange
    '#9c27b0', // Purple
    '#009688', // Teal
    '#c2185b', // Pink
    '#e64a19', // Deep Orange
    '#5c6bc0', // Indigo
    '#afb42b', // Lime/Olive
    '#455a64'  // Blue Grey
];

interface PluginQueryResult {
    name: string;
    pid?: string;
    plugin_pid?: string;
    measurements?: Measurement[];
    metric_visualizations?: MetricVisualization[];
    artifacts?: Artifact[];
    feature_flags?: PluginFeatureFlags;
}

type PluginResultsMap = Record<string, PluginQueryResult>;

interface StoredChartConfig {
    id: number;
    chartType: string;
    selectedMetrics: string[];
    filters: Record<string, string[]>;
    groupByDimensions: string[];
    metricLabelDimension: string;
}

const getEvaluation = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');

    const res = await fetch(`${API_URL}/evaluations/${uuid}?include=project,dataset,model,datashape,plugin`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const getEvaluationMeasurements = async (evaluation_plugin_pid: string, plugin_name: string, evaluation_uuid: string, plugin_pid: string) => {
    if (!evaluation_plugin_pid) throw new Error('Invalid evaluation plugin PID');
    if (!evaluation_uuid) throw new Error('Invalid uuid');

    const res = await fetch(`${API_URL}/plugins/${evaluation_plugin_pid}/evaluations/${evaluation_uuid}/result`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json()

    const ffRes = await fetch(`${API_URL}/plugins/${plugin_pid}/feature_flags`);
    const feature_flags = ffRes.ok ? await ffRes.json() : null;

    return {
        name: plugin_name,
        pid: evaluation_plugin_pid,
        plugin_pid: plugin_pid,
        measurements: data.measurements,
        metric_visualizations: data.metric_visualizations,
        feature_flags
    }
};

const getEvaluationArtifacts = async (evaluation_plugin_uuid: string, plugin_name: string, evaluation_uuid: string) => {
    if (!evaluation_plugin_uuid) throw new Error('Invalid evaluation plugin PID');
    if (!evaluation_uuid) throw new Error('Invalid uuid');

    const res = await fetch(`${API_URL}/evaluations/${evaluation_uuid}/artifacts?evaluation_plugin_uuid=${evaluation_plugin_uuid}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json()

    return {
        name: plugin_name,
        artifacts: data
    }
};

const handleDownload = async (file_name: string) => {
    const response = await fetch(`${API_URL}/files/artifact/${file_name}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file_name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
};


function PluginEvaluationMeasurements() {
    const {evaluation_uuid} = useParams();

    // Custom Chart Builder state
    const [chartType, setChartType] = useState<string>('table');
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
    const [filterKey, setFilterKey] = useState<string>('');
    const [filterValue, setFilterValue] = useState<string>('');
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [groupByInput, setGroupByInput] = useState<string>('');
    const [groupByDimensions, setGroupByDimensions] = useState<string[]>([]);
    const [metricLabelDimension, setMetricLabelDimension] = useState<string>('');

    const {data: evaluation, isPending: isEvaluationPending, error: evaluationError} = useQuery({
        queryKey: ['evaluationMeasurements', evaluation_uuid],
        queryFn: () => getEvaluation(evaluation_uuid ?? ""),
    })

    const measurementQueries = useQueries({
        queries: (evaluation?.evaluation_plugins || []).map((eval_plugin: Plugin) => ({
            queryKey: ['pluginMeasurements', evaluation_uuid, eval_plugin.pid],
            queryFn: () => getEvaluationMeasurements(eval_plugin.pid, eval_plugin.name, evaluation_uuid ?? "", eval_plugin.plugin_pid || ""),
            enabled: !!evaluation_uuid && !!eval_plugin.pid
        }))
    })

    const artifactsQueries = useQueries({
        queries: (evaluation?.evaluation_plugins || []).map((eval_plugin: Plugin) => ({
            queryKey: ['pluginArtifacts', evaluation_uuid, eval_plugin.name],
            queryFn: () => getEvaluationArtifacts(eval_plugin.pid, eval_plugin.name, evaluation_uuid ?? ""),
            enabled: !!evaluation_uuid && !!eval_plugin.name
        }))
    })

    const pluginMeasurements = measurementQueries.reduce((acc, q) => {
        const data = q.data as PluginQueryResult;
        return data ? {...acc, [data.name]: data} : acc;
    }, {} as PluginResultsMap);

    const pluginArtifacts = artifactsQueries.reduce((acc, q) => {
        const data = q.data as PluginQueryResult;
        return data ? {...acc, [data.name]: data} : acc;
    }, {} as PluginResultsMap);

    const pluginDisplayNames = (evaluation?.evaluation_plugins || []).reduce((acc: Record<string, string>, p: Plugin) => {
        acc[p.name] = p.display_name;
        return acc;
    }, {} as Record<string, string>);

    const pluginResults = Object.keys(pluginMeasurements).reduce((acc, key) => {
        acc[key] = {...pluginMeasurements[key], ...pluginArtifacts[key]};
        return acc;
    }, {} as PluginResultsMap);

    // --- Core Data Hooks ---
    const allMeasurements = useMemo(() => {
        return Object.values(pluginResults).flatMap(pr => pr.measurements || []);
    }, [pluginResults]);

    const availableMetrics = useMemo(() => {
        return Array.from(new Set(allMeasurements.map(m => m.name))).sort();
    }, [allMeasurements]);

    const activeMeasurements = useMemo(() => {
        if (selectedMetrics.length === 0) return allMeasurements;
        return allMeasurements.filter(m => selectedMetrics.includes(m.name));
    }, [allMeasurements, selectedMetrics]);

    const availableDimensionKeys = useMemo(() => {
        const keys = new Set<string>();
        activeMeasurements.forEach(m => {
            if (m.dimensions) {
                Object.keys(m.dimensions).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys).sort();
    }, [activeMeasurements]);

    const availableFilterValues = useMemo(() => {
        if (!filterKey) return [];
        const values = new Set<string>();
        activeMeasurements.forEach(m => {
            if (m.dimensions && m.dimensions[filterKey] !== undefined && m.dimensions[filterKey] !== null) {
                values.add(String(m.dimensions[filterKey]));
            }
        });
        return Array.from(values).sort();
    }, [activeMeasurements, filterKey]);

    const metricsToDisplay = useMemo(() => {
        return selectedMetrics.length > 0 ? selectedMetrics : availableMetrics;
    }, [selectedMetrics, availableMetrics]);

    const dimensionMetricCount = useMemo(() => {
        const counts = new Map<string, number>();
        metricsToDisplay.forEach(metricName => {
            const metricMeasurements = allMeasurements.filter(m => m.name === metricName);
            const keysInMetric = new Set<string>();
            metricMeasurements.forEach(m => {
                if (m.dimensions) {
                    Object.keys(m.dimensions).forEach(k => keysInMetric.add(k));
                }
            });
            keysInMetric.forEach(k => {
                counts.set(k, (counts.get(k) || 0) + 1);
            });
        });
        return counts;
    }, [metricsToDisplay, allMeasurements]);

    const sharedDimensionsColors = useMemo(() => {
        const shared = Array.from(dimensionMetricCount.entries())
            .filter(([_, count]) => count > 1)
            .map(([key, _]) => key)
            .sort();

        const colorMap = new Map<string, string>();
        shared.forEach((key, index) => {
            colorMap.set(key, DIMENSION_PALETTE[index % DIMENSION_PALETTE.length]);
        });
        return colorMap;
    }, [dimensionMetricCount]);

    // --- Local Storage Handlers ---
    const getStoredChartsForPlugin = (pluginName: string): StoredChartConfig[] => {
        try {
            const data = localStorage.getItem(`stored_charts_${pluginName}`);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    };

    const handleStoreChart = () => {
        const metricsToStore = selectedMetrics.length > 0 ? selectedMetrics : availableMetrics;
        if (metricsToStore.length === 0) return;

        const targetPlugins = Object.values(pluginResults).filter(pr =>
            pr.measurements?.some(m => metricsToStore.includes(m.name))
        );

        if (targetPlugins.length === 0) return;

        const newChart: StoredChartConfig = {
            id: Date.now(),
            chartType,
            selectedMetrics: metricsToStore,
            filters,
            groupByDimensions,
            metricLabelDimension,
        };

        targetPlugins.forEach(plugin => {
            const existing = getStoredChartsForPlugin(plugin.name);
            const updated = [...existing, newChart];
            localStorage.setItem(`stored_charts_${plugin.name}`, JSON.stringify(updated));
        });
    };

    const handleDeleteStoredChart = (pluginName: string, chartId: number) => {
        if (window.confirm("Removing the stored chart will remove it for all results pages for this plugin.")) {
            try {
                const existing = getStoredChartsForPlugin(pluginName);
                const updated = existing.filter(c => c.id !== chartId);
                localStorage.setItem(`stored_charts_${pluginName}`, JSON.stringify(updated));
            } catch (e) {
                console.error(e);
            }
        }
    };


    const isPending = isEvaluationPending || measurementQueries.some(q => q.isPending) || artifactsQueries.some(q => q.isPending)
    const error = evaluationError || measurementQueries.find(q => q.error)?.error || artifactsQueries.find(q => q.error)?.error

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleAddFilter = () => {
        if (!filterKey || !filterValue) return;
        setFilters(prev => ({
            ...prev,
            [filterKey]: [...(prev[filterKey] || []), filterValue]
        }));
        setFilterValue('');
    };

    const handleAddGroupBy = () => {
        if (!groupByInput || groupByDimensions.includes(groupByInput)) return;
        setGroupByDimensions(prev => [...prev, groupByInput]);
        setGroupByInput('');
    };

    const renderVisualization = (pluginResult: PluginQueryResult, visualization: MetricVisualization) => {
        const filteredMeasurements = pluginResult.measurements!!.filter((m: Measurement) => {
            if (!visualization.metrics.includes(m.name)) return false;

            if (visualization.filter_dimensions && Object.keys(visualization.filter_dimensions).length > 0) {
                return Object.entries(visualization.filter_dimensions).every(([dimKey, allowedValues]) => {
                    const itemValue = m.dimensions?.[dimKey];
                    return (allowedValues as any[]).includes(itemValue as string | number | boolean);
                });
            }

            return true;
        });

        if (filteredMeasurements.length === 0) {
            return (
                <Alert severity="warning" sx={{ my: 2 }}>
                    Cannot show result: no matching measurements found for the selected metrics, filters, or groups for this evaluation.
                </Alert>
            );
        }

        const data = filteredMeasurements;
        const title = visualization.title || undefined;
        const description = visualization.description || undefined;
        const metricLabelDimension = visualization.metric_label_dimension || undefined;
        const groupByDimensionsList = visualization.group_by_dimensions || undefined;

        switch (visualization.chart_type) {
            case 'table': return <MeasurementsDataGrid title={title} description={description} data={data}/>;
            case 'line': return <MeasurementsLineChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            case 'scatter': return <MeasurementsScatterChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            case 'kde': return <MeasurementsKDEChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            case 'bars': return <MeasurementsBarsChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            case 'radar': return <MeasurementsRadarChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            case 'pie': return <MeasurementsPieChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensionsList} />;
            default: return null;
        }
    };

    const renderArtifactPreview = (artifact: any) => {
        switch (artifact.preview.type) {
            case '.csv':
                return <GenericCsvDataGrid data={artifact.preview.data}/>;
            case '.txt':
            case '.md':
                return <GenericTextDataGrid fileUrl={`${API_URL}/files/artifact/${artifact.data}`} />;
            case '.log':
                return (
                    <Paper variant="outlined" sx={{p: 2, backgroundColor: '#f5f5f5', maxHeight: '500px', overflow: 'auto'}}>
                        <Typography component="pre" variant="body2" sx={{fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
                            {artifact.preview.data}
                        </Typography>
                    </Paper>
                );
            case '.png':
                return (
                    <Paper sx={{width: 'fit-content', margin: 'auto'}}>
                        <img src={artifact.preview.data} alt={artifact.artifact_name}/>
                    </Paper>
                );
            case '.pdf':
                return (
                    <iframe
                        title={artifact.artifact_name}
                        src={artifact.preview.data}
                        width="100%"
                        height="800px"
                    >
                        <p>Your browser does not support iframes.</p>
                    </iframe>
                );
            case '.zip':
                return <ZipFileList files={artifact.preview.data}/>;
            default:
                return (
                    <Typography variant="body2" color="textSecondary" align="center" sx={{py: 2}}>
                        No preview for this file type ({artifact.preview.type})
                    </Typography>
                );
        }
    };

    return (
        <Box sx={{ pb: 6 }}>
            <Typography variant="h4" gutterBottom>
                <Tooltip title={evaluation_uuid} placement="right">
                    <span>Evaluation:</span>
                </Tooltip>
                {evaluation?.dataset && <Typography variant="subtitle1" color="text.secondary">Dataset: {evaluation.dataset.name} | Model: {evaluation.model?.name}</Typography>}
            </Typography>

            {pluginResults && Object.values(pluginResults).map((pluginResult) => {
                const displayName = pluginDisplayNames[pluginResult.name] || pluginResult.name;
                const hasMeasurements = pluginResult.measurements && pluginResult.measurements.length > 0;
                const hasArtifacts = pluginResult.artifacts && pluginResult.artifacts.length > 0;
                const showDimensionsVisualisation = pluginResult.feature_flags?.show_dimensions_visualisation
                const storedPluginCharts = getStoredChartsForPlugin(pluginResult.name);

                return (
                    <Card key={pluginResult.name} variant="outlined" sx={{mb: 3}}>
                        <CardContent>
                            <Typography variant="h5" fontWeight="bold" gutterBottom>
                                {displayName}
                            </Typography>
                            <Divider sx={{ mb: 2 }} />

                            {showDimensionsVisualisation && (
                                <MeasurementsExplorer evaluationPid={evaluation_uuid!!} evaluationPluginPid={pluginResult.pid} />
                            )}

                            {hasMeasurements && (
                                <>
                                    <Typography variant="h6" sx={{mt: 2, mb: 1}} color="primary">
                                        Key Results
                                    </Typography>
                                    <Divider sx={{mb: 2}} />
                                    <KpiScorecard measurements={pluginResult.measurements!!} />
                                    {pluginResult.metric_visualizations && pluginResult.metric_visualizations.length > 0 && (
                                        <Accordion sx={{mt: 2}}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                                <Typography component="span" color="primary">Detailed measurements</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                {pluginResult.metric_visualizations.map(
                                                    (visualization: any, index: number) => (
                                                        <Box key={index} sx={{mb: 2}}>
                                                            {renderVisualization(pluginResult, visualization)}
                                                        </Box>
                                                    )
                                                )}
                                            </AccordionDetails>
                                        </Accordion>
                                    )}
                                </>
                            )}

                            {/* Stored Custom Charts for this Plugin */}
                            {storedPluginCharts.length > 0 && (
                                <Accordion sx={{mt: 2}}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                        <Typography component="span" color="primary">Stored Custom Charts</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        {storedPluginCharts.map((chartConfig) => {
                                            const filtersDesc = Object.keys(chartConfig.filters).length > 0
                                                ? ` | Filters: ${Object.entries(chartConfig.filters).map(([k, v]) => `${k}=(${v.join(', ')})`).join(', ')}`
                                                : '';
                                            const groupsDesc = chartConfig.groupByDimensions.length > 0
                                                ? ` | Groups: ${chartConfig.groupByDimensions.join(', ')}`
                                                : '';
                                            const labelDimDesc = chartConfig.metricLabelDimension
                                                ? ` | Label Dim: ${chartConfig.metricLabelDimension}`
                                                : '';
                                            const descriptionText = `Type: ${chartConfig.chartType.toUpperCase()} | Metrics: ${chartConfig.selectedMetrics.join(', ')}${filtersDesc}${groupsDesc}${labelDimDesc}`;

                                            return (
                                                <Card key={chartConfig.id} variant="outlined" sx={{ mb: 2, p: 2, bgcolor: 'background.default' }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ wordBreak: 'break-word', pr: 2 }}>
                                                            {descriptionText}
                                                        </Typography>
                                                        <Tooltip title="Remove stored chart">
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDeleteStoredChart(pluginResult.name, chartConfig.id)}
                                                                sx={{ flexShrink: 0 }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                    {renderVisualization(pluginResult, {
                                                        chart_type: chartConfig.chartType as any,
                                                        metrics: chartConfig.selectedMetrics,
                                                        filter_dimensions: Object.keys(chartConfig.filters).length > 0 ? chartConfig.filters : undefined,
                                                        metric_label_dimension: chartConfig.metricLabelDimension || undefined,
                                                        group_by_dimensions: chartConfig.groupByDimensions.length > 0 ? chartConfig.groupByDimensions : undefined
                                                    })}
                                                </Card>
                                            );
                                        })}
                                    </AccordionDetails>
                                </Accordion>
                            )}

                            {hasArtifacts && (
                                <>
                                    <Typography variant="h6" sx={{mt: 3, mb: 1}} color="primary">
                                        Artifacts
                                    </Typography>
                                    <Divider sx={{mb: 2}} />
                                    {pluginResult.artifacts!!.map((artifact: any) => (
                                        <Accordion key={artifact.data} sx={{mb: 1}}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                                <Typography component="span">{artifact.name}</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                {renderArtifactPreview(artifact)}
                                            </AccordionDetails>
                                            <AccordionActions>
                                                <Button onClick={() => handleDownload(artifact.data)}>Download</Button>
                                            </AccordionActions>
                                        </Accordion>
                                    ))}
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })}

            {/* Custom Chart Builder */}
            {allMeasurements.length > 0 && (
                <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box>
                            <Typography variant="h6" gutterBottom color="primary">
                                Custom Chart Builder
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Configure charting parameters dynamically and store charts for this plugin in local storage.
                            </Typography>
                        </Box>
                        <Tooltip title="Will be stored in local storage">
                            <span>
                                <Button
                                    variant="contained"
                                    startIcon={<BookmarkAddIcon />}
                                    onClick={handleStoreChart}
                                >
                                    Store Chart
                                </Button>
                            </span>
                        </Tooltip>
                    </Box>

                    <Stack spacing={3}>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {/* Select Chart Type */}
                            <FormControl sx={{ minWidth: 200 }} size="small">
                                <InputLabel>Chart Type</InputLabel>
                                <Select
                                    value={chartType}
                                    label="Chart Type"
                                    onChange={(e) => setChartType(e.target.value)}
                                >
                                    <MenuItem value="table">Table</MenuItem>
                                    <MenuItem value="line">Line</MenuItem>
                                    <MenuItem value="scatter">Scatter</MenuItem>
                                    <MenuItem value="kde">KDE</MenuItem>
                                    <MenuItem value="bars">Bars</MenuItem>
                                    <MenuItem value="radar">Radar</MenuItem>
                                    <MenuItem value="pie">Pie</MenuItem>
                                </Select>
                            </FormControl>

                            {/* Select Metric(s) */}
                            <FormControl sx={{ minWidth: 250 }} size="small">
                                <InputLabel>Metrics</InputLabel>
                                <Select
                                    multiple
                                    value={selectedMetrics}
                                    onChange={(e) => setSelectedMetrics(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                                    input={<OutlinedInput label="Metrics" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.length === 0 ? <em>All Metrics</em> : selected.map((value) => (
                                                <Chip key={value} label={value} size="small" />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {availableMetrics.map((metricName) => (
                                        <MenuItem key={metricName} value={metricName}>
                                            {metricName}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Select Metric Label Dimension */}
                            <FormControl sx={{ minWidth: 250 }} size="small">
                                <InputLabel>Metric Label Dimension</InputLabel>
                                <Select
                                    value={metricLabelDimension}
                                    label="Metric Label Dimension"
                                    onChange={(e) => setMetricLabelDimension(e.target.value)}
                                >
                                    <MenuItem value=""><em>None</em></MenuItem>
                                    {availableDimensionKeys.map((key) => (
                                        <MenuItem key={key} value={key}>
                                            {key}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Filter Dimensions Input */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <FormControl sx={{ minWidth: 200 }} size="small">
                                <InputLabel>Filter Dimension Key</InputLabel>
                                <Select
                                    value={filterKey}
                                    label="Filter Dimension Key"
                                    onChange={(e) => {
                                        setFilterKey(e.target.value);
                                        setFilterValue('');
                                    }}
                                >
                                    {availableDimensionKeys.map(key => (
                                        <MenuItem key={key} value={key}>{key}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl sx={{ minWidth: 200 }} size="small" disabled={!filterKey}>
                                <InputLabel>Filter Dimension Value</InputLabel>
                                <Select
                                    value={filterValue}
                                    label="Filter Dimension Value"
                                    onChange={(e) => setFilterValue(e.target.value)}
                                >
                                    {availableFilterValues.map(val => (
                                        <MenuItem key={val} value={val}>{val}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Button variant="outlined" size="small" onClick={handleAddFilter} disabled={!filterKey || !filterValue}>
                                Add Filter Rule
                            </Button>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {Object.entries(filters).map(([k, values]) => (
                                    <Chip
                                        key={k}
                                        label={`${k}: ${values.join(', ')}`}
                                        onDelete={() => {
                                            setFilters(prev => {
                                                const copy = {...prev};
                                                delete copy[k];
                                                return copy;
                                            });
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* Group By Dimensions Input */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <FormControl sx={{ minWidth: 250 }} size="small">
                                <InputLabel>Group By Dimension Key</InputLabel>
                                <Select
                                    value={groupByInput}
                                    label="Group By Dimension Key"
                                    onChange={(e) => setGroupByInput(e.target.value)}
                                >
                                    {availableDimensionKeys.map(key => (
                                        <MenuItem key={key} value={key}>{key}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Button variant="outlined" size="small" onClick={handleAddGroupBy} disabled={!groupByInput}>
                                Add Group By Key
                            </Button>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {groupByDimensions.map((dim) => (
                                    <Chip
                                        key={dim}
                                        label={dim}
                                        onDelete={() => setGroupByDimensions(prev => prev.filter(d => d !== dim))}
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* Tree View helper for metrics */}
                        {metricsToDisplay.length > 0 && (
                            <Accordion variant="outlined" sx={{ bgcolor: 'background.default', boxShadow: 'none' }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        {selectedMetrics.length > 0
                                            ? "View Dimension Tree for Selected Metrics"
                                            : "View Dimension Tree for All Metrics"}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {sharedDimensionsColors.size > 0 && (
                                        <Box sx={{ mb: 3 }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Common Dimensions (Shared across metrics)
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                {Array.from(sharedDimensionsColors.entries()).map(([key, color]) => (
                                                    <Chip
                                                        key={key}
                                                        label={key}
                                                        size="small"
                                                        sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold' }}
                                                    />
                                                ))}
                                            </Box>
                                            <Divider sx={{ mt: 2 }} />
                                        </Box>
                                    )}

                                    <Stack spacing={3}>
                                        {metricsToDisplay.map((metricName) => {
                                            const metricMeasurements = allMeasurements.filter(m => m.name === metricName);
                                            const dimMap = new Map<string, Set<string>>();

                                            metricMeasurements.forEach(m => {
                                                if (m.dimensions) {
                                                    Object.entries(m.dimensions).forEach(([key, value]) => {
                                                        if (!dimMap.has(key)) dimMap.set(key, new Set());
                                                        if (value !== undefined && value !== null) dimMap.get(key)!.add(String(value));
                                                    });
                                                }
                                            });

                                            return (
                                                <Box key={metricName}>
                                                    <Typography
                                                        variant="subtitle1"
                                                        fontWeight="bold"
                                                        sx={{ color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5, mb: 1 }}
                                                    >
                                                        {metricName}
                                                    </Typography>

                                                    {dimMap.size === 0 ? (
                                                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2, mt: 0.5 }}>
                                                            No dimensions recorded.
                                                        </Typography>
                                                    ) : (
                                                        <Box sx={{ ml: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider', mt: 1 }}>
                                                            {Array.from(dimMap.entries()).sort().map(([key, valueSet]) => {
                                                                const dimColor = sharedDimensionsColors.get(key);

                                                                return (
                                                                    <Box key={key} sx={{ mb: 1.5 }}>
                                                                        <Typography
                                                                            variant="body2"
                                                                            fontWeight="bold"
                                                                            sx={{ color: dimColor || 'text.secondary' }}
                                                                        >
                                                                            {key}
                                                                        </Typography>
                                                                        <Box sx={{
                                                                            ml: 1,
                                                                            pl: 2,
                                                                            borderLeft: '1px dashed',
                                                                            borderColor: 'divider',
                                                                            mt: 0.5,
                                                                            display: 'flex',
                                                                            gap: 0.5,
                                                                            flexWrap: 'wrap'
                                                                        }}>
                                                                            {Array.from(valueSet).sort().map(val => (
                                                                                <Chip
                                                                                    key={val}
                                                                                    label={val}
                                                                                    size="small"
                                                                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                                                                />
                                                                            ))}
                                                                        </Box>
                                                                    </Box>
                                                                )
                                                            })}
                                                        </Box>
                                                    )}
                                                </Box>
                                            )
                                        })}
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </Stack>

                    {/* Render Custom Visualization Preview */}
                    <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                        {renderVisualization(
                            { name: "Custom View", measurements: allMeasurements },
                            {
                                chart_type: chartType as any,
                                metrics: selectedMetrics.length > 0 ? selectedMetrics : availableMetrics,
                                filter_dimensions: Object.keys(filters).length > 0 ? filters : undefined,
                                metric_label_dimension: metricLabelDimension || undefined,
                                group_by_dimensions: groupByDimensions.length > 0 ? groupByDimensions : undefined
                            }
                        )}
                    </Box>
                </Paper>
            )}
        </Box>
    )
}

export default PluginEvaluationMeasurements