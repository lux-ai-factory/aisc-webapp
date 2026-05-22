import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Icon,
    Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
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
            enabled: enabled ?? false
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

            <Grid container spacing={2}>
                {projectPackages.map((pkg: ProjectPackage) => {
                    const isEnabled = Boolean(pkg.enabled);
                    const inputId = `pkg-${pkg.package_name}-${pkg.version}`;

                    return (
                        <Grid
                            size={{xs: 12, sm: 6, md: 4, lg: 3}}
                            key={`${pkg.package_name}-${pkg.version}-${pkg.source}`}
                        >
                            <Card
                                sx={{
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: 2,
                                    borderColor: isEnabled ? 'primary.main' : 'grey.200',
                                    background: isEnabled
                                        ? 'linear-gradient(135deg, rgba(69, 145, 251, 0.15), rgba(0, 52, 255, 0.1))'
                                        : 'white',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        boxShadow: 4,
                                        borderColor: isEnabled ? 'primary.main' : 'grey.300',
                                    },
                                }}
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
                                    style={{display: 'none'}}
                                />

                                <CardContent sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5}}>
                                    <Box sx={{flex: 1}}>
                                        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                            {pkg.package_name}
                                        </Typography>

                                        <Box sx={{display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap'}}>
                                            <Chip
                                                label={`v${pkg.version}`}
                                                size="small"
                                                variant="outlined"
                                                color="default"
                                            />
                                            <Chip
                                                label={pkg.source}
                                                size="small"
                                                color={pkg.source === 'local' ? 'info' : 'default'}
                                                variant={pkg.source === 'local' ? 'filled' : 'outlined'}
                                            />
                                        </Box>
                                    </Box>

                                    {isEnabled && (
                                        <Icon sx={{color: 'success.main', alignSelf: 'center'}}>check_circle</Icon>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        </>
    );

}

export default Plugins
