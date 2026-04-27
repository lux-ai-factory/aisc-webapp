import {useQuery, useQueries} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useParams} from "react-router-dom";
import MeasurementsLineChart from "../components/plugin/MeasurementsLineChart.tsx";
import {Measurement} from "../models/models.tsx";
import MeasurementsDataGrid from "../components/plugin/MeasurementsDataGrid.tsx";
import MeasurementsScatterChart from "../components/plugin/MeasurementsScatterChart.tsx";
import MeasurementsRadarChart from "../components/plugin/MeasurementsRadarChart.tsx";
import MeasurementsKDEChart from "../components/plugin/MeasurementsKDEChart.tsx";
import MeasurementsBarsChart from "../components/plugin/MeasurementsBarsChart.tsx";
import MeasurementsPieChart from "../components/plugin/MeasurementsPieChart.tsx";
import ZipFileList from "../components/ZipFileList.tsx";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionActions,
    AccordionDetails,
    AccordionSummary,
    Button, Paper,
    Typography
} from "@mui/material";
import GenericCsvDataGrid from "../components/GenericCsvDataGrid.tsx";
import GenericTextDataGrid from "../components/GenericTextDataGrid.tsx";
import {Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface PluginQueryResult {
    name: string;
    measurements?: Measurement[];
    metric_visualizations?: any[];
    artifacts?: any[];
}

type PluginResultsMap = Record<string, PluginQueryResult>;

const getEvaluation = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');

    const res = await fetch(`${API_URL}/evaluations/${uuid}?include=project,dataset,model,datashape,plugin`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const getEvaluationMeasurements = async (evaluation_plugin_pid: string, plugin_name: string, evaluation_uuid: string) => {
    if (!evaluation_plugin_pid) throw new Error('Invalid evaluation plugin PID');
    if (!evaluation_uuid) throw new Error('Invalid uuid');

    const res = await fetch(`${API_URL}/plugins/${evaluation_plugin_pid}/evaluations/${evaluation_uuid}/result`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json()

    return {
        name: plugin_name,
        measurements: data.measurements,
        metric_visualizations: data.metric_visualizations
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

const handleDownload = (file_name: string) => {
    window.location.href = `${API_URL}/files/artifact/${file_name}`;
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
            queryFn: () => getEvaluationMeasurements(eval_plugin.pid, eval_plugin.name, evaluation_uuid ?? ""),
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

    const pluginResults = Object.keys(pluginMeasurements).reduce((acc, key) => {
        acc[key] = {...pluginMeasurements[key], ...pluginArtifacts[key]};
        return acc;
    }, {} as PluginResultsMap);

    return (
        <div>
            <h2>Evaluation: {evaluation_uuid}</h2>

            {pluginResults && Object.values(pluginResults).map((pluginResult) => (
                <div key={pluginResult['name']}>
                    <hr/>
                    <h3>Plugin: {pluginResult.name}</h3>
                    {pluginResult.measurements && pluginResult.measurements.length > 0 && <h4>Measurements</h4>}
                    {pluginResult.metric_visualizations && pluginResult.metric_visualizations.map((visualization: any, index: number) => {
                        const filteredMeasurements = pluginResult.measurements!!.filter(
                            (m: Measurement) => visualization.metrics.includes(m.name)
                        );

                        // Skip this visualization if no data
                        if (filteredMeasurements.length === 0) {
                            return null;
                        }

                        return (
                            <div key={index}>
                                {visualization.chart_type === 'table' && (
                                    <MeasurementsDataGrid
                                        title={`${pluginResult.name} - Table`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'line' && (
                                    <MeasurementsLineChart
                                        title={`${pluginResult.name} - Line Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'scatter' && (
                                    <MeasurementsScatterChart
                                        title={`${pluginResult.name} - Scatter Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'kde' && (
                                    <MeasurementsKDEChart
                                        title={`${pluginResult.name} - KDE Histogram Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'bars' && (
                                    <MeasurementsBarsChart
                                        title={`${pluginResult.name} - Bars Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'radar' && (
                                    <MeasurementsRadarChart
                                        title={`${pluginResult.name} - Radar Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'pie' && (
                                    <MeasurementsPieChart
                                        title={`${pluginResult.name} - Pie Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                            </div>
                        );
                    })}
                    {pluginResult.artifacts && pluginResult.artifacts!!.length > 0 && <h4>Artifacts</h4>}
                    {pluginResult.artifacts && pluginResult.artifacts!!.map((artifact: any) => {
                        // Skip this if no data
                        if (pluginResult.artifacts!!.length === 0) {
                            return null;
                        }

                        return (
                            <Accordion key={artifact.data}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                                    <Typography component="span">{artifact.name}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {(() => {
                                        switch (artifact.preview.type) {
                                            case '.csv':
                                                return <GenericCsvDataGrid data={artifact.preview.data}/>;
                                            case '.txt':
                                            case '.md':
                                                return <GenericTextDataGrid fileUrl={`${API_URL}/files/artifact/${artifact.data}`} />;
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
                                            case '.txt':
                                            case '.log':
                                                return (
                                                    <Paper
                                                        variant="outlined"
                                                        sx={{
                                                            p: 2,
                                                            backgroundColor: '#f5f5f5',
                                                            maxHeight: '500px',
                                                            overflow: 'auto'
                                                        }}
                                                    >
                                                        <Typography
                                                            component="pre"
                                                            variant="body2"
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-all'
                                                            }}
                                                        >
                                                            {artifact.preview.data}
                                                        </Typography>
                                                    </Paper>
                                                );
                                            default:
                                                return (
                                                    <Typography variant="body2" color="textSecondary" align="center"
                                                                sx={{py: 2}}>
                                                        No preview for this file type ({artifact.preview.type})
                                                    </Typography>
                                                );
                                        }
                                    })()}
                                </AccordionDetails>
                                <AccordionActions>
                                    <Button onClick={() => handleDownload(artifact.data)}>Download</Button>
                                </AccordionActions>
                            </Accordion>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

export default PluginEvaluationMeasurements
