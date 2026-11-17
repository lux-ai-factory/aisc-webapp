import { Box, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { getOverview } from '../lib/overview';
import { listReports, type PastReport } from '../lib/report';
import '../styles/common.css';

/**
 * Collect evidence hub (UI-02): the pilot's four columns — answer checklists, run tests, results
 * and report — scoped to the latest AI card version. Each column opens the page that holds it.
 */
const EvidenceHub = () => {
    const { project_name } = useParams();
    const { projectUUID: pid } = useProject();
    const [version, setVersion] = useState<number | null>(null);
    const [reports, setReports] = useState<PastReport[]>([]);

    useEffect(() => {
        if (!pid) return;
        getOverview(pid)
            .then((o) => setVersion(o.latestCardVersion))
            .catch(() => setVersion(null));
    }, [pid]);

    // The report column's version and history (REP-02): every past report with the
    // AI-card version it snapshotted, newest first.
    useEffect(() => {
        if (!pid) return;
        listReports(pid)
            .then((all) =>
                setReports(
                    [...all].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
                ),
            )
            .catch(() => setReports([]));
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
                {base && (
                    <Link to={`${base}/evidence-map`} className="brand-mono" data-testid="evidence-map-link">
                        Open the evidence map →
                    </Link>
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
            {base && (
                <Box sx={{ mt: 4 }} data-testid="report-history">
                    <Typography variant="h6" className="brand-block" sx={{ mb: 1 }}>
                        Report history
                    </Typography>
                    {reports.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" data-testid="report-history-empty">
                            No report has been generated for this project yet.
                        </Typography>
                    ) : (
                        <Box className="brand-steps">
                            {reports.map((r) => (
                                <Box key={r.pid} component={Link} to={`${base}/report`} className="brand-step">
                                    <span className="brand-mono brand-step-svc">
                                        {r.system_version?.number != null
                                            ? `AI card v${r.system_version.number}`
                                            : 'no version'}
                                    </span>
                                    <Typography variant="body2" color="text.secondary">
                                        {r.format.toUpperCase()} · {r.created_at.slice(0, 10)}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default EvidenceHub;
