import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AppCard from '../components/AppCard';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';
import { DashboardStats, getDashboardStats } from '../lib/dashboard';
import ResultsSection from '../components/ResultsSection';
import '../styles/common.css';

interface StatCard {
    label: string;
    value: string;
    to: string | null;
    icon: string;
    tone: string;
}

/** Dashboard landing (WP8 W11): project-state summary, styled like the Overview. */
export default function DashboardPage() {
    const { projectUUID: pid, projectName } = useProject();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!pid) return;
        setError(null);
        try {
            setStats(await getDashboardStats(pid));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load dashboard');
        }
    }, [pid]);

    useEffect(() => {
        setStats(null);
        void refresh();
    }, [refresh]);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open the dashboard.</Typography>;
    }

    const base = projectName ? `/projects/${projectName}` : null;
    const cards: StatCard[] = stats
        ? [
              {
                  label: 'AI card',
                  value: stats.latestCardVersion === null ? 'not built' : `v${stats.latestCardVersion}`,
                  to: base ? `${base}/qualification` : null,
                  icon: 'badge',
                  tone: stats.latestCardVersion === null ? '#9ca3af' : '#0a56c7',
              },
              {
                  label: 'Qualifications',
                  value: `${stats.completedQualifications}/${stats.qualifications} completed`,
                  to: base ? `${base}/qualification` : null,
                  icon: 'fact_check',
                  tone: stats.completedQualifications > 0 ? '#16a34a' : '#9ca3af',
              },
              {
                  label: 'Checklists',
                  value: `${stats.checklists} installed · ${stats.checklistQuestions} questions`,
                  to: base ? `${base}/checklists` : null,
                  icon: 'checklist',
                  tone: '#0ea5e9',
              },
              {
                  label: 'Evaluations',
                  value: `${stats.evaluationsDone}/${stats.evaluations} done`,
                  to: base ? `${base}/sandbox` : null,
                  icon: 'science',
                  tone: stats.evaluationsDone > 0 ? '#16a34a' : '#f59e0b',
              },
              {
                  label: 'Key objectives',
                  value: String(stats.keyObjectives),
                  to: base ? `${base}/control-objectives` : null,
                  icon: 'track_changes',
                  tone: '#7c3aed',
              },
          ]
        : [];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Dashboard
                </Typography>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {stats === null && !error && <CircularProgress size={24} />}
            <Grid container spacing={2}>
                {cards.map((card) => (
                    <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
                        <AppCard
                            active
                            header={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            bgcolor: `${card.tone}1f`,
                                            color: card.tone,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon fontSize="small">{card.icon}</Icon>
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {card.label}
                                    </Typography>
                                </Box>
                            }
                            footer={
                                card.to ? (
                                    <Box sx={{ ml: 'auto' }}>
                                        <Button
                                            component={Link}
                                            to={card.to}
                                            size="small"
                                            variant="outlined"
                                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                                        >
                                            Open
                                        </Button>
                                    </Box>
                                ) : undefined
                            }
                        >
                            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                                {card.value}
                            </Typography>
                        </AppCard>
                    </Grid>
                ))}
            </Grid>
            <ResultsSection pid={pid} />
        </Box>
    );
}
