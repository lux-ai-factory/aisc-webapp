import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../../config.tsx";
import {InputLabel, MenuItem, Select, SelectChangeEvent, FormControl} from "@mui/material";
import {PluginConfig, Plugin} from "../../models/models.tsx";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const fetchConfigHistory = async (plugin_pid: string): Promise<PluginConfig[]> => {
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/configs`);
    if (!res.ok) throw new Error('Failed to fetch config history');
    return await res.json();
};

const restoreConfig = async (plugin_pid: string, config_id: number): Promise<Plugin> => {
    const res = await fetch(`${API_URL}/plugins/${plugin_pid}/configs/${config_id}/restore`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore config');
    return await res.json();
};

interface ConfigHistoryProps {
    pluginPID: string;
    plugin_config_id?: number | null;
    onRestore?: () => void;
}

export default function ConfigHistory({ pluginPID, plugin_config_id, onRestore }: ConfigHistoryProps) {
    const queryClient = useQueryClient();

    const { data: history, isPending } = useQuery({
        queryKey: ['pluginConfigHistory', pluginPID],
        queryFn: () => fetchConfigHistory(pluginPID),
        enabled: !!pluginPID
    });

    const restoreMutation = useMutation({
        mutationFn: (configId: number) => restoreConfig(pluginPID, configId),
        onSuccess: async () => {
            toast.success('Config restored', { position: "bottom-right" });
            // Force query refresh in parent component
            await queryClient.invalidateQueries({ queryKey: ['projectPluginConfig'] });
            onRestore?.();
        },
        onError: () => {
            toast.error('Failed to restore config', { position: "bottom-right" });
        }
    });

    if (isPending) return <span>Loading history...</span>;

    const handleRestore = (event: SelectChangeEvent<number>) => {
        const configId = event.target.value as number;
        restoreMutation.mutate(configId);
    };

    
    const selectedConfig = history?.find(c => c.id === plugin_config_id);

    return (
        <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="config-history-label">Config History</InputLabel>
            <Select
                labelId="config-history-label"
                value={selectedConfig?.id || ''}
                label="Config History"
                onChange={handleRestore}
            >
                {history?.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                        {new Date(c.created_at).toLocaleString()} {c.id === selectedConfig?.id ? '(Current)' : ''}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
