import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {Badge, Icon, Typography} from "@mui/material";
import {Plugin} from "../models/models.tsx";
import React from "react";
import {getPlugins, getProject} from "../api/api.tsx";
import {useNavigate} from 'react-router-dom';

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
    const navigate = useNavigate();

    const {data: plugins, isPending, error} = useQuery({
        queryKey: ['plugins', projectUUID],
        queryFn: getPlugins,
    })

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? "")
    })

    const { projectName } = useProject();

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    let projectPlugins = plugins.map((plugin: string) => {
        let projectPlugin: Plugin | undefined =
            project?.plugins.find((projectPlugin: any) => projectPlugin.name === plugin)
        return {
            'pluginName': plugin,
            'projectPluginPid': projectPlugin?.pid,
            'config': projectPlugin?.config ?? null
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
            <div>
                {projectPlugins.map((projectPlugin: any) => {
                    const isEnabled = Boolean(projectPlugin.projectPluginPid);
                    const isConfigured = projectPlugin.config !== null;
                    const inputId = `plugin-${projectPlugin.pluginName}`;

                    return (
                        <div
                            key={projectPlugin.pluginName}   // <-- FIX HERE
                            style={{display: "flex", gap: 20}}
                        >
                            <div
                                className={`plugin-card ${isEnabled ? "enabled" : ""}`}
                                onClick={() => {
                                    const input = document.getElementById(inputId) as HTMLInputElement;
                                    input?.click();
                                }}
                            >
                                <input
                                    id={inputId}
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) =>
                                        handleChange(
                                            e,
                                            projectUUID ?? "",
                                            projectPlugin.pluginName,
                                            projectPlugin.projectPluginPid
                                        )
                                    }
                                    className="plugin-hidden-checkbox"
                                />
                                <span className="plugin-label">{projectPlugin.pluginName}</span>
                                {isEnabled && (
                                    <Icon className="plugin-check">check_circle</Icon>
                                )}
                            </div>
                            {isEnabled && (
                                <Badge
                                    color="error"
                                    badgeContent={!isConfigured ? "!" : null}
                                    overlap="circular"
                                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                                    sx={{ paddingTop: 2.5, marginTop: 1.5}}
                                >
                                    <Icon
                                        style={{cursor: "pointer", color: isConfigured ? "#4591FB" : "red"}}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/projects/${projectName}/plugins/${projectPlugin.pluginName}`);
                                        }}
                                    >
                                        settings
                                    </Icon>
                                </Badge>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    )
}

export default Plugins