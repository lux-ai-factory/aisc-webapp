import { useQuery } from '@tanstack/react-query';
import { getPluginInputDefinitions, getProject } from "../../api/api.tsx";
import { Plugin, PluginConfig, PluginInputDefinition, DataObject, PluginInputValue, ProjectSetting, SettingDefinition } from "../../models/models.tsx";
import { Box, Icon, FormControl, InputLabel, MenuItem, Select, Card, CardContent, Chip, Typography, Tooltip } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import { useProject } from "../../context/ProjectContext.tsx";
import { useState, useEffect, useRef } from "react";
import './PluginEvaluationForm.css';

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
    datashapeSettings?: ProjectSetting[];
    settingDefinitions?: SettingDefinition[];
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
    onValidationChange,
    datashapeSettings = [],
    settingDefinitions = []
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

    const sortedConfigs = configs
        ? [...configs].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        : [];
    const configLocalIndex = new Map(sortedConfigs.map((cfg, i) => [cfg.id, i + 1]));
    const latestConfig = sortedConfigs.length > 0 ? sortedConfigs[sortedConfigs.length - 1] : null;
    const configValue = selectedConfig ?? latestConfig?.id ?? '';

    const allMandatoryFilled = !!inputDefinitions && inputDefinitions.every(
        def => !def.required || selections.some(s => s.name === def.name)
    );
    const datashapeDefinition = settingDefinitions.find(definition => definition.category === 'datashape');
    const selectedDatashape = selections.find(selection => selection.name === datashapeDefinition?.name);

    const onValidationChangeRef = useRef(onValidationChange);
    onValidationChangeRef.current = onValidationChange;

    useEffect(() => {
        onValidationChangeRef.current?.(allMandatoryFilled);
    }, [allMandatoryFilled]);

    const someMandatoryFilled = !!inputDefinitions && inputDefinitions.some(
        def => def.required && selections.some(s => s.name === def.name)
    );

    const isReady = isConfigured && allMandatoryFilled && (!datashapeDefinition?.required || !!selectedDatashape);
    const backendConfigured = plugin.config !== null;

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
            className: 'plugin-evaluation-form__select-paper',
            sx: {
                mt: 0.5,
                borderRadius: 1.5,
            },
        },
        MenuListProps: {
            dense: true,
        },
    };

    const cardClasses = [
        className,
        !backendConfigured && 'plugin-eval-card--unconfigured',
        isActive && 'plugin-eval-card--active',
        isConfigured && !isActive && 'plugin-eval-card--configured',
        isReady && 'plugin-eval-card--ready',
    ].filter(Boolean).join(' ');

    const card = (
        <Card
            className={cardClasses}
            data-plugin-card
            onClick={(e: React.MouseEvent) => {
                if (!backendConfigured) return;
                e.stopPropagation();
                if (!isActive) {
                    onToggle();
                }
            }}
            sx={{
                ...(isReady && {
                    border: '2px solid',
                    borderColor: 'rgba(25, 118, 210, 0.55)',
                }),
                ...(backendConfigured && {
                    '&:hover': {
                        boxShadow: 4,
                        ...(isReady && { borderColor: 'rgba(25, 118, 210, 0.9)' }),
                    },
                }),
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
                    ) : !backendConfigured ? (
                        <Tooltip title="Plugin not configured">
                            <Icon sx={{ color: 'error.main', alignSelf: 'center', fontSize: 24 }}>error</Icon>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Plugin not selected">
                            <CircleOutlinedIcon sx={{ color: 'action.disabled', alignSelf: 'center', fontSize: 24 }} />
                        </Tooltip>
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
                                        className="plugin-evaluation-form__form-control"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 1.5,
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: 'primary.main',
                                                },
                                            },
                                        }}
                                    >
                                        {Boolean(currentSelection?.pid) && (
                                            <InputLabel
                                                id={`label-${def.name}`}
                                                className="plugin-evaluation-form__input-label"
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

                        {datashapeDefinition && (
                            <FormControl fullWidth size="small">
                                <InputLabel>{datashapeDefinition.label}</InputLabel>
                                <Select label={datashapeDefinition.label} value={selectedDatashape?.pid ?? ''}
                                    onChange={event => onSelectionChange(
                                        event.target.value
                                            ? {pid: event.target.value, name: datashapeDefinition.name, input_type: 'datashape'}
                                            : null,
                                        datashapeDefinition.name,
                                    )}>
                                    {!datashapeDefinition.required && <MenuItem value="">None</MenuItem>}
                                    {datashapeSettings.map(setting => (
                                        <MenuItem key={setting.pid} value={setting.pid}>{setting.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {configs && configs.length > 0 && (
                            <FormControl
                                fullWidth
                                size="small"
                                className="plugin-evaluation-form__form-control"
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 1.5,
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                        },
                                    },
                                }}
                            >
                                {Boolean(configValue) && (
                                    <InputLabel
                                        id="plugin-config-label"
                                        className="plugin-evaluation-form__input-label"
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
                                        return `Config #${configLocalIndex.get(selected.id) ?? selected.id} (${new Date(selected.created_at).toLocaleDateString()})`;
                                    }}
                                    onChange={(e) => setSelectedConfig(e.target.value ? Number(e.target.value) : null)}
                                >
                                    {configs.map((cfg: PluginConfig) => (
                                        <MenuItem key={cfg.id} value={cfg.id}>
                                            Config #{configLocalIndex.get(cfg.id) ?? cfg.id} ({new Date(cfg.created_at).toLocaleDateString()})
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

    return backendConfigured ? card : (
        <Tooltip title="Plugin not configured" placement="top">
            {card}
        </Tooltip>
    );
}
