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
import {
    Accordion,
    AccordionActions,
    AccordionDetails,
    AccordionSummary,
    Box, Button, Card, CardContent, Divider, Paper, Tooltip,
    Typography
} from "@mui/material";
import GenericCsvDataGrid from "../components/GenericCsvDataGrid.tsx";
import GenericTextDataGrid from "../components/GenericTextDataGrid.tsx";
import {Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

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

    // Fetch feature flags
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

// TODO: buffers entire file in memory - use streaming (service worker or backend ?token=) for large artifacts
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

    const isPending = isEvaluationPending || measurementQueries.some(q => q.isPending) || artifactsQueries.some(q => q.isPending)
    const error = evaluationError || measurementQueries.find(q => q.error)?.error || artifactsQueries.find(q => q.error)?.error

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

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

    const renderVisualization = (pluginResult: PluginQueryResult, visualization: MetricVisualization) => {
        const filteredMeasurements = pluginResult.measurements!!.filter((m: Measurement) => {
            // Filter by metric names
            if (!visualization.metrics.includes(m.name)) return false;

            // Filter by dimensions if filter_dimensions is provided
            if (visualization.filter_dimensions && Object.keys(visualization.filter_dimensions).length > 0) {
                return Object.entries(visualization.filter_dimensions).every(([dimKey, allowedValues]) => {
                    const itemValue = m.dimensions?.[dimKey];
                    return allowedValues.includes(itemValue as string | number | boolean);
                });
            }

            return true;
        });

        if (filteredMeasurements.length === 0) return null;

        // const name = pluginDisplayNames[pluginResult.name] || pluginResult.name;
        const data = filteredMeasurements;
        const title = visualization.title || undefined;
        const description = visualization.description || undefined;
        const metricLabelDimension = visualization.metric_label_dimension || undefined;
        const groupByDimensions = visualization.group_by_dimensions || undefined;

        switch (visualization.chart_type) {
            case 'table': return <MeasurementsDataGrid title={title} description={description} data={data}/>;
            case 'line': return <MeasurementsLineChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
            case 'scatter': return <MeasurementsScatterChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
            case 'kde': return <MeasurementsKDEChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
            case 'bars': return <MeasurementsBarsChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
            case 'radar': return <MeasurementsRadarChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
            case 'pie': return <MeasurementsPieChart title={title} description={description} data={data} metricLabelDimension={metricLabelDimension} groupByDimensions={groupByDimensions} />;
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
        <Box>
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
        </Box>
    )
}

export default PluginEvaluationMeasurements
