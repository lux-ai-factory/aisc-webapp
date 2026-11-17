import { Box, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { getOverview } from '../lib/overview';
import '../styles/common.css';

/**
 * Collect evidence hub (UI-02): the pilot's four columns — answer checklists, run tests, results
 * and report — scoped to the latest AI card version. Each column opens the page that holds it.
 */
const EvidenceHub = () => {
    const { project_name } = useParams();
    const { projectUUID: pid } = useProject();
    const [version, setVersion] = useState<number | null>(null);

    useEffect(() => {
        if (!pid) return;
        getOverview(pid)
            .then((o) => setVersion(o.latestCardVersion))
            .catch(() => setVersion(null));
    }, [pid]);

    const base = project_name ? `/projects/${project_name}` : null;
    const columns = [
        {
            key: 'checklists',
            svc: 'Checklists',
            title: 'Answer checklists',
            body: 'Work through the installed checklists and record the answers.',
            to: 'checklists',
        },
        {
            key: 'tests',
            svc: 'Tests',
            title: 'Run tests',
            body: 'Execute the installed tests on the system and its components.',
            to: 'sandbox',
        },
        {
            key: 'results',
            svc: 'Results',
            title: 'Results',
            body: 'See the runs for the selected AI card version and their measurements.',
            to: 'dashboard',
        },
        {
            key: 'report',
            svc: 'Report',
            title: 'Report',
            body: 'Compose the report from the evidence collected for this version.',
            to: 'report',
        },
    ];

    return (
        <Box>
            <Box className="page-header" sx={{ mb: 3 }}>
                <Typography variant="h4" className="page-header-title">
                    Collect evidence
                </Typography>
                {version !== null && (
                    <span className="brand-mono" data-testid="card-version">
                        AI card v{version}
                    </span>
                )}
            </Box>
            <Box className="brand-steps">
                {base &&
                    columns.map((c) => (
                        <Box key={c.key} component={Link} to={`${base}/${c.to}`} className="brand-step">
                            <span className="brand-mono brand-step-svc">{c.svc}</span>
                            <Typography variant="h6" className="brand-step-title">
                                {c.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {c.body}
                            </Typography>
                            <span className="brand-step-open">Open →</span>
                        </Box>
                    ))}
            </Box>
        </Box>
    );
};

export default EvidenceHub;
