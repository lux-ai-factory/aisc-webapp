import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Icon from '@mui/material/Icon';
import LinkMui from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { useProject } from '../context/ProjectContext';
import { getProject } from '../api/api';
import { API_VERSION_PREFIX } from '../config';
import { useCatalogue, useInstalledChecklists } from '../lib/cache';
import { uninstallChecklist } from '../lib/checklists';
import CatalogueExploreDialog from '../components/CatalogueExploreDialog';
import AppCard from '../components/AppCard';
import '../styles/common.css';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

/**
 * Catalogue (CAT-01): one integrated discovery/install flow for tests and
 * checklists. The published catalogue stays an independently published artifact
 * — this page links to it, it never fetches or stores its pages.
 */
export default function CataloguePage() {
    const queryClient = useQueryClient();
    const { projectUUID: pid, projectName } = useProject();
    const [exploreOpen, setExploreOpen] = useState(false);
    const { catalogue, loading } = useCatalogue();
    const installed = useInstalledChecklists(pid);
    const library = installed.library ?? [];

    const { data: project } = useQuery({
        queryKey: ['project', pid],
        queryFn: () => getProject(pid ?? ''),
        enabled: !!pid,
        staleTime: 30_000,
    });
    const enabledPlugins = (project?.plugins ?? []).filter((p) => p.pid && p.enabled);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open the catalogue.</Typography>;
    }

    // A key per installed item across both kinds, so the dialog marks each one.
    const installedKeys = new Set<string>([
        ...enabledPlugins
            .map((p) => (p.package_name ? `${p.package_name}::${p.name}` : ''))
            .filter(Boolean),
        ...library.map((c) => c.template?.catalogue_id ?? '').filter(Boolean),
    ]);

    const refresh = async () => {
        await queryClient.invalidateQueries({ queryKey: ['project'] });
        await queryClient.invalidateQueries({ queryKey: ['checklists', pid] });
    };

    const uninstallControl = async (catalogueId: string): Promise<boolean> => {
        const row = library.find((c) => c.template?.catalogue_id === catalogueId);
        if (!row) return false;
        try {
            await uninstallChecklist(pid, row.pid);
        } catch {
            toast.error('Could not uninstall checklist.', { position: 'bottom-right' });
            return false;
        }
        await refresh();
        return true;
    };

    const uninstallPlugin = async (packageName: string, pluginName?: string): Promise<boolean> => {
        const targets = enabledPlugins.filter(
            (p) => p.package_name === packageName && (!pluginName || p.name === pluginName),
        );
        for (const plugin of targets) {
            const res = await fetch(`${API_URL}/plugins/${plugin.pid}/enabled`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            });
            if (!res.ok) {
                toast.error('Could not uninstall plugin.', { position: 'bottom-right' });
                return false;
            }
        }
        await refresh();
        return true;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Catalogue
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon>storefront</Icon>}
                    onClick={() => setExploreOpen(true)}
                    sx={{ textTransform: 'none' }}
                >
                    Explore catalogue
                </Button>
            </Box>
            <Typography color="text.secondary">
                Tests and checklists in one place: search, select and install either kind into this
                project.{' '}
                {catalogue.app_catalog_url ? (
                    <LinkMui
                        href={catalogue.app_catalog_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open the published catalogue →
                    </LinkMui>
                ) : null}
            </Typography>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <AppCard
                        active
                        header={
                            <Typography variant="subtitle1" fontWeight={600}>
                                Tests installed
                            </Typography>
                        }
                        footer={
                            <Box sx={{ ml: 'auto' }}>
                                <Button component={Link} to={`/projects/${projectName}/plugins`} size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                                    Manage
                                </Button>
                            </Box>
                        }
                    >
                        <Typography variant="h6">{enabledPlugins.length}</Typography>
                    </AppCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <AppCard
                        active
                        header={<Typography variant="subtitle1" fontWeight={600}>Checklists installed</Typography>}
                        footer={
                            <Box sx={{ ml: 'auto' }}>
                                <Button component={Link} to={`/projects/${projectName}/checklists`} size="small" variant="outlined" sx={{ textTransform: 'none' }}>
                                    Manage
                                </Button>
                            </Box>
                        }
                    >
                        <Typography variant="h6">{library.length}</Typography>
                    </AppCard>
                </Grid>
            </Grid>

            <CatalogueExploreDialog
                open={exploreOpen}
                onClose={() => setExploreOpen(false)}
                projectPid={pid}
                kind="all"
                catalogue={catalogue}
                loading={loading}
                installedKeys={installedKeys}
                onInstalled={() => void refresh()}
                onUninstall={(id, kind, pluginName) =>
                    kind === 'control'
                        ? uninstallControl(String(id))
                        : uninstallPlugin(String(id), pluginName)
                }
            />
        </Box>
    );
}
