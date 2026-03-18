import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../../config.tsx";
import {InputLabel, MenuItem, Select, SelectChangeEvent, FormControl} from "@mui/material";
import {PluginConfig, Plugin} from "../../models/models.tsx";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const fetchConfigHistory = async (plugin_name: string): Promise<PluginConfig[]> => {
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/configs`);
    if (!res.ok) throw new Error('Failed to fetch config history');
    return await res.json();
};

const restoreConfig = async (plugin_name: string, config_id: number): Promise<Plugin> => {
    const res = await fetch(`${API_URL}/plugins/${plugin_name}/configs/${config_id}/restore`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore config');
    return await res.json();
};

interface ConfigHistoryProps {
    pluginName: string;
    plugin_config_id?: number | null;
}

export default function ConfigHistory({ pluginName, plugin_config_id }: ConfigHistoryProps) {
    const queryClient = useQueryClient();

    const { data: history, isPending } = useQuery({
        queryKey: ['pluginConfigHistory', pluginName],
        queryFn: () => fetchConfigHistory(pluginName),
        enabled: !!pluginName
    });

    const restoreMutation = useMutation({
        mutationFn: (configId: number) => restoreConfig(pluginName, configId),
        onSuccess: async () => {
            toast.success('Config restored', { position: "bottom-right" });
            // Force query refresh in parent component
            await queryClient.invalidateQueries({ queryKey: ['projectPluginConfig'] });
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
