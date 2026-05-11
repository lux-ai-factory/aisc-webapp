import {useQueries, useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from "../context/ProjectContext.tsx";
import {List, ListItem, Tooltip, Typography} from "@mui/material";
import {Evaluation, TaskProgress} from "../models/models.tsx";
import CircularProgressWithLabel from "../components/CircularProgressWithLabel.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;
const POLL_MS = 1000;

interface EvaluationTask {
    evaluation_uuid: string;
    tasks: { [plugin_name: string]: TaskProgress };
}

const getEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?exclude_status=Done&exclude_status=Failed`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json() as [Evaluation];
};

const getEvaluationTask = async (task_uuid: string, evaluation_uuid: string) => {
    if (!task_uuid) throw new Error('Invalid  task uuid');
    if (!evaluation_uuid) throw new Error('Invalid evaluation uuid');
    const res = await fetch(`${API_URL}/tasks/${task_uuid}/status`);
    if (!res.ok) throw new Error('Network response was not ok');
    const tasks = await res.json() as { [plugin_name: string]: TaskProgress }

    return {
        evaluation_uuid: evaluation_uuid,
        tasks: tasks
    } as EvaluationTask
};

function PluginEvaluationsTasks() {
    const {projectUUID} = useProject();

    const {data: evaluations, isPending: evaluationsIsPending, error: evaluationsError} = useQuery({
        queryKey: ['evaluations', projectUUID],
        queryFn: () => getEvaluations(projectUUID ?? "")
    })

    const evaluationTaskQueries = useQueries({
        queries: (evaluations || []).map((evaluation: any) => ({
            queryKey: ['evaluationTask', evaluation.task],
            queryFn: () => getEvaluationTask(evaluation.task, evaluation.pid),
            enabled: !!evaluation.task,
            refetchInterval: POLL_MS
        }))
    })

    const isPending = evaluationsIsPending || evaluationTaskQueries.some(q => q.isPending)
    const error = evaluationsError || evaluationTaskQueries.find(q => q.error)?.error

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    let evaluationTasks: EvaluationTask[] = evaluationTaskQueries
        .map(q => q.data!)

    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Running Evaluations:
            </Typography>
            <List>
                {evaluationTasks && evaluationTasks.map((evaluationTask: EvaluationTask) => (
                    <ListItem key={evaluationTask.evaluation_uuid} sx={{display: 'block'}}>
                        <Typography variant="subtitle1">
                            {evaluationTask.evaluation_uuid}
                        </Typography>
                        {Object.entries(evaluationTask.tasks).map(([taskName, taskProgress]) => (
                            <Tooltip title={JSON.stringify(taskProgress.extra)}>
                                <div key={taskName} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                    <Typography variant="body2" sx={{minWidth: 220}}>
                                        {taskName}
                                    </Typography>

                                    <CircularProgressWithLabel value={taskProgress.progress * 100}/>

                                </div>
                            </Tooltip>
                        ))}
                    </ListItem>
                ))}
            </List>
        </>
    )
}

export default PluginEvaluationsTasks