import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";
import {List, ListItem, Stack, Tooltip, Typography} from "@mui/material";
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
                    <ListItem
                        key={evaluation.pid}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 1,
                            padding: "12px 16px",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.03)",
                            cursor: "pointer",
                            transition: "0.15s",
                            "&:hover": {
                                background: "rgba(255,255,255,0.08)"
                            }
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CheckCircleIcon sx={{ color: "#00e676" }} />

                            {SHOW_PLUGIN_VISUALIZATION ? (
                                <Link
                                    to={`${evaluation.pid}`}
                                    style={{
                                        textDecoration: "none",
                                        fontWeight: 600
                                    }}
                                >
                                    {evaluation.pid}
                                </Link>
                            ) : (
                                <Typography sx={{ fontWeight: 600 }}>
                                    {evaluation.pid}
                                </Typography>
                            )}
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                            {evaluation.evaluation_plugins?.map((plugin: Plugin) => (
                                <Tooltip
                                    key={plugin.name}
                                    title={JSON.stringify(plugin.plugin_config, null, 2)}
                                    placement="top"
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
                                        {plugin.name}
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
