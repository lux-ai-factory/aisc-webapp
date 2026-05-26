import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Icon,
    Switch,
    Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {Plugin, Package} from "../models/models.tsx";
import React from "react";
import {getPlugins, getProject} from "../api/api.tsx";

class PluginErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
    constructor(props: {children: React.ReactNode}) {
        super(props);
        this.state = {hasError: false};
    }
    static getDerivedStateFromError() { return {hasError: true}; }
    render() {
        if (this.state.hasError) return <Typography color="error" sx={{p: 2}}>Failed to render plugin list</Typography>;
        return this.props.children;
    }
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface ProjectPackage {
    package_name: string;
    version: string;
    source: string;
    enabled: boolean;
    plugins: Plugin[];
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
        headers: { 'Content-Type': 'application/json' },
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
        const packagePlugins = project?.plugins?.filter((projectPkg: any) => {
            return (
                projectPkg.package_name === pkg.package_name &&
                projectPkg.version === pkg.version
            )
        }) ?? [];

        return {
            package_name: pkg.package_name,
            version: pkg.version,
            source: pkg.source,
            enabled: packagePlugins.length > 0,
            plugins: packagePlugins.filter((pl: Plugin) => pl.pid),
        };
    });

    const refreshProjectQueries = () => {
        queryClient.invalidateQueries({queryKey: ['project']});
    };

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
        refreshProjectQueries();
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
                            size={{xs: 12, sm: 12, md: 6, lg: 4, xl: 3}}
                            key={`${pkg.package_name}-${pkg.version}-${pkg.source}`}
                        >
                            <Card
                                sx={{
                                    position: 'relative',
                                    cursor: 'pointer',
                                    minWidth: 250,
                                    border: '2px solid',
                                    borderColor: isEnabled ? 'primary.main' : 'grey.200',
                                    background: isEnabled
                                        ? 'linear-gradient(135deg, rgba(69, 145, 251, 0.15), rgba(0, 52, 255, 0.1))'
                                        : 'white',
                                    transition: 'all 0.2s ease',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
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

                                        <Box sx={{display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center'}}>
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
                                            {isEnabled && (
                                                <Chip
                                                    label={`${pkg.plugins.length} plugin${pkg.plugins.length > 1 ? 's' : ''}`}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Box>
                                    </Box>

                                    {isEnabled && (
                                        <Icon sx={{color: 'success.main', alignSelf: 'center', fontSize: 24}}>
                                            check_circle
                                        </Icon>
                                    )}
                                </CardContent>

                                <PluginErrorBoundary>
                                    {isEnabled && pkg.plugins.length > 0 && (
                                        <Box sx={{px: 2, pb: 1.5, mt: -0.5}} onClick={e => e.stopPropagation()}>
                                            <Divider sx={{mb: 1}} />
                                            <Typography variant="caption" color="text.secondary" sx={{mb: 0.5, display: 'block'}}>
                                                Plugins:
                                            </Typography>
                                            {pkg.plugins.map((plugin) => {
                                                const pluginDisplayName = plugin.display_name;
                                                const pluginName = plugin.name;
                                                return (
                                                    <Box
                                                        key={plugin.pid ?? Math.random()}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            py: 0.3,
                                                            px: 0.5,
                                                            borderRadius: 1,
                                                            '&:hover': {bgcolor: 'action.hover'},
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            noWrap
                                                            sx={{cursor: 'default', flex: 1}}
                                                        >
                                                            {pluginDisplayName ?? pluginName ?? 'Unknown'}
                                                        </Typography>

                                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 0.25}}>
                                                            <Switch
                                                                size="small"
                                                                checked
                                                            />
                                                        </Box>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    )}
                                </PluginErrorBoundary>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        </>
    );

}

export default Plugins
