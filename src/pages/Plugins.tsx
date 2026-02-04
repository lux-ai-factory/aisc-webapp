import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {FormControlLabel, FormGroup, Switch, Typography} from "@mui/material";
import {Plugin} from "../models/models.tsx";
import React from "react";
import {getPlugins, getProject} from "../api/api.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


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

    const handleChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
        pid: string,
        plugin_name: string,
        project_plugin_pid: string | undefined
    ) => {
        if (event.target.checked) {
            await createProjectPlugin(pid, plugin_name)
        } else {
            if (!project_plugin_pid) return;
            await deleteProjectPlugin(project_plugin_pid)
        }
        await queryClient.invalidateQueries({queryKey: ['project']});
    };


    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Available Plugins
            </Typography>
            <FormGroup>
                {projectPlugins.map((projectPlugin: any) => (
                    <FormControlLabel
                        key={projectPlugin.pluginName}
                        control={<Switch
                            checked={Boolean(projectPlugin.projectPluginPid)}
                            onChange={(e) => handleChange(e, projectUUID ?? "", projectPlugin.pluginName, projectPlugin.projectPluginPid)}/>
                        }
                        label={projectPlugin.pluginName}/>
                ))}
            </FormGroup>
        </>
    )
}

export default Plugins