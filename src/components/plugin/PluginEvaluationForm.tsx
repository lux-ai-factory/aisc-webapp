import { useQuery } from '@tanstack/react-query'
import { getPluginInputDefinitions, getProject } from "../../api/api.tsx";
import { Plugin, PluginInputDefinition, DataObject } from "../../models/models.tsx";
import {Box, InputLabel, MenuItem, Select, FormControl, Checkbox, FormControlLabel} from "@mui/material";
import { useProject } from "../../context/ProjectContext.tsx";

interface PluginEvaluationFormProps {
    plugin: Plugin;
}

export default function PluginEvaluationForm({ plugin }: PluginEvaluationFormProps) {
    const { projectUUID } = useProject();

    const { data: inputDefinitions, isPending: isDefinitionsPending, error: definitionsError } = useQuery({
        queryKey: ['inputDefinitions', plugin.name],
        queryFn: () => getPluginInputDefinitions(plugin.name!!),
        enabled: !!plugin.name
    });

    const { data: project, isPending: isProjectPending, error: projectError } = useQuery({
        queryKey: ['project', projectUUID],
        queryFn: () => getProject(projectUUID!!),
        enabled: !!projectUUID
    });

    if (isDefinitionsPending || isProjectPending) return <span>Loading...</span>;
    if (definitionsError || projectError) return <span>Oops! Something went wrong.</span>;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, ml: 4 }}>
            <FormControlLabel control={
                            <Checkbox
                                checked={true}
                                value={plugin.name}
                            />
                        } label={plugin.name}/>
            {inputDefinitions?.map((inputDefinition: PluginInputDefinition) => {
                // Determine which options to show based on input_type

                let options = [];
                switch(inputDefinition.input_type) {
                    case 'dataset':
                        options = project?.datasets
                        break;
                    case 'model':
                        options = project?.models
                        break;
                }

                return (
                    <FormControl key={inputDefinition.name} fullWidth>
                        <InputLabel id={`label-${inputDefinition.name}`}>
                            {inputDefinition.label || inputDefinition.name}{!inputDefinition.required && " (Optional)"}
                        </InputLabel>
                        <Select
                            labelId={`label-${inputDefinition.name}`}
                            label={inputDefinition.label || inputDefinition.name}
                            required={inputDefinition.required}
                            defaultValue=""
                        >
                            {!inputDefinition.required && (
                                <MenuItem value="">
                                    <em>None</em>
                                </MenuItem>
                            )}
                            {options?.map((item: DataObject) => (
                                <MenuItem key={item.pid} value={item.pid}>
                                    {item.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );
            })}
        </Box>
    );
}