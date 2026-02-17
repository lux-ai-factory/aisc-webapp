import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from "../context/ProjectContext.tsx";
import {Button, Checkbox, FormControlLabel, FormGroup, InputLabel, MenuItem, Select, Typography} from "@mui/material";
import {useState} from "react";
import {Plugin, DataObject} from "../models/models.tsx";
import toast from "react-hot-toast";
import {getProject} from "../api/api.tsx";
import Box from "@mui/material/Box";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type PluginSetting = {
    dataset_pid: string | null | undefined;
    model_pid: string | null | undefined;
}

type PluginSettingMap = {
    [pluginName: string]: PluginSetting;
}

const createEvaluation = async (project_uuid: string, plugins: PluginSettingMap) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    if (!plugins) throw new Error()

    const pluginsData: object[] = [];
    Object.entries(plugins).forEach(([pluginName, pluginSettings]) => {
        pluginsData.push({
            name: pluginName,
            dataset_pid: pluginSettings.dataset_pid || null,
            model_pid: pluginSettings.model_pid || null
        })
    })

    const data = {
        project_pid: project_uuid,
        plugins_to_run: pluginsData
    }

    const response = await fetch(`${API_URL}/evaluations/task`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        toast.error('Failed to create evaluation', {position: "bottom-right"});
        throw new Error('Failed to create evaluation');
    }
    toast.success('Evaluation created', {position: "bottom-right"});
    return await response.json();
};


function PluginStartEvaluation() {
    const {projectUUID} = useProject();
    const [checkedItems, setCheckedItems] = useState<string[]>([]);
    const [pluginSettings, setPluginSettings] = useState<PluginSettingMap>({});

    const {data: project, isPending, error} = useQuery({
        queryKey: ['project'],
        queryFn: () => getProject(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleChange = (e: any) => {
        const {value: pluginName, checked} = e.target;
        if (checked) {
            setCheckedItems([...checkedItems, pluginName]);
            setPluginSettings(prev => ({
                ...prev,
                [pluginName]: prev[pluginName] ?? {dataset_pid: null, model_pid: null},
            }));
        } else {
            setCheckedItems(checkedItems.filter((item) => item !== pluginName));
            setPluginSettings(prev => {
                const {[pluginName]: _removed, ...rest} = prev;
                return rest;
            });
        }
    };

    const handleDatasetDropdownChange = (e: any, pluginName: string) => {
        const selectedDatasetPid = e.target.value ?? null;
        setPluginSettings(prev => ({
            ...prev,
            [pluginName]: {
                ...prev[pluginName],
                dataset_pid: selectedDatasetPid,
                model_pid: prev[pluginName]?.model_pid ?? null
            }
        }));
    };

    const handleModelDropdownChange = (e: any, pluginName: string) => {
        const selectedModelPid = e.target.value ?? null;
        setPluginSettings(prev => ({
            ...prev,
            [pluginName]: {
                ...prev[pluginName],
                dataset_pid: prev[pluginName]?.dataset_pid ?? null,
                model_pid: selectedModelPid
            }
        }));
    };

    const handleOnClick = async (projectUUID: string) => {
        const selectedPluginSettings: PluginSettingMap = Object.fromEntries(
            checkedItems.map((name) => [
                name,
                pluginSettings[name] ?? {dataset_pid: null, model_pid: null},
            ])
        );

        await createEvaluation(projectUUID, selectedPluginSettings)
    }

    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Start an Evaluation
            </Typography>
            <FormGroup>
                {project?.plugins.map((projectPlugin: Plugin) => (
                    <>
                        <FormControlLabel control={
                            <Checkbox
                                checked={checkedItems.includes(projectPlugin.name)}
                                onChange={handleChange}
                                value={projectPlugin.name}
                            />
                        } label={projectPlugin.name}/>

                        <Box display={checkedItems.includes(projectPlugin.name) ? 'block' : 'none'}>
                            <InputLabel id="dataset-select-label">Dataset</InputLabel>
                            <Select
                                labelId="dataset-select-label"
                                fullWidth
                                onChange={(e) => handleDatasetDropdownChange(e, projectPlugin.name)}
                            >
                                {project?.datasets.map((dataset: DataObject) => (
                                    <MenuItem value={dataset.pid}>{dataset.name}</MenuItem>
                                ))}
                            </Select>
                        </Box>

                        <Box display={checkedItems.includes(projectPlugin.name) ? 'block' : 'none'}>
                            <InputLabel id="model-select-label">Model</InputLabel>
                            <Select
                                labelId="model-select-label"
                                fullWidth
                                onChange={(e) => handleModelDropdownChange(e, projectPlugin.name)}
                            >
                                {project?.models.map((model: DataObject) => (
                                    <MenuItem value={model.pid}>{model.name}</MenuItem>
                                ))}
                            </Select>
                        </Box>

                    </>
                ))}
            </FormGroup>
            <Button onClick={() => handleOnClick(projectUUID ?? "")}>Create Evaluation</Button>
        </>
    )
}

export default PluginStartEvaluation