import {useQuery} from '@tanstack/react-query'
import {useState} from 'react';
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";
import {Box, Button, IconButton, List, ListItem, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography} from "@mui/material";
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import {Plugin} from "../models/models.tsx";
import EvaluationProgressList from "../components/EvaluationProgressList.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

const SHOW_PLUGIN_VISUALIZATION =
    String(import.meta.env.VITE_SHOW_PLUGIN_VISUALIZATION).toLowerCase() === 'true';

const getDoneEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

const REPORT_URL = (import.meta.env.VITE_REPORT_URL as string | undefined) ?? '/report';

function PluginEvaluations() {
    const {projectUUID, projectName} = useProject();
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    const handleDownloadReport = () => {
        if (!projectName) return;
        window.location.href = `${REPORT_URL}/generate?project=${encodeURIComponent(projectName)}`;
    };

    const handleDownloadEvalReport = (evaluationPid: string) => {
        if (!projectName || !evaluationPid) return;
        window.location.href = `${REPORT_URL}/generate?project=${encodeURIComponent(projectName)}&evaluation_pid=${encodeURIComponent(evaluationPid)}`;
    };

    const {data: evaluations, isPending, error} = useQuery({
        queryKey: ['evaluations', projectUUID],
        queryFn: () => getDoneEvaluations(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>


    return (
        <>
            {projectUUID && <EvaluationProgressList projectUUID={projectUUID} />}
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography component="h2" variant="h4" gutterBottom sx={{mb: 0}}>
                        Completed Evaluations:
                    </Typography>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={sortOrder}
                        onChange={(_, val) => { if (val) setSortOrder(val); }}
                        aria-label="sort order"
                    >
                        <ToggleButton value="newest" aria-label="newest first">
                            <SwapVertIcon fontSize="small" sx={{mr: 0.5}}/> Newest
                        </ToggleButton>
                        <ToggleButton value="oldest" aria-label="oldest first">
                            Oldest
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<DownloadIcon/>}
                    onClick={handleDownloadReport}
                    disabled={!projectName || !evaluations || evaluations.length === 0}
                >
                    Download Report
                </Button>
            </Box>
            <List sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

                {evaluations && [...evaluations].sort((a: any, b: any) => sortOrder === 'newest' ? b.id - a.id : a.id - b.id).map((evaluation: any) => (
                    <ListItem key={evaluation["pid"]} secondaryAction={
                        <Tooltip title="Download report for this evaluation">
                            <IconButton edge="end" onClick={() => handleDownloadEvalReport(evaluation["pid"])}>
                                <DownloadIcon/>
                            </IconButton>
                        </Tooltip>
                    }>
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
