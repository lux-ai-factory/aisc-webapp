import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {useProject} from "../context/ProjectContext.tsx";
import {Button} from "@mui/material";
import {useState} from "react";
import {Project, Plugin, DataObject} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

type PluginSetting = {
    dataset_pid: string | null | undefined;
    model_pid: string | null | undefined;
}

type PluginSettingMap = {
    [pluginName: string]: PluginSetting;
}

const getProject = async (project_uuid: string) => {
    if (!project_uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${project_uuid}`);
    return await res.json() as Project;
};

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

    return await response.json();
};


function PluginStartEvaluation() {
    const {projectUUID} = useProject();
    const [checkedItems, setCheckedItems] = useState([]);
    const [pluginSettings, setPluginSettings] = useState<PluginSettingMap>({});

    const {data: project, isPending, error} = useQuery({
        queryKey: ['project'],
        queryFn: () => getProject(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>

    const handleChange = (e: any) => {
        const {value, checked} = e.target;
        if (checked) {
            // @ts-ignore
            setCheckedItems([...checkedItems, value]);
        } else {
            setCheckedItems(checkedItems.filter((item) => item !== value));
        }
    };

    const handleDatasetDropdownChange = (e: any, pluginName: string) => {
        const selectedDatasetPid = e.target.value;
        setPluginSettings(prev => ({
            ...prev,
            [pluginName]: {
                ...prev[pluginName],
                dataset_pid: selectedDatasetPid,
                model_pid: prev[pluginName]?.model_pid || ''
            }
        }));
    };

    const handleModelDropdownChange = (e: any, pluginName: string) => {
        const selectedModelPid = e.target.value;
        setPluginSettings(prev => ({
            ...prev,
            [pluginName]: {
                ...prev[pluginName],
                dataset_pid: prev[pluginName]?.dataset_pid || '',
                model_pid: selectedModelPid
            }
        }));
    };

    const handleOnClick = async (projectUUID: string) => {
        await createEvaluation(projectUUID, pluginSettings)
    }

    return (
        <div>
            {project?.plugins.map((projectPlugin: Plugin) => (
                <>
                    <label style={{display: "block"}}>
                        {/* @ts-ignore */}
                        <input type="checkbox" value={projectPlugin.name} onChange={handleChange} checked={checkedItems.includes(projectPlugin.name)}/>
                        {projectPlugin.name}
                    </label>
                    <select name="Dataset" onChange={(e) => {
                        handleDatasetDropdownChange(e, projectPlugin.name)
                    }}>
                        <option>Select Dataset</option>
                        {project?.datasets.map((dataset: DataObject) => (
                            <option value={dataset.pid}>{dataset.name}</option>
                        ))}
                    </select>
                    <select name="Model" onChange={(e) => {
                        handleModelDropdownChange(e, projectPlugin.name)
                    }}>
                        <option>Select Model</option>
                        {project?.models.map((model: DataObject) => (
                            <option value={model.pid}>{model.name}</option>
                        ))}
                    </select>

                </>
            ))}
            <hr/>
            <Button onClick={() => handleOnClick(projectUUID ?? "")}>Create Evaluation</Button>
        </div>
    )
}

export default PluginStartEvaluation