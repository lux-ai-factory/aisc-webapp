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

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const getEvaluation = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/evaluations/${uuid}?include=project,dataset,model,datashape,plugin`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const getEvaluationMeasurements = async (plugin_name: string, evaluation_uuid: string) => {
    if (!plugin_name) throw new Error('Invalid plugin name');
    if (!evaluation_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/evaluations/${evaluation_uuid}/result`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json()
    return {
        name: plugin_name,
        measurements: data.measurements,
        metric_visualizations: data.metric_visualizations
    }
};


function PluginEvaluationMeasurements() {
    const {evaluation_uuid} = useParams();

    const {data: evaluation, isPending: isEvaluationPending, error: evaluationError} = useQuery({
        queryKey: ['evaluationMeasurements', evaluation_uuid],
        queryFn: () => getEvaluation(evaluation_uuid ?? ""),
    })

    const measurementQueries = useQueries({
        queries: (evaluation?.evaluation_plugins || []).map((plugin: any) => ({
            queryKey: ['pluginMeasurements', evaluation_uuid, plugin.name],
            queryFn: () => getEvaluationMeasurements(plugin.name, evaluation_uuid ?? ""),
            enabled: !!evaluation_uuid && !!plugin.name
        }))
    })

    const isPending = isEvaluationPending || measurementQueries.some(q => q.isPending)
    const error = evaluationError || measurementQueries.find(q => q.error)?.error

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    let pluginMeasurements = measurementQueries.map(q => q.data);

    return (
        <div>
            <h2>Evaluation: {evaluation_uuid}</h2>

            {pluginMeasurements && pluginMeasurements.map((pluginMeasurement: any) => (
                <>
                    <hr/>
                    <h3>Plugin: {pluginMeasurement.name}</h3>

                    {pluginMeasurement.metric_visualizations && pluginMeasurement.metric_visualizations.map((visualization: any, index: number) => {
                        const filteredMeasurements = pluginMeasurement.measurements.filter(
                            (m: Measurement) => visualization.metrics.includes(m.name)
                        );

                        return (
                            <div key={index}>
                                {visualization.chart_type === 'table' && (
                                    <MeasurementsDataGrid
                                        title={`${pluginMeasurement.name} - Table`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'line' && (
                                    <MeasurementsLineChart
                                        title={`${pluginMeasurement.name} - Line Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'scatter' && (
                                    <MeasurementsScatterChart
                                        title={`${pluginMeasurement.name} - Scatter Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'kde' && (
                                    <MeasurementsKDEChart
                                        title={`${pluginMeasurement.name} - KDE Histogram Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'bars' && (
                                    <MeasurementsBarsChart
                                        title={`${pluginMeasurement.name} - Bars Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                                {visualization.chart_type === 'radar' && (
                                    <MeasurementsRadarChart
                                        title={`${pluginMeasurement.name} - Radar Chart`}
                                        data={filteredMeasurements}
                                    />
                                )}
                            </div>
                        );
                    })}
                </>
            ))}
        </div>
    )
}

export default PluginEvaluationMeasurements
