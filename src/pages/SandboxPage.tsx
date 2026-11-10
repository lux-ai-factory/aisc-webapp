import { useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useProject } from '../context/ProjectContext';
import PluginStartEvaluation from './PluginStartEvaluation';
import PluginEvaluations from './PluginEvaluations';

/** Sandbox (WP8 W8): start an evaluation, with live progress + past results below. */
export default function SandboxPage() {
    const { projectUUID: pid, projectName } = useProject();
    const [refreshSeed, setRefreshSeed] = useState(0);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open the sandbox.</Typography>;
    }

    const linkBase = projectName ? `/projects/${projectName}/plugins/evaluations/` : undefined;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            {/* <Typography variant="h4">Sandbox</Typography> */}
            <PluginStartEvaluation onCreated={() => setRefreshSeed((s) => s + 1)} />
            <Divider />
            <PluginEvaluations linkBase={linkBase} refreshSignal={refreshSeed} hideDownloadReport />
        </Box>
    );
}
