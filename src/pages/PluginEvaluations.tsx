import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";
import {Button, List, ListItem, Stack, Tooltip, Typography} from "@mui/material";
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {Plugin} from "../models/models.tsx";
import Box from "@mui/material/Box";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const SHOW_PLUGIN_VISUALIZATION =
    String(import.meta.env.VITE_SHOW_PLUGIN_VISUALIZATION).toLowerCase() === 'true';

const getDoneEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

function PluginEvaluations() {
    const {projectUUID} = useProject();

    const {data: evaluations, isPending, error} = useQuery({
        queryKey: ['evaluations', projectUUID],
        queryFn: () => getDoneEvaluations(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>


    return (
        <>
            <Typography component="h2" variant="h4" gutterBottom>
                Completed Evaluations:
            </Typography>
            <List sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {evaluations && evaluations.map((evaluation: any) => (
                    <ListItem>
                        {SHOW_PLUGIN_VISUALIZATION &&
                            <Tooltip title={evaluation["pid"]} placement="top">
                                <Button
                                    component={Link}
                                    to={`${evaluation["pid"]}`}
                                    variant="outlined"
                                    size="small"
                                    sx={{ minWidth: 36, px: 1, mr: 2 }}
                                >
                                    <AssessmentIcon fontSize="small" sx={{ mr: 0.5 }}/>
                                    Results
                                    <CheckCircleIcon color="success" fontSize="small" sx={{ ml: 0.5 }}/>
                                </Button>
                            </Tooltip>
                        }
                        <Stack direction="row" spacing={2}>
                        {evaluation["evaluation_plugins"] && evaluation["evaluation_plugins"].map((plugin: Plugin) => (
                            <Tooltip
                                key={plugin.name}
                                title={JSON.stringify(plugin.plugin_config, null, 2)}
                            >
                                <Box
                                    sx={{
                                        padding: "3px 8px",
                                        borderRadius: "6px",
                                        background: "#4591FB",
                                        color: "white",
                                        fontSize: "0.8rem",
                                        cursor: "pointer",
                                        transition: "0.15s",
                                        "&:hover": {
                                            background: "#5aa0ff"
                                        }
                                    }}
                                >
                                    {plugin.display_name}
                                </Box>
                            </Tooltip>
                        ))}
                        </Stack>
                    </ListItem>
                ))}
            </List>
        </>
    )
}

export default PluginEvaluations
