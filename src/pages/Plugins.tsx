import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {Button} from "@mui/material";
import {Project, Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const getPlugins = async () => {
    const res = await fetch(`${API_URL}/plugins`);
    return await res.json() as string[];
};

const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    return await res.json() as Project;
};

const createProjectPlugin = async (uuid: string, plugin_name: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    if (!plugin_name) throw new Error('Invalid plugin name')

    const data = {
        name: plugin_name,
        project_uuid: uuid,
        config: null
    }
    const res = await fetch(`${API_URL}/plugins`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return await res.json() as Plugin;
};

const deleteProjectPlugin = async (plugin_uuid: string) => {
    if (!plugin_uuid) throw new Error('Invalid uuid');
    await fetch(`${API_URL}/plugins/${plugin_uuid}`, {
        method: 'DELETE'
    });
};


function Plugins() {
    const queryClient = useQueryClient();
    const {projectUUID} = useProject();

    const {data: plugins, isPending, error} = useQuery({
        queryKey: ['plugins'],
        queryFn: getPlugins,
    })

    const {data: project} = useQuery({
        queryKey: ['project'],
        queryFn: () => getProject(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    let projectPlugins = plugins.map((plugin: string) => {
        let projectPlugin: Plugin | undefined =
            project?.plugins.find((projectPlugin: any) => projectPlugin.name === plugin)
        return {
            'pluginName': plugin,
            'projectPluginPid': projectPlugin?.pid
        }
    })

    const handleDisable = async (pid: string) => {
        await deleteProjectPlugin(pid)
        await queryClient.invalidateQueries({queryKey: ['project']});
    }

    const handleEnabled = async (pid: string, plugin_name: string) => {
        await createProjectPlugin(pid, plugin_name)
        await queryClient.invalidateQueries({queryKey: ['project']});
    }

    return (
        <div>
            <h2>Available plugins</h2>
            <ul>
                {projectPlugins.map((projectPlugin: any) => (
                    <li>
                        {projectPlugin.pluginName}:
                        {projectPlugin.projectPluginPid ? (
                            <Button onClick={() => handleDisable(projectPlugin.projectPluginPid)} >Disable</Button>
                        ) : (
                            <Button onClick={() => handleEnabled(projectUUID ?? "", projectPlugin.pluginName)} >Enable</Button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default Plugins