import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {Link} from 'react-router-dom';
import {useState} from "react";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface Project {
    pid: string;
    name: string;
    plugins: Plugin[];
}

interface Plugin {
    name: string;
    config: object
}

const getRunPlugins = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');

    const response = await fetch(`${API_URL}/app/plugins/${uuid}/run`);
    console.log(response);
    if (!response.ok) {
        throw new Error('Failed to submit form');
    }
    return await response.json();
};

const getTaskStatus = async (uuid: string) => {
    const response = await fetch(`${API_URL}/app/plugins/${uuid}/status`);
    console.log(response);
    const data = await response.json();
    console.log(data);
    return data;
}

const getPlugins = async () => {
    const res = await fetch(`${API_URL}/app/plugins`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const getProject = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json() as Project;
};


function Plugins() {
    const [taskId, setTaskId] = useState<string>("");
    const [status, setStatus] = useState<string>("");

    const {data: plugins, isPending, error} = useQuery({
        queryKey: ['plugins'],
        queryFn: getPlugins,
    })

    const {projectUUID} = useProject();

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    return (
        <div>
            <h2>Enabled plugins for project: {project?.name}</h2>
            <ul>
                {project?.plugins.map((plugin: Plugin) => (
                    <li>
                        {plugin.name}:
                        <Link to={`${plugin.name}/config`}>
                            edit
                        </Link>
                    </li>
                ))}
            </ul>
            <h2>Available plugins</h2>
            <ul>
                {plugins.map((plugin: string) => (
                    <li>
                        {plugin}:
                        <Link to={`${plugin}/config`}>
                            add
                        </Link>
                    </li>
                ))}
            </ul>
            <button onClick={() => {
                getRunPlugins(projectUUID ?? "")
                    .then((data) => setTaskId(data))
            }}>
                Run Plugins
            </button>
            {taskId && (
                <div>
                    <p>task id: {taskId}</p>
                    <button onClick={() => {
                        getTaskStatus(taskId)
                        .then((data) => setStatus(data))
                    }}>
                        Get status</button>
                    {status && (
                        <p>status: {JSON.stringify(status)}</p>
                    )}
                </div>
            )}
        </div>
    )
}

export default Plugins