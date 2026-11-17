import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import VersionSelect from './VersionSelect';
import '../styles/common.css';
import { listSystemVersions } from '../lib/report';
import {
    ProjectResults,
    ToolResult,
    chartSummary,
    connectionsLine,
    getProjectResults,
    helperModelsLine,
    publishToDashboard,
} from '../lib/results';

function formatDay(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function ToolTile({ tool }: { tool: ToolResult }) {
    const helpers = helperModelsLine(tool.helpers);
    const connections = connectionsLine(tool.connections);
    return (
        <Box className="brand-step" data-testid="result-tool">
            <Typography className="brand-step-title" variant="h6">
                {tool.label}
            </Typography>
            <Typography className="brand-mono" color="text.secondary">
                {tool.executed} completed · {tool.failed} failed · {tool.running} running
                {tool.observations ? ` · ${tool.observations} observations` : ''}
                {tool.last_run ? ` · last run ${formatDay(tool.last_run)}` : ''}
            </Typography>
            {connections && (
                <Typography className="brand-mono" color="text.secondary">
                    Reached through {connections}
                </Typography>
            )}
            {helpers && (
                <Typography className="brand-mono" color="text.secondary">
                    Helper models: {helpers}
                </Typography>
            )}
            {tool.local && (
                <Chip label="local model only" size="small" variant="outlined" color="info" />
            )}
            {tool.dashboard_url ? (
                <Link
                    className="brand-step-open"
                    href={tool.dashboard_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="none"
                >
                    Open charts →
                </Link>
            ) : (
                <Typography className="brand-step-open" color="text.disabled">
                    No dashboard
                </Typography>
            )}
        </Box>
    );
}

/**
 * Scoped results (ANA-01): one AI-card version's tools with their run counts,
 * the helper models they used and how they reached the target, and the external
 * dashboard link for each — the pilot's results page re-expressed in React.
 */
export default function ResultsSection({ pid }: { pid: string }) {
    const [versions, setVersions] = useState<{ pid: string; number: number }[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [results, setResults] = useState<ProjectResults | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [published, setPublished] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;
        listSystemVersions(pid)
            .then((rows) => {
                if (alive) setVersions(rows.map((v) => ({ pid: v.pid, number: v.number })));
            })
            .catch(() => {
                if (alive) setVersions([]);
            });
        return () => {
            alive = false;
        };
    }, [pid]);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            setResults(
                await getProjectResults(pid, selected ? { version: selected } : {}),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load results');
        }
    }, [pid, selected]);

    useEffect(() => {
        setResults(null);
        void refresh();
    }, [refresh]);

    const options = versions.map((v) => ({ id: v.pid, label: `v${v.number}` }));
    const hasTools = (results?.tools.length ?? 0) > 0 || (results?.greyed.length ?? 0) > 0;

    return (
        <Box className="brand-block" data-testid="results-section">
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    mb: 2,
                }}
            >
                <Typography className="brand-block-title" sx={{ mb: 0 }}>
                    Results
                </Typography>
                <VersionSelect
                    options={options}
                    value={selected}
                    fallbackLabel={results?.version ? `v${results.version.number}` : 'Latest'}
                    ariaLabel="Results version"
                    onSelect={(id) => setSelected(id ?? null)}
                />
                {results?.dashboard.authenticated && results.dashboard.url && (
                    <Link
                        className="brand-mono"
                        href={results.dashboard.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ml: 'auto' }}
                        data-testid="dashboard-link"
                    >
                        Every test&apos;s charts →
                    </Link>
                )}
                {results && !results.dashboard.authenticated && (
                    <Typography
                        className="brand-mono"
                        color="text.disabled"
                        sx={{ ml: 'auto' }}
                        data-testid="dashboard-closed"
                    >
                        No dashboard link: the analytics bridge is not configured
                    </Typography>
                )}
                {results?.dashboard.bridge_configured && (
                    <Button
                        size="small"
                        variant="outlined"
                        data-testid="publish-dashboard"
                        onClick={() => {
                            void publishToDashboard(pid).then((answer) =>
                                setPublished(answer.registered),
                            );
                        }}
                    >
                        Publish to the dashboard
                    </Button>
                )}
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {results === null && !error && <CircularProgress size={24} />}
            {results !== null && !hasTools && (
                <Typography color="text.secondary">
                    No tests installed yet: pick them in step 3, Choose tests and checklists.
                </Typography>
            )}
            {published !== null && (
                <Typography className="brand-mono" color="text.secondary" data-testid="published">
                    {published
                        ? 'The dashboard took this project.'
                        : 'The dashboard did not take this project (it is down or not configured).'}
                </Typography>
            )}
            {results !== null && (results.charts.length > 0 || hasTools) && (
                <Box className="brand-block" data-testid="results-charts" sx={{ mt: 2 }}>
                    <Typography className="brand-block-title" variant="h6">
                        Measurements
                    </Typography>
                    {results.charts.length === 0 ? (
                        <Typography className="brand-mono" color="text.secondary">
                            No measurements recorded on these runs yet.
                        </Typography>
                    ) : (
                        results.charts.map((chart) => (
                            <Typography
                                className="brand-mono"
                                key={chart.metric}
                                data-testid="chart-row"
                            >
                                {chart.metric}
                                {chart.unit ? ` (${chart.unit})` : ''} · {chartSummary(chart)}
                            </Typography>
                        ))
                    )}
                    <Typography className="brand-mono" color="text.disabled">
                        {results.chart_scope.evaluations} evaluation(s) in scope
                        {results.chart_scope.local_models_left_out
                            ? `, ${results.chart_scope.local_models_left_out} local-model run(s) left out`
                            : ''}
                    </Typography>
                </Box>
            )}
            {results !== null && hasTools && (
                <Grid container spacing={2}>
                    {results.tools.map((tool) => (
                        <Grid key={tool.plugin_name} size={{ xs: 12, sm: 6, md: 4 }}>
                            <ToolTile tool={tool} />
                        </Grid>
                    ))}
                    {results.greyed.map((tool) => (
                        <Grid key={`greyed-${tool.plugin_name}`} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Box
                                className="brand-step"
                                data-testid="greyed-tool"
                                sx={{ opacity: 0.7, borderStyle: 'dashed' }}
                            >
                                <Typography className="brand-step-title" variant="h6">
                                    {tool.label}
                                </Typography>
                                <Typography className="brand-mono" color="text.secondary">
                                    Installed, not run on it yet
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
