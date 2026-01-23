import { useMutation } from '@tanstack/react-query';
import Form from '@rjsf/react-bootstrap';
import validator from '@rjsf/validator-ajv8';
import {useCallback} from 'react';
import { debounce } from 'lodash';
import { API_VERSION_PREFIX } from "../config.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

interface PluginConfigFormProps {
    pluginName: string;
    schema: object;
    uiSchema: any;
    config: object;
    onFormUpdate: (updatedState: { config: object; schema: object; uiSchema: object }) => void;
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
                              schema,
                              uiSchema,
                              config,
                              onFormUpdate,
                              onSubmit
                          }: PluginConfigFormProps) {

    // Mutation to handle background schema/data synchronization
    const mutation = useMutation({
        mutationFn: updateConfigDynamics,
        onSuccess: (data) => {
            onFormUpdate(data);
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
        onFormUpdate({ config: newData, schema, uiSchema });
        // Trigger server-side validation/schema updates
        debouncedUpdate(newData);
    };

    return (
        <Form
            schema={schema}
            uiSchema={uiSchema}
            validator={validator}
            formData={config}
            onChange={handleChange}
            onSubmit={({ formData }) => onSubmit(formData)}
        >
            <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
                <button className="btn btn-primary" type="submit">
                    Save Configuration
                </button>
            </div>
        </Form>
    );
}

export default PluginConfigForm;