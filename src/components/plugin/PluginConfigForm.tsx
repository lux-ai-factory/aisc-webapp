import { useMutation } from '@tanstack/react-query';
import Form from '@rjsf/react-bootstrap';
import validator from '@rjsf/validator-ajv8';
import React, {useCallback, useRef} from 'react';
import { debounce } from 'lodash';
import { API_VERSION_PREFIX } from "../../config.tsx";
import toast from "react-hot-toast";
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '../../context/ProjectContext';

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface PluginConfigFormProps {
    pluginName: string;
    formSchema: object;
    uiSchema: any;
    config?: object | null;
    onFormUpdate: (updatedState: { config: object; formSchema: object; uiSchema: object }) => void;
    onSubmit: (config: object) => void;
}

const updateConfigDynamics = async ({ pluginName, config }: { pluginName: string; config: object }) => {
    const data = { config: config }

    const response = await fetch(`${API_URL}/plugins/${pluginName}/config/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update config dynamics');
    return response.json();
};

function PluginConfigForm({
                              pluginName,
                              formSchema,
                              uiSchema,
                              config,
                              onFormUpdate,
                              onSubmit
                          }: PluginConfigFormProps) {

    const queryClient = useQueryClient();
    const { projectUUID } = useProject();

    // Mutation to handle background schema/data synchronization
    const mutation = useMutation({
        mutationFn: updateConfigDynamics,
        onSuccess: (data) => {
            onFormUpdate(data);
            // I added this to remove the warning icon on the plugin on the left bar, but it takes like 10s
            queryClient.invalidateQueries({
                queryKey: ['project', projectUUID, 'withIcons']
            });
        },
    });

    // Debounced function to avoid hammering the server on every keystroke
    const debouncedUpdate = useCallback(
        debounce((data: any) => {
            mutation.mutate({ pluginName, config: data });
        }, 500),
        [pluginName, mutation.mutate]
    );

    const handleChange = (e: any) => {
        const newData = e.formData;
        // Update parent immediately so the UI is responsive
        onFormUpdate({ config: newData, formSchema, uiSchema });
        // Trigger server-side validation/schema updates
        debouncedUpdate(newData);
    };

    const handleExportJson = () => {
        const payload = config ?? {};
        const json = JSON.stringify(payload, null, 2);

        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const safeName = (pluginName || 'plugin').replace(/[^a-z0-9_-]+/gi, '_');
        const filename = `${safeName}-config.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    };

    const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    return (
        <Form
            key={pluginName}
            schema={formSchema}
            uiSchema={uiSchema}
            validator={validator}
            formData={config}
            onChange={handleChange}
            onSubmit={({ formData }) => onSubmit(formData)}
        >
            <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleFileSelected}
                    style={{ display: 'none' }}
                />
                <abbr title="Export form data as a JSON file">
                    <button className="btn btn-outline-secondary" type="button" onClick={handleExportJson}>
                        Export
                    </button>
                </abbr>
                <abbr title="Import form data from a JSON file">
                    <button className="btn btn-outline-secondary" type="button" onClick={handleImportClick}>
                        Import
                    </button>
                </abbr>
                <button className="btn btn-primary" type="submit">
                    Save Configuration
                </button>
            </div>
        </Form>
    );
}

export default PluginConfigForm;
