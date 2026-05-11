import { useQuery } from '@tanstack/react-query';
import { getPluginInputDefinitions, getProject } from "../../api/api.tsx";
import { Plugin, PluginInputDefinition, DataObject, PluginInputValue } from "../../models/models.tsx";
import { Box, Icon, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useProject } from "../../context/ProjectContext.tsx";

interface PluginEvaluationFormProps {
    plugin: Plugin;
    isSelected: boolean;
    selections: PluginInputValue[];
    onToggle: () => void;
    onSelectionChange: (item: PluginInputValue | null, inputName: string) => void;
}

export default function PluginEvaluationForm({
    plugin,
    isSelected,
    selections,
    onToggle,
    onSelectionChange
}: PluginEvaluationFormProps) {
    const { projectUUID } = useProject();

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

    if (isDefinitionsPending || isProjectPending) return <span>Loading...</span>;

    return (
        <Box
            className={`plugin-eval-card ${isSelected ? "selected" : ""}`}
            onClick={onToggle}
        >
            <Box className="plugin-eval-header">
                <Box className="plugin-eval-left">
                    <Icon>{plugin.display_icon}</Icon>
                    <span>{plugin.display_name}</span>
                </Box>

                {isSelected && (
                    <Icon className="plugin-eval-check">check_circle</Icon>
                )}
            </Box>

            {isSelected && (
                <Box
                    className="plugin-eval-body"
                    onClick={(e) => e.stopPropagation()}
                >
                    {inputDefinitions?.map((def: PluginInputDefinition) => {
                        const options = def.input_type === 'dataset' ? project?.datasets : project?.models;
                        const currentSelection = selections.find(s => s.name === def.name);

                        return (
                            <FormControl key={def.name} fullWidth size="small">
                                <InputLabel id={`label-${def.name}`}>
                                    {def.label || def.name}{!def.required && " (Optional)"}
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
                                    sx={{
                                        color: "white", // text color
                                        backgroundColor: "transparent",
                                        "& .MuiOutlinedInput-notchedOutline": {
                                            borderColor: "white"
                                        },
                                        "&:hover .MuiOutlinedInput-notchedOutline": {
                                            borderColor: "white"
                                        },
                                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                            borderColor: "white"
                                        },
                                        "& .MuiSvgIcon-root": {
                                            color: "white"
                                        }
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: "white",
                                                color: "black"
                                            }
                                        }
                                    }}
                                >

                                {!def.required && (
                                        <MenuItem value=""><em>None</em></MenuItem>
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
            )}
        </Box>
    );
}