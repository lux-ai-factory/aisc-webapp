import { useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useProject } from '../context/ProjectContext';
import LogsPanel, { LogsPanelHandle } from '../components/LogsPanel';
import '../styles/common.css';

/** Project logs as a full page (the immutable audit ledger, project-scoped). */
export default function LogsPage() {
    const { projectUUID: pid } = useProject();
    const panelRef = useRef<LogsPanelHandle>(null);
    if (!pid) {
        return <Typography color="text.secondary">Select a project to open logs.</Typography>;
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Logs
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<RefreshIcon />}
                    onClick={() => panelRef.current?.refresh()}
                    className="gradient-btn"
                    sx={{ textTransform: 'none' }}
                >
                    Refresh
                </Button>
            </Box>
            <LogsPanel ref={panelRef} pid={pid} />
        </Box>
    );
}
