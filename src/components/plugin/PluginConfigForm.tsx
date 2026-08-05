import { useMutation } from '@tanstack/react-query';
import validator from '@rjsf/validator-ajv8';
import React, {useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import { debounce } from 'lodash';
import { API_VERSION_PREFIX } from "../../config.tsx";
import toast from "react-hot-toast";
import { useQueryClient } from '@tanstack/react-query';
import Form from './CustomFormTemplates.tsx';
import { FormControl, InputLabel, MenuItem, Select, Typography, Box } from '@mui/material';
import { ProjectSetting, ProjectSettingSelection, SettingDefinition } from '../../models/models';
import './PluginConfigForm.css';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface PluginConfigFormProps {
    pluginPID: string;
    pluginDisplayName?: string;
    formSchema: object;
    uiSchema: any;
    config?: object | null;
    onFormUpdate: (updatedState: { config: object; formSchema: object; uiSchema: object }) => void;
    onSubmit: (config: object, projectSettingSelections: ProjectSettingSelection[]) => void;
    settingDefinitions?: SettingDefinition[];
    projectSettings?: ProjectSetting[];
    projectSettingSelections?: ProjectSettingSelection[];
}

const updateConfigDynamics = async ({ pluginPID, config, projectSettingSelections }: { pluginPID: string; config: object; projectSettingSelections: ProjectSettingSelection[] }) => {
    const data = { config, project_setting_selections: projectSettingSelections };

    const response = await fetch(`${API_URL}/plugins/${pluginPID}/config/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update config dynamics');
    return response.json();
};

const PluginConfigForm = React.forwardRef<any, PluginConfigFormProps>(function PluginConfigForm({
    pluginPID,
    pluginDisplayName,
    formSchema,
    uiSchema,
    config,
    onFormUpdate,
    onSubmit,
    settingDefinitions = [],
    projectSettings = [],
    projectSettingSelections = [],
}: PluginConfigFormProps, ref) {
    const [settingSelections, setSettingSelections] = useState<Record<string, string>>({});

    const settingSelectionsToPayload = (selections: Record<string, string>): ProjectSettingSelection[] =>
        Object.entries(selections).map(([plugin_setting_key, project_setting_pid]) => ({ plugin_setting_key, project_setting_pid }));

    useEffect(() => {
        const selections: Record<string, string> = {};
        for (const definition of settingDefinitions) {
            const compatible = projectSettings.find(setting =>
                projectSettingSelections.some(selection => selection.project_setting_pid === setting.pid) &&
                setting.category === definition.category &&
                (definition.category !== 'general' || !definition.value_type || setting.json_value?.type === definition.value_type)
            );
            const selected = compatible ?? projectSettings.find(setting =>
                setting.category === definition.category && setting.key === definition.key &&
                (definition.category !== 'general' || !definition.value_type || setting.json_value?.type === definition.value_type)
            );
            if (selected) selections[definition.key] = selected.pid;
        }
        setSettingSelections(selections);
    }, [projectSettingSelections, projectSettings, settingDefinitions]);

    const queryClient = useQueryClient();
    // Mutation to handle background schema/data synchronization
    const mutation = useMutation({
        mutationFn: updateConfigDynamics,
        onSuccess: (data) => {
            onFormUpdate(data);
            // I added this to remove the warning icon on the plugin on the left bar, but it takes like 10s
            queryClient.invalidateQueries({ queryKey: ['project'] });
        },
    });

    // Debounced function to avoid hammering the server on every keystroke
    const debouncedUpdate = useCallback(
        debounce((data: any) => {
            mutation.mutate({ pluginPID, config: data, projectSettingSelections: settingSelectionsToPayload(settingSelections) });
        }, 500),
        [pluginPID, mutation.mutate, settingSelections]
    );

    const handleChange = (e: any) => {
        const newData = e.formData;
        // Update parent immediately so the UI is responsive
        onFormUpdate({ config: newData, formSchema, uiSchema });
        // Trigger server-side validation/schema updates
        debouncedUpdate(newData);
    };

    const toSnakeCase = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_');

    const toTimestamp = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${y}${m}${d}_${h}${min}${s}`;
    };

    const handleExportJson = () => {
        const payload = config ?? {};
        const json = JSON.stringify(payload, null, 2);

        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const safeName = toSnakeCase(pluginDisplayName || pluginPID || 'plugin') || 'plugin';
        const filename = `${safeName}_${toTimestamp(new Date())}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    };

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const formRefInternal = useRef<any>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            toast.error('No file selected', {position: "bottom-right"});
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result ?? '');
                const parsed = JSON.parse(text);

                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('JSON must be an object at the top level.');
                }

                const validate = validator.ajv.compile(formSchema);
                const isValid = validate(parsed);
                if (!isValid) {
                    const errorMessage = `${validate.errors?.[0].instancePath} ${validate.errors?.[0].message}`
                    throw new Error(`JSON does not match expected form schema.\n ${errorMessage}`);
                }

                onFormUpdate({ config: parsed as object, formSchema, uiSchema });
                debouncedUpdate(parsed);
                toast.success('Config JSON file imported', {position: "bottom-right"});
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                toast.error(message, {position: "bottom-right"});
            } finally {
                e.target.value = '';
            }
        };

        reader.onerror = () => {
            toast.error('Could not read file', {position: "bottom-right"});
            e.target.value = '';
        };

        reader.readAsText(file);
    };

    useImperativeHandle(ref, () => ({
        submit: () => formRefInternal.current?.submit(),
        exportJson: handleExportJson,
        importClick: handleImportClick,
    }));

    return (
        <>
        <>
        <Typography variant="h6" sx={{ mb: 2 }}>Project Settings</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            {settingDefinitions.map(definition => {
                const candidates = projectSettings.filter(setting =>
                    setting.category === definition.category &&
                    (definition.category !== 'general' || !definition.value_type || setting.json_value?.type === definition.value_type)
                );
                const selected = settingSelections[definition.key] ?? '';
                return (
                    <FormControl key={definition.key} fullWidth size="small">
                        <InputLabel>{definition.name} ({definition.key})</InputLabel>
                        <Select
                            label={`${definition.name} (${definition.key})`}
                            value={selected}
                            required={definition.required}
                            onChange={event => {
                                const pid = event.target.value;
                                const next = {
                                    ...settingSelections,
                                    ...(pid ? { [definition.key]: pid } : {}),
                                };
                                if (!pid) delete next[definition.key];
                                setSettingSelections(next);
                                mutation.mutate({
                                    pluginPID,
                                    config: config ?? {},
                                    projectSettingSelections: settingSelectionsToPayload(next),
                                });
                            }}
                        >
                            {!definition.required && <MenuItem value="">None</MenuItem>}
                            {candidates.map(setting => {
                                const preview = setting.category === 'secrets'
                                    ? (setting.masked_value || 'Secret')
                                    : setting.category === 'datashape'
                                        ? `${Array.isArray(setting.json_value?.features) ? setting.json_value.features.length : 0} features`
                                        : JSON.stringify(setting.json_value?.value);
                                return <MenuItem key={setting.pid} value={setting.pid}>
                                    <Box><Typography variant="body2">{setting.name} <Typography component="span" variant="caption" color="text.secondary">(project key: {setting.key})</Typography></Typography><Typography variant="caption" color="text.secondary">{preview}</Typography></Box>
                                </MenuItem>;
                            })}
                        </Select>
                    </FormControl>
                );
            })}
        </Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Plugin Configuration</Typography>
        <Form
            ref={formRefInternal}
            key={pluginPID}
            schema={formSchema}
            uiSchema={uiSchema}
            validator={validator}
            formData={config}
            onChange={handleChange}
            onSubmit={({ formData }) => onSubmit(formData, settingSelectionsToPayload(settingSelections))}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelected}
                style={{ display: 'none' }}
            />
            <button type="submit" style={{ display: 'none' }}>Save</button>
        </Form>
        </>
        </>
    );
});

export default PluginConfigForm;
