/**
 * CatalogueExploreDialog — "Explore from catalogue" as an app dialog.
 *
 * Opens from the Checklists and Plugins pages. Lists installable controls
 * (checklists) and plugins from `GET /catalogue`, with fuzzy search + tag
 * filtering. Each item is rendered as a card in the same visual language as
 * the rest of the app (title + chips, Install action at the bottom), so the
 * catalogue reads like the project's component/plugin cards.
 */
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Icon from '@mui/material/Icon';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import Grid from '@mui/material/Grid2';
import AppDialog from './AppDialog';
import AppCard from './AppCard';
import NewChecklistDialog from './NewChecklistDialog';
import '../styles/common.css';
import {
    filterCatalogue,
    allTags,
    childrenOf,
    Catalogue,
    CatalogueControl,
    CatalogueDimension,
    CataloguePlugin,
} from '../lib/catalogue';
import { API_VERSION_PREFIX } from '../config';

type ExploreKind = 'control' | 'plugin' | 'all';

interface CatalogueExploreDialogProps {
    open: boolean;
    onClose: () => void;
    projectPid: string;
    kind: ExploreKind;
    catalogue: Catalogue;
    loading: boolean;
    /**
     * The dimensions of the project's selected objectives; `[]` when it has
     * selected none yet, which shows everything (pilot rule). Omit it for a
     * caller with no project behind the catalogue and no switch is offered.
     */
    projectDimensions?: string[];
    /** installed keys: plugins `${package}::${class}`, controls `catalogue_id` */
    installedKeys?: Set<string>;
    onInstalled?: (catalogueId: string, kind: 'control' | 'plugin') => void;
    /**
     * Uninstall an item already installed; return false to keep it marked
     * installed. For plugins `pluginName` is the specific class being removed,
     * so callers can uninstall one plugin instead of its whole package.
     */
    onUninstall?: (
        catalogueId: string,
        kind: 'control' | 'plugin',
        pluginName?: string,
    ) => Promise<boolean | void> | boolean | void;
}

function pluginKey(p: CataloguePlugin): string {
    return p.plugin_name ? `${p.package_name}::${p.plugin_name}` : p.package_name;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function installItem(
    projectPid: string,
    catalogueId: string,
    kind: 'control' | 'plugin',
    pluginName?: string,
) {
    const query = new URLSearchParams({ catalogue_id: catalogueId, kind });
    if (pluginName) query.set('plugin_name', pluginName);
    const url = `${API_URL}/projects/${projectPid}/catalogue/installs?${query.toString()}`;
    const res = await fetch(url, { method: 'POST' });
    return res.ok;
}

function ControlCard({
    item,
    installed,
    onInstall,
    onUninstall,
}: {
    item: CatalogueControl;
    installed: boolean;
    onInstall: () => void;
    onUninstall: () => void;
}) {
    const itemTags = item.tags ?? [item.control_topic, item.source];
    const chips = [item.source, item.control_topic, ...(item.regulation_ids ?? [])].filter(Boolean);
    return (
        <AppCard
            theme="catalogue"
            active={installed}
            onClick={installed ? onUninstall : onInstall}
            header={
                <Typography variant="subtitle1" fontWeight={600}>
                    {item.title}
                </Typography>
            }
            footer={
                <>
                    {chips.slice(0, 4).map((chip) => (
                        <Chip key={chip} label={chip} size="small" variant="outlined" />
                    ))}
                    <Chip label={`${item.question_count} questions`} size="small" variant="outlined" />
                    {itemTags.slice(0, 3).map((t) => (
                        <Chip key={t} label={t} size="small" variant="outlined" />
                    ))}
                    {installed && <Chip label="installed" size="small" color="success" />}
                </>
            }
        />
    );
}

function PluginCard({
    item,
    installed,
    onInstall,
    onUninstall,
}: {
    item: CataloguePlugin;
    installed: boolean;
    onInstall: () => void;
    onUninstall: () => void;
}) {
    return (
        <AppCard
            theme="catalogue"
            active={installed}
            onClick={installed ? onUninstall : onInstall}
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon sx={{ color: 'primary.main', flexShrink: 0 }}>
                        {item.display_icon || 'extension'}
                    </Icon>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 0 }}>
                        {item.display_name || item.plugin_name || item.package_name}
                    </Typography>
                </Box>
            }
            footer={
                <>
                    {item.plugin_name && (
                        <Chip label={item.package_name} size="small" variant="outlined" />
                    )}
                    <Chip label={`v${item.version}`} size="small" variant="outlined" color="default" />
                    <Chip
                        label={item.source}
                        size="small"
                        color={item.source === 'local' ? 'info' : 'default'}
                        variant={item.source === 'local' ? 'filled' : 'outlined'}
                    />
                    {(item.tags ?? []).slice(0, 3).map((t) => (
                        <Chip key={t} label={t} size="small" variant="outlined" />
                    ))}
                    {installed && <Chip label="installed" size="small" color="success" />}
                </>
            }
        />
    );
}

export default function CatalogueExploreDialog({
    open,
    onClose,
    projectPid,
    kind,
    catalogue,
    loading,
    projectDimensions,
    installedKeys,
    onInstalled,
    onUninstall,
}: CatalogueExploreDialogProps) {
    const [query, setQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    // "For this project" is on by default: the project came here from its own
    // objectives, so the catalogue it is offered should be the one about them.
    const [forProject, setForProject] = useState(true);
    const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
    const [tagOpen, setTagOpen] = useState(false);
    const [installedLocally, setInstalledLocally] = useState<Set<string>>(new Set());
    const [newOpen, setNewOpen] = useState(false);

    // A card marked installed during a previous dialog session must not stay
    // highlighted after the item was deleted on its page in the meantime:
    // local labels only apply to this open session, the parent's installedKeys
    // is the persistent source of truth.
    useEffect(() => {
        if (open) setInstalledLocally(new Set());
    }, [open]);

    const isInstalled = (key: string) =>
        (installedKeys?.has(key) ?? false) || installedLocally.has(key);

    const addLocal = (key: string) =>
        setInstalledLocally((prev) => new Set(prev).add(key));

    const removeLocal = (key: string) =>
        setInstalledLocally((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });

    const handleUninstall = async (key: string, id: string, k: 'control' | 'plugin', pluginName?: string) => {
        const ok = await onUninstall?.(id, k, pluginName);
        if (ok !== false) removeLocal(key);
    };

    // The project's own dimensions narrow the list when the switch is on; the
    // dimension chips narrow it further, both matching *any* of their slugs
    // (the catalogue's own rule).
    const dimensions = useMemo(
        () => [
            ...new Set([
                ...(forProject ? (projectDimensions ?? []) : []),
                ...selectedDimensions,
            ]),
        ],
        [forProject, projectDimensions, selectedDimensions],
    );

    const filtered = useMemo(
        () =>
            filterCatalogue(
                catalogue,
                query,
                selectedTags,
                kind === 'control' ? 'controls' : kind === 'plugin' ? 'plugins' : 'all',
                dimensions,
            ),
        [catalogue, query, selectedTags, kind, dimensions],
    );

    const tags = useMemo(() => allTags(catalogue.plugins, catalogue.controls), [catalogue]);
    const dimensionVocabulary: CatalogueDimension[] = catalogue.dimensions ?? [];

    const toggleDimension = (slug: string) =>
        setSelectedDimensions((prev) =>
            prev.includes(slug) ? prev.filter((d) => d !== slug) : [...prev, slug],
        );

    const toggleTag = (tag: string) =>
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );

    const controls = kind !== 'plugin' ? filtered.controls : [];
    const plugins = kind !== 'control' ? filtered.plugins : [];
    const total = controls.length + plugins.length;

    const title = `Catalogue — ${kind === 'plugin' ? 'plugins' : kind === 'control' ? 'checklists' : 'all'}`;

    return (
        <AppDialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            title={title}
            actions={
                <>
                    {kind === 'control' && (
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            startIcon={<Icon fontSize="small">add</Icon>}
                            onClick={() => setNewOpen(true)}
                            sx={{ textTransform: 'none' }}
                        >
                            New checklist
                        </Button>
                    )}
                    <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
                        Close
                    </Button>
                </>
            }
            actionsSx={kind === 'control' ? { justifyContent: 'space-between' } : undefined}
        >
            <NewChecklistDialog
                open={newOpen}
                onClose={() => setNewOpen(false)}
                projectPid={projectPid}
                onCreated={() => onInstalled?.('', 'control')}
            />
            <Stack spacing={1.5}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Search..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                {projectDimensions !== undefined && (
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={forProject}
                                    onChange={(e) => setForProject(e.target.checked)}
                                />
                            }
                            label="For this project"
                        />
                        {projectDimensions.length === 0 && (
                            <Typography variant="caption" color="text.secondary" display="block">
                                No control objectives selected yet: showing everything.
                            </Typography>
                        )}
                    </Box>
                )}
                {dimensionVocabulary.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {dimensionVocabulary.map((d) => {
                            const children = childrenOf(catalogue.subdimensions, d.slug);
                            const open = selectedDimensions.includes(d.slug);
                            return (
                                <Box key={d.slug} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                                    <Chip
                                        label={d.label}
                                        size="small"
                                        onClick={() => toggleDimension(d.slug)}
                                        color={open ? 'primary' : 'default'}
                                        variant={open ? 'filled' : 'outlined'}
                                    />
                                    {open &&
                                        children.map((c) => (
                                            <Chip
                                                key={c.slug}
                                                label={c.label}
                                                size="small"
                                                onClick={() => toggleDimension(c.slug)}
                                                color={selectedDimensions.includes(c.slug) ? 'primary' : 'default'}
                                                variant={
                                                    selectedDimensions.includes(c.slug) ? 'filled' : 'outlined'
                                                }
                                                sx={{ ml: 1, fontSize: '0.7rem' }}
                                            />
                                        ))}
                                </Box>
                            );
                        })}
                    </Box>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {tags.slice(0, tagOpen ? tags.length : 12).map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            onClick={() => toggleTag(tag)}
                            color={selectedTags.includes(tag) ? 'primary' : 'default'}
                            variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                        />
                    ))}
                    {tags.length > 12 && (
                        <Chip
                            label={tagOpen ? 'less' : `+${tags.length - 12} tags`}
                            size="small"
                            variant="outlined"
                            onClick={() => setTagOpen((o) => !o)}
                        />
                    )}
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : total === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        No matching items in the catalogue.
                    </Typography>
                ) : (
                    <Grid container spacing={1.5}>
                        {controls.map((c) => {
                            const key = c.catalogue_id;
                            return (
                                <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <ControlCard
                                        item={c}
                                        installed={isInstalled(key)}
                                        onInstall={async () => {
                                            const ok = await installItem(projectPid, c.catalogue_id, 'control');
                                            if (ok) {
                                                addLocal(key);
                                                onInstalled?.(c.catalogue_id, 'control');
                                            }
                                        }}
                                        onUninstall={() => void handleUninstall(key, c.catalogue_id, 'control')}
                                    />
                                </Grid>
                            );
                        })}
                        {plugins.map((p) => {
                            const key = pluginKey(p);
                            return (
                                <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <PluginCard
                                        item={p}
                                        installed={isInstalled(key)}
                                        onInstall={async () => {
                                            const ok = await installItem(
                                                projectPid,
                                                p.package_name,
                                                'plugin',
                                                p.plugin_name,
                                            );
                                            if (ok) {
                                                addLocal(key);
                                                onInstalled?.(p.package_name, 'plugin');
                                            }
                                        }}
                                        onUninstall={() =>
                                            void handleUninstall(key, p.package_name, 'plugin', p.plugin_name)
                                        }
                                    />
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Stack>
        </AppDialog>
    );
}
