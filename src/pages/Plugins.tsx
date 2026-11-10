import {useQuery, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from '../context/ProjectContext';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Icon,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {useEffect, useRef, useState} from "react";
import {getProject} from "../api/api.tsx";
import toast from "react-hot-toast";
import SideDrawer from "../components/SideDrawer.tsx";
import AppCard from "../components/AppCard.tsx";
import CatalogueExploreDialog from "../components/CatalogueExploreDialog.tsx";
import PluginConfig, {PluginConfigHandle} from "./PluginsConfig.tsx";
import ConfigHistory from "../components/plugin/ConfigHistory.tsx";
import { useCatalogue } from "../lib/cache.ts";
import "./Plugins.css";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

// Pull the backend's reason out of a failed uninstall response for the toast
// (ninja errors carry it in `detail`; fall back to the HTTP status).
async function uninstallErrorDetail(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) return `: ${body.detail}`;
    } catch {
        // no JSON body to read
    }
    return ` (HTTP ${res.status})`;
}

// Per-plugin display icons, fetched once per plugin and reused across mounts.
const DISPLAY_ICON_CACHE = new Map<string, string>();

function PluginIcon({ pid }: { pid?: string }) {
    const cached = pid ? DISPLAY_ICON_CACHE.get(pid) : undefined;
    const [icon, setIcon] = useState<string | null>(cached ?? null);
    useEffect(() => {
        if (!pid) return;
        if (DISPLAY_ICON_CACHE.has(pid)) {
            setIcon(DISPLAY_ICON_CACHE.get(pid)!);
            return;
        }
        let alive = true;
        fetch(`${API_URL}/plugins/${pid}/display_icon`)
            .then((r) => (r.ok ? r.json() : 'extension'))
            .then((v) => {
                const value = String(v || 'extension');
                DISPLAY_ICON_CACHE.set(pid, value);
                if (alive) setIcon(value);
            })
            .catch(() => {
                if (alive) setIcon('extension');
            });
        return () => {
            alive = false;
        };
    }, [pid]);
    return <Icon sx={{ color: 'primary.main', flexShrink: 0 }}>{icon ?? 'extension'}</Icon>;
}

function Plugins() {
    const queryClient = useQueryClient();
    const {projectUUID} = useProject();
    const [configPluginName, setConfigPluginName] = useState<string | null>(null);
    const [exploreOpen, setExploreOpen] = useState(false);
    const configRef = useRef<PluginConfigHandle>(null);
    /** package being re-imported (its plugins are temporarily disabled in the cards) */
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const {catalogue, loading: catalogueLoading} = useCatalogue();

    const openExplore = () => setExploreOpen(true);

    const {data: project, isPending, error} = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID ?? ""),
        enabled: !!projectUUID,
        staleTime: 30_000,
    })

    const enabledPlugins = (project?.plugins ?? []).filter((p) => p.pid && p.enabled);
    const configPlugin = enabledPlugins.find((p) => p.name === configPluginName) ?? null;

    const refreshProject = async () => {
        await queryClient.invalidateQueries({ queryKey: ['project'] });
    };

    // Re-import the package's plugin code (same as the old "refresh package"
    // flow): reloads the associated package and syncs this project's rows.
    const updatePlugin = async (packageName: string, version: string) => {
        if (!projectUUID || refreshing) return;
        const key = `${packageName}::${version}`;
        setRefreshing(key);
        try {
            const res = await fetch(`${API_URL}/plugins/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    package_name: packageName,
                    version,
                    project_uuid: projectUUID,
                }),
            });
            if (!res.ok) throw new Error('Could not refresh plugin');
            toast.success('Plugin updated.', { position: 'bottom-right' });
        } catch {
            toast.error('Could not update plugin.', { position: 'bottom-right' });
        } finally {
            setRefreshing(null);
            await refreshProject();
        }
    };

    const uninstallPlugin = async (pluginPid: string): Promise<boolean> => {
        // Disable only this plugin row (the clicked card's), never the other
        // plugins that share the same package.
        const res = await fetch(`${API_URL}/plugins/${pluginPid}/enabled`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
        });
        if (!res.ok) {
            toast.error(`Could not uninstall plugin${await uninstallErrorDetail(res)}.`, {
                position: 'bottom-right',
            });
            return false;
        }
        await refreshProject();
        toast.success('Plugin uninstalled.', { position: 'bottom-right' });
        return true;
    };

    // Catalogue uninstall is per plugin, same as the card trash button: only
    // disable the clicked plugin's rows, never the other plugins that share
    // its package. Without a plugin name (package-level listing) disable the
    // package's rows. Returns false if any disable failed so the explore
    // dialog keeps the card marked installed.
    const uninstallFromCatalogue = async (packageName: string, pluginName?: string): Promise<boolean> => {
        const targets = enabledPlugins.filter(
            (p) => p.package_name === packageName && (!pluginName || p.name === pluginName),
        );
        let ok = true;
        let why = '';
        for (const plugin of targets) {
            const res = await fetch(`${API_URL}/plugins/${plugin.pid}/enabled`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            });
            if (!res.ok) {
                ok = false;
                why = await uninstallErrorDetail(res);
            }
        }
        if (!ok) {
            toast.error(`Could not uninstall plugin${why}.`, { position: 'bottom-right' });
            return false;
        }
        await refreshProject();
        toast.success('Plugin uninstalled.', { position: 'bottom-right' });
        return true;
    };

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    return (
        <>
            <Box className="page-header" sx={{ mb: 2 }}>
                <Typography variant="h4" className="page-header-title">
                    Plugins
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon>storefront</Icon>}
                    onClick={() => void openExplore()}
                    sx={{ textTransform: 'none' }}
                >
                    Explore catalogue
                </Button>
            </Box>

            {enabledPlugins.length === 0 ? (
                <Typography color="text.secondary">
                    No plugins enabled for this project. Explore the catalogue to add one.
                </Typography>
            ) : (
                <Grid container spacing={2} className="plugins-grid">
                    {enabledPlugins.map((plugin) => (
                        <Grid key={plugin.pid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                            <AppCard
                                active
                                onClick={() => setConfigPluginName(plugin.name)}
                                header={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <PluginIcon pid={plugin.pid} />
                                        <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 0 }}>
                                            {plugin.display_name ?? plugin.name ?? 'Unknown'}
                                        </Typography>
                                        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0 }}>
                                            {(() => {
                                                const key = `${plugin.package_name ?? plugin.name}::${plugin.version}`;
                                                const pending = refreshing === key;
                                                return (
                                                    <Tooltip title="Update plugin">
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                aria-label={`Update ${plugin.display_name ?? plugin.name ?? 'plugin'}`}
                                                                disabled={refreshing !== null}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void updatePlugin(
                                                                        plugin.package_name ?? plugin.name,
                                                                        plugin.version ?? '',
                                                                    );
                                                                }}
                                                            >
                                                                {pending ? (
                                                                    <CircularProgress size={15} />
                                                                ) : (
                                                                    <Icon fontSize="small">refresh</Icon>
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                );
                                            })()}
                                            <Tooltip title="Remove plugin">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`Remove ${plugin.display_name ?? plugin.name ?? 'plugin'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void uninstallPlugin(plugin.pid);
                                                    }}
                                                >
                                                    <Icon fontSize="small">delete</Icon>
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                }
                                footer={
                                    <>
                                        <Chip
                                            label={plugin.package_name ?? plugin.name}
                                            size="small"
                                            variant="outlined"
                                        />
                                        {plugin.version && (
                                            <Chip label={`v${plugin.version}`} size="small" variant="outlined" />
                                        )}
                                        {plugin.config === null || plugin.config === undefined ? (
                                            <Chip
                                                label="not configured"
                                                size="small"
                                                color="error"
                                                variant="outlined"
                                            />
                                        ) : (
                                            <Chip label="configured" size="small" color="success" variant="filled" />
                                        )}
                                    </>
                                }
                            />
                        </Grid>
                    ))}
                </Grid>
            )}

            <SideDrawer
                open={configPluginName !== null}
                onClose={() => setConfigPluginName(null)}
                title={configPlugin?.display_name ?? configPluginName ?? 'Plugin'}
                mode="edit"
                footerActions={
                    <>
                        <Tooltip title="Export JSON">
                            <IconButton
                                size="small"
                                aria-label="Export plugin configuration"
                                onClick={() => configRef.current?.exportJson()}
                            >
                                <Icon fontSize="small">file_download</Icon>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Import JSON">
                            <IconButton
                                size="small"
                                aria-label="Import plugin configuration"
                                onClick={() => configRef.current?.importClick()}
                            >
                                <Icon fontSize="small">file_upload</Icon>
                            </IconButton>
                        </Tooltip>
                    </>
                }
                onSave={() => configRef.current?.submit()}
                onCancel={() => setConfigPluginName(null)}
                headerAction={
                    configPlugin?.pid ? (
                        <ConfigHistory
                            pluginPID={configPlugin.pid}
                            onRestore={() => void configRef.current?.reloadState()}
                        />
                    ) : undefined
                }
            >
                {configPluginName && (
                    <PluginConfig
                        ref={configRef}
                        pluginName={configPluginName}
                        showToolbar={false}
                        showHeader={false}
                        onSaved={() => setConfigPluginName(null)}
                    />
                )}
            </SideDrawer>

            <CatalogueExploreDialog
                open={exploreOpen}
                onClose={() => setExploreOpen(false)}
                projectPid={projectUUID ?? ''}
                kind="plugin"
                catalogue={catalogue}
                loading={catalogueLoading}
                installedKeys={
                    new Set(
                        enabledPlugins
                            .map((p) => (p.package_name ? `${p.package_name}::${p.name}` : ''))
                            .filter(Boolean),
                    )
                }
                onInstalled={async () => {
                    await refreshProject();
                    toast.success('Plugin installed for this project.', { position: 'bottom-right' });
                }}
                onUninstall={(id, _k, pluginName) =>
                    uninstallFromCatalogue(String(id), pluginName)
                }
            />
        </>
    );

}

export default Plugins
