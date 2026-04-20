import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {FormControlLabel, FormGroup, Switch, Typography} from "@mui/material";
import {Plugin, Package} from "../models/models.tsx";
import React from "react";
import {getPlugins, getProject} from "../api/api.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface ProjectPackage {
    package_name: string;
    version: string;
    source: string;
    enabled: boolean;
}

const createProjectPlugins = async (project_uuid: string, package_name: string, version: string) => {
    if (!project_uuid) throw new Error('Invalid project uuid');
    if (!package_name) throw new Error('Invalid package name')
    if (!version) throw new Error('Invalid version')

    const data = {
        package_name: package_name,
        project_uuid: project_uuid,
        version: version,
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

const deleteProjectPlugins = async (project_uuid: string, package_name: string, version: string) => {
    if (!project_uuid) throw new Error('Invalid project uuid');
    if (!package_name) throw new Error('Invalid package name')
    if (!version) throw new Error('Invalid version')

    const data = {
        package_name: package_name,
        project_uuid: project_uuid,
        version: version,
    }

    await fetch(`${API_URL}/plugins`, {
        method: 'DELETE',
                headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
};


function Plugins() {
    const queryClient = useQueryClient();
    const {projectUUID} = useProject();

    const {data: packages, isPending, error} = useQuery({
        queryKey: ['packages', projectUUID],
        queryFn: getPlugins,
    })

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const projectPackages: ProjectPackage[] = packages.map((p: Package) => {
        const enabled =
            project?.plugins.some((projectPlugin: Plugin) => {
                return projectPlugin.package_name === p.package_name
                    && projectPlugin.version === p.version
            })
        return {package_name: p.package_name, version: p.version, source: p.source, enabled: enabled} as ProjectPackage
    })

    const handleChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
        pid: string,
        package_name: string,
        version: string,
    ) => {
        if (event.target.checked) {
            await createProjectPlugins(pid, package_name, version)
        } else {
            await deleteProjectPlugins(pid, package_name, version)
        }
        await queryClient.invalidateQueries({queryKey: ['project']});
    };


    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Available Plugins
            </Typography>
            <FormGroup>
                {projectPackages.map((p: ProjectPackage) => (
                    <FormControlLabel
                        key={`${p.package_name}-${p.version}-${p.source}`}
                        control={<Switch
                            checked={Boolean(p.enabled)}
                            onChange={(e) => handleChange(e, projectUUID ?? "", p.package_name, p.version)}/>
                        }
                        label={`${p.package_name} (${p.version}) ${p.source == "local" ? "local" : ""}`  }/>
                ))}
            </FormGroup>
        </>
    )
}

export default Plugins