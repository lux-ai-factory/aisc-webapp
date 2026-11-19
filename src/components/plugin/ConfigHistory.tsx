import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_VERSION_PREFIX } from "../../config.tsx";
import { MenuItem, Select } from "@mui/material";
import HistoryIcon from '@mui/icons-material/History';
import { PluginConfig } from "../../models/models.tsx";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const fetchConfigHistory = async (plugin_pid: string): Promise<PluginConfig[]> => {
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/configs`);
    if (!res.ok) throw new Error('Failed to fetch config history');
    return await res.json();
};

/** Adapter of the previous restore flow: picking a config makes it the
 *  plugin's current config, and the parent then reloads the form state. */
const restoreConfig = async (plugin_pid: string, config_id: number) => {
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/configs/${config_id}/restore`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore config');
    return await res.json();
};

interface ConfigHistoryProps {
    pluginPID: string;
    /** reload the form after the picked config is restored */
    onRestore: () => void;
}

export default function ConfigHistory({ pluginPID, onRestore }: ConfigHistoryProps) {
    const queryClient = useQueryClient();

    const { data: history } = useQuery({
        queryKey: ['pluginConfigHistory', pluginPID],
        queryFn: () => fetchConfigHistory(pluginPID),
        enabled: !!pluginPID
    });

    const restoreMutation = useMutation({
        mutationFn: (configId: number) => restoreConfig(pluginPID, configId),
        onSuccess: async () => {
            toast.success('Config restored', { position: "bottom-right" });
            await queryClient.invalidateQueries({ queryKey: ['projectPluginConfig'] });
            onRestore();
        },
        onError: () => {
            toast.error('Failed to restore config', { position: "bottom-right" });
        }
    });

    if (!history) return null;

    const empty = history.length === 0;

    return (
        <Select
            size="small"
            displayEmpty
            value=""
            className='plugin-config-select'
            sx={{ minWidth: 170 }}
            // the history icon leads the dropdown's "Config history" label
            startAdornment={<HistoryIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />}
            MenuProps={{
                PaperProps: {
                    className: 'plugin-config-menu',
                },
            }}
            renderValue={() => 'Config history'}
            onChange={(e) => restoreMutation.mutate(Number(e.target.value))}
        >
            {empty ? (
                <MenuItem value="" disabled>
                    No saved configs
                </MenuItem>
            ) : (
                history.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                        {new Date(c.created_at).toLocaleString()}
                    </MenuItem>
                ))
            )}
        </Select>
    );
}
