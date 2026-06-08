import { useQuery } from '@tanstack/react-query';
import { getPluginInputDefinitions, getProject } from "../../api/api.tsx";
import { Plugin, PluginConfig, PluginInputDefinition, DataObject, PluginInputValue } from "../../models/models.tsx";
import { Box, Icon, FormControl, InputLabel, MenuItem, Select, Card, CardContent, Chip, Typography, Tooltip } from "@mui/material";
import { useProject } from "../../context/ProjectContext.tsx";
import { useState, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL + '/api/v1';

interface PluginEvaluationFormProps {
    plugin: Plugin;
    isConfigured: boolean;
    isActive: boolean;
    selections: PluginInputValue[];
    onToggle: () => void;
    onSelectionChange: (item: PluginInputValue | null, inputName: string) => void;
    onValidationChange?: (valid: boolean) => void;
}

export default function PluginEvaluationForm({
    plugin,
    isConfigured,
    isActive,
    selections,
    onToggle,
    onSelectionChange,
    onValidationChange
}: PluginEvaluationFormProps) {
    const { projectUUID } = useProject();
    const [selectedConfig, setSelectedConfig] = useState<number | null>(null);

    const { data: displayIcon } = useQuery({
        queryKey: ['pluginDisplayIcon', plugin.pid],
        queryFn: () => fetch(`${API_URL}/plugins/${plugin.pid}/display_icon`).then(r => r.ok ? r.json() : Promise.resolve('extension')),
        enabled: !!plugin.pid,
    });

    const { data: inputDefinitions, isPending: isDefinitionsPending } = useQuery({
        queryKey: ['inputDefinitions', plugin.pid],
        queryFn: () => getPluginInputDefinitions(plugin.pid),
        enabled: !!plugin.pid
    });

    const { data: project, isPending: isProjectPending } = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID!!),
        enabled: !!projectUUID
    });

    const { data: configs } = useQuery({
        queryKey: ['pluginConfigHistory', plugin.pid],
        queryFn: () => fetch(`${API_URL}/plugins/${plugin.pid}/configs`).then(r => r.json()) as Promise<PluginConfig[]>,
        enabled: !!plugin.pid && isActive,
    });

    const allMandatoryFilled = !!inputDefinitions && inputDefinitions.every(
        def => !def.required || selections.some(s => s.name === def.name)
    );

    const onValidationChangeRef = useRef(onValidationChange);
    onValidationChangeRef.current = onValidationChange;

    useEffect(() => {
        onValidationChangeRef.current?.(allMandatoryFilled);
    }, [allMandatoryFilled]);

    const someMandatoryFilled = !!inputDefinitions && inputDefinitions.some(
        def => def.required && selections.some(s => s.name === def.name)
    );

    const isReady = isConfigured && allMandatoryFilled;

    if (isDefinitionsPending || isProjectPending) return <span>Loading...</span>;

    const findLabel = (def: PluginInputDefinition): string => {
        const sel = selections.find(s => s.name === def.name);
        if (!sel) return '';
        const pool = def.input_type === 'dataset' ? project?.datasets : project?.models;
        const obj = pool?.find((o: DataObject) => o.pid === sel.pid);
        return obj?.name ?? sel.pid.slice(0, 8);
    };

    return (
        <Card
            data-plugin-card
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle(); }}
            sx={{
                cursor: 'pointer',
                border: isActive ? '2px solid' : isConfigured ? 'none' : '1px solid',
                borderColor: isActive ? 'primary.main' : isConfigured ? undefined : 'grey.200',
                background: isActive
                    ? 'linear-gradient(135deg, rgba(69, 145, 251, 0.3), rgba(0, 52, 255, 0.2))'
                    : isReady
                    ? '#e8f0fe'
                    : 'white',
                transition: 'all 0.2s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': { boxShadow: 4, borderColor: isActive ? 'primary.main' : isReady ? 'primary.light' : 'grey.300' },
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Icon sx={{ fontSize: 32, color: 'primary.main', alignSelf: 'center' }}>
                        {displayIcon}
                    </Icon>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                            {plugin.display_name || plugin.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip label={plugin.package_name} size="small" color="primary" variant="filled" />
                            <Chip label={`v${plugin.version}`} size="small" color="info" variant="outlined" />
                        </Box>
                    </Box>
                    {isReady ? (
                        <Icon sx={{ color: 'success.main', alignSelf: 'center', fontSize: 24 }}>check_circle</Icon>
                    ) : someMandatoryFilled ? (
                        <Tooltip title="Missing required fields">
                            <Icon sx={{ color: 'warning.main', alignSelf: 'center', fontSize: 24 }}>warning</Icon>
                        </Tooltip>
                    ) : null}
                </Box>

                {isConfigured && !isActive && selections.length > 0 && (
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {selections.map(sel => {
                            const def = inputDefinitions?.find(d => d.name === sel.name);
                            const label = findLabel(def!);
                            return (
                                <Typography key={sel.name} variant="caption" color="text.secondary">
                                    {sel.name}: {label}
                                </Typography>
                            );
                        })}
                    </Box>
                )}

                {isActive && (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }} onClick={e => e.stopPropagation()}>
                        {inputDefinitions?.map((def: PluginInputDefinition) => {
                            const options = def.input_type === 'dataset' ? project?.datasets : project?.models;
                            const currentSelection = selections.find(s => s.name === def.name);

                            return (
                                <Box key={def.name}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel id={`label-${def.name}`}>
                                            {def.label || def.name}
                                        </InputLabel>
                                        <Select
                                            labelId={`label-${def.name}`}
                                            label={def.label || def.name}
                                            required={def.required}
                                            value={currentSelection?.pid || ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === "") {
                                                    onSelectionChange(null, def.name);
                                                } else {
                                                    const selectedObj = options?.find((o: DataObject) => o.pid === val);
                                                    if (selectedObj) {
                                                        onSelectionChange({
                                                            pid: selectedObj.pid,
                                                            name: def.name,
                                                            input_type: def.input_type
                                                        }, def.name);
                                                    }
                                                }
                                            }}
                                        >
                                            {!def.required && <MenuItem value=""><em>None</em></MenuItem>}
                                            {options?.map((item: DataObject) => (
                                                <MenuItem key={item.pid} value={item.pid}>{item.name}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {!def.required && (
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                            (Optional)
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}

                        {configs && configs.length > 0 && (
                            <FormControl fullWidth size="small">
                                <InputLabel>Config</InputLabel>
                                <Select
                                    label="Config"
                                    value={selectedConfig ?? configs[configs.length - 1].id}
                                    onChange={(e) => setSelectedConfig(e.target.value ? Number(e.target.value) : null)}
                                >
                                    {configs.map((cfg: PluginConfig) => (
                                        <MenuItem key={cfg.id} value={cfg.id}>
                                            Config #{cfg.id} ({new Date(cfg.created_at).toLocaleDateString()})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
