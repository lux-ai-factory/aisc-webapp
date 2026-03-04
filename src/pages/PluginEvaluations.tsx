import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";
import {List, ListItem, Typography} from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {Plugin} from "../models/models.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const getDoneEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

function PluginEvaluations() {
    const {projectUUID} = useProject();

    const {data: evaluations, isPending, error} = useQuery({
        queryKey: ['evaluations'],
        queryFn: () => getDoneEvaluations(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>


    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Completed Evaluations:
            </Typography>
            <List>
            {evaluations && evaluations.map((evaluation: any) => (
                <ListItem>
                    {evaluation["evaluation_plugins"] && evaluation["evaluation_plugins"].length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircleIcon color="success"/>
                            <Link to={`${evaluation["pid"]}`}>
                                {evaluation["evaluation_plugins"].map((plugin: Plugin) => plugin.name).join(' - ')}
                            </Link>
                        </div>
                    )}
                </ListItem>
            ))}
            </List>
        </>
    )
}

export default PluginEvaluations
