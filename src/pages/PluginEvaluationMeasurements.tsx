import {useQuery, useQueries} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useParams} from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const getEvaluation = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/evaluations/${uuid}?include=project,dataset,model,datashape,plugin`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const getEvaluationMeasurements = async (plugin_name: string, evaluation_uuid: string) => {
    if (!evaluation_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/evaluations/${evaluation_uuid}/result`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};


function PluginEvaluationMeasurements() {
    const { evaluation_uuid } = useParams();

    const {data: evaluation, isPending: isEvaluationPending, error: evaluationError} = useQuery({
        queryKey: ['evaluationMeasurements'],
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

    let measurements: any[];
    // @ts-ignore
    measurements = measurementQueries.map((q) => q.data)[0];

    return (
        <div>
            <h2>Evaluation: {evaluation_uuid}</h2>
            {measurements && measurements.map((measurement: any) => (
                <li>
                    {measurement.name} : {measurement.score}
                </li>
            ))}
        </div>
    )
}

export default PluginEvaluationMeasurements