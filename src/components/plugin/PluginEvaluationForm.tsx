import { useQuery } from '@tanstack/react-query';
import { getPluginInputDefinitions, getProject } from "../../api/api.tsx";
import { Plugin, PluginConfig, PluginInputDefinition, DataObject, PluginInputValue } from "../../models/models.tsx";
import { Box, Icon, FormControl, InputLabel, MenuItem, Select, Card, CardContent, Chip, Typography, Tooltip } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useProject } from "../../context/ProjectContext.tsx";
import { useState, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL + '/api/v1';

interface PluginEvaluationFormProps {
    plugin: Plugin;
    isConfigured: boolean;
    isActive: boolean;
    className?: string;
    selections: PluginInputValue[];
    onToggle: () => void;
    onUnselect?: () => void;
    onSelectionChange: (item: PluginInputValue | null, inputName: string) => void;
    onValidationChange?: (valid: boolean) => void;
}

export default function PluginEvaluationForm({
    plugin,
    isConfigured,
    isActive,
    className,
    selections,
    onToggle,
    onUnselect,
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

    const latestConfig = configs && configs.length > 0
        ? [...configs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        : null;
    const configValue = selectedConfig ?? latestConfig?.id ?? '';

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

    const selectMenuProps = {
        disablePortal: false,
        PaperProps: {
            sx: {
                mt: 0.5,
                borderRadius: 1.5,
                border: '1px solid rgba(25, 87, 191, 0.24)',
                boxShadow: '0 14px 30px rgba(18, 84, 188, 0.24)',
                maxHeight: 320,
                overflowY: 'auto',
            },
        },
        MenuListProps: {
            dense: true,
        },
    } as const;

    return (
        <Card
            className={className}
            data-plugin-card
            onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (!isActive) {
                    onToggle();
                }
            }}
            sx={{
                cursor: 'pointer',
                border: isActive ? '2px solid' : isConfigured ? 'none' : '1px solid',
                borderColor: isActive ? 'primary.main' : isConfigured ? undefined : 'grey.200',
                background: isActive
                    ? 'linear-gradient(140deg, rgba(112, 186, 255, 0.45) 0%, rgba(69, 145, 251, 0.34) 45%, rgba(0, 82, 204, 0.28) 100%)'
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
                        <Tooltip title="Unselect plugin">
                            <CheckCircleIcon
                                sx={{ color: 'success.main', alignSelf: 'center', fontSize: 24, cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUnselect?.();
                                }}
                            />
                        </Tooltip>
                    ) : isConfigured && someMandatoryFilled ? (
                        <Tooltip title="Missing required fields">
                            <Icon sx={{ color: 'warning.main', alignSelf: 'center', fontSize: 24 }}>warning</Icon>
                        </Tooltip>
                    ) : (
                        <CheckCircleOutlineIcon
                            sx={{ color: 'action.disabled', alignSelf: 'center', fontSize: 24 }}
                        />
                    )}
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
                                    <FormControl
                                        fullWidth
                                        size="small"
                                        sx={{
                                            alignSelf: 'stretch',
                                            '& .MuiOutlinedInput-root': {
                                                bgcolor: 'rgba(238, 246, 255, 0.95)',
                                                borderRadius: 1.5,
                                                boxShadow: '0 1px 6px rgba(18, 84, 188, 0.08)',
                                                minHeight: 42,
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: 'rgba(25, 87, 191, 0.35)',
                                                    borderWidth: 1.5,
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: 'rgba(25, 87, 191, 0.62)',
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: 'primary.main',
                                                    borderWidth: 2,
                                                },
                                            },
                                        }}
                                    >
                                        {Boolean(currentSelection?.pid) && (
                                            <InputLabel
                                                id={`label-${def.name}`}
                                                sx={{
                                                    color: '#111111',
                                                    fontWeight: 700,
                                                    '&.Mui-focused': {
                                                        color: '#111111',
                                                        fontWeight: 700,
                                                    },
                                                }}
                                            >
                                                {def.label || def.name}
                                            </InputLabel>
                                        )}
                                        <Select
                                            labelId={currentSelection?.pid ? `label-${def.name}` : undefined}
                                            label={currentSelection?.pid ? (def.label || def.name) : undefined}
                                            required={def.required}
                                            MenuProps={selectMenuProps}
                                            value={currentSelection?.pid || ""}
                                            displayEmpty
                                            renderValue={(value) => {
                                                if (!value) {
                                                    return (
                                                        <Typography component="span" sx={{color: 'text.secondary'}}>
                                                            {def.label || def.name}
                                                        </Typography>
                                                    );
                                                }
                                                const selectedObj = options?.find((o: DataObject) => o.pid === value);
                                                return selectedObj?.name || String(value);
                                            }}
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
                            <FormControl
                                fullWidth
                                size="small"
                                sx={{
                                    alignSelf: 'stretch',
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: 'rgba(238, 246, 255, 0.95)',
                                        borderRadius: 1.5,
                                        boxShadow: '0 1px 6px rgba(18, 84, 188, 0.08)',
                                        minHeight: 42,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'rgba(25, 87, 191, 0.35)',
                                            borderWidth: 1.5,
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'rgba(25, 87, 191, 0.62)',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                            borderWidth: 2,
                                        },
                                    },
                                }}
                            >
                                {Boolean(configValue) && (
                                    <InputLabel
                                        id="plugin-config-label"
                                        sx={{
                                            color: '#111111',
                                            fontWeight: 700,
                                            '&.Mui-focused': {
                                                color: '#111111',
                                                fontWeight: 700,
                                            },
                                        }}
                                    >
                                        Config
                                    </InputLabel>
                                )}
                                <Select
                                    labelId={configValue ? 'plugin-config-label' : undefined}
                                    label={configValue ? 'Config' : undefined}
                                    MenuProps={selectMenuProps}
                                    value={configValue}
                                    renderValue={(value) => {
                                        const selected = configs.find((cfg: PluginConfig) => cfg.id === Number(value));
                                        if (!selected) {
                                            return 'Config';
                                        }
                                        return `Config #${selected.id} (${new Date(selected.created_at).toLocaleDateString()})`;
                                    }}
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
