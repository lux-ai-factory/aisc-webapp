import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {Badge, Icon, Typography} from "@mui/material";
import {Plugin, Package} from "../models/models.tsx";
import React from "react";
import {getPlugins, getProject} from "../api/api.tsx";
import {useNavigate} from 'react-router-dom';

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
    const navigate = useNavigate();

    const {data: packages, isPending, error} = useQuery({
        queryKey: ['packages', projectUUID],
        queryFn: getPlugins,
    })

    const {data: project} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? "")
    })

    const { projectName } = useProject();

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const projectPackages: ProjectPackage[] = packages.map((pkg: Package) => {
        const enabled = project?.plugins?.some((projectPkg: any) => {
            return (
                projectPkg.package_name === pkg.package_name &&
                projectPkg.version === pkg.version
            )
        });

        return {
            package_name: pkg.package_name,
            version: pkg.version,
            source: pkg.source,
            enabled
        };
    });


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
                Available Packages
            </Typography>

            <div>
                {projectPackages.map((pkg: ProjectPackage) => {
                    const isEnabled = Boolean(pkg.enabled);
                    const isConfigured = true; // TODO: if config exists later
                    const inputId = `pkg-${pkg.package_name}-${pkg.version}`;

                    return (
                        <div
                            key={`${pkg.package_name}-${pkg.version}-${pkg.source}`}
                            style={{ display: "flex", gap: 20 }}
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
                                            pkg.package_name,
                                            pkg.version
                                        )
                                    }
                                    className="plugin-hidden-checkbox"
                                />

                                <span className="plugin-label">
                                {pkg.package_name} ({pkg.version})
                                    {pkg.source === "local" ? " [local]" : ""}
                            </span>

                                {isEnabled && (
                                    <Icon sx={{color: "#00e676"}}>check_circle</Icon>
                                )}
                            </div>

                            {/*{isEnabled && (*/}
                            {/*    <Badge*/}
                            {/*        color="error"*/}
                            {/*        badgeContent={!isConfigured ? "!" : null}*/}
                            {/*        overlap="circular"*/}
                            {/*        anchorOrigin={{ vertical: "top", horizontal: "right" }}*/}
                            {/*        sx={{ paddingTop: 2.5, marginTop: 1.5 }}*/}
                            {/*    >*/}
                            {/*        <Icon*/}
                            {/*            style={{*/}
                            {/*                cursor: "pointer",*/}
                            {/*                color: isConfigured ? "#4591FB" : "red"*/}
                            {/*            }}*/}
                            {/*            onClick={(e) => {*/}
                            {/*                e.stopPropagation();*/}
                            {/*                navigate(*/}
                            {/*                    `/projects/${projectName}/packages/${pkg.package_name}/${pkg.version}`*/}
                            {/*                );*/}
                            {/*            }}*/}
                            {/*        >*/}
                            {/*            settings*/}
                            {/*        </Icon>*/}
                            {/*    </Badge>*/}
                            {/*)}*/}
                        </div>
                    );
                })}
            </div>
        </>
    );

}

export default Plugins