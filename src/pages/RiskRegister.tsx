import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SecurityIcon from '@mui/icons-material/Security';
import { useProject } from '../context/ProjectContext';
import RiskRegisterSection from '../components/RiskRegisterSection';

/** Risk register as its own step (also embedded under Control objectives). */
export default function RiskRegister() {
    const { projectUUID: pid } = useProject();
    if (!pid) {
        return <Typography color="text.secondary">Select a project to open the risk register.</Typography>;
    }
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box className="page-header">
                <SecurityIcon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }} />
                <Typography variant="h4" className="page-header-title">
                    Risk register
                </Typography>
            </Box>
            <RiskRegisterSection pid={pid} />
        </Box>
    );
}
