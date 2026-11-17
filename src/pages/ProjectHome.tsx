import { Typography, Box, Button, Icon, CircularProgress } from "@mui/material";
import AppCard from "../components/AppCard";
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useProject } from "../context/ProjectContext";
import { OverviewData, getOverview } from "../lib/overview";
import "../styles/common.css";

interface Section {
    label: string;
    value: string;
    to: string | null;
    icon: string;
    tone: string;
}

/** Project overview (WP8 W7): AI card, qualification, coverage, ratios, sandbox readiness. */
const ProjectHome = () => {
    const { projectUUID: pid, projectName } = useProject();
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!pid) return;
        setError(null);
        try {
            setOverview(await getOverview(pid));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load overview');
        }
    }, [pid]);

    useEffect(() => {
        setOverview(null);
        void refresh();
    }, [refresh]);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open the overview.</Typography>;
    }

    const base = projectName ? `/projects/${projectName}` : null;
    const link = (to: string) => (base ? `${base}/${to}` : null);

    const ai = (overview?.aiCard ?? null) as Record<string, unknown> | null;
    const aiView = (ai?.view ?? {}) as Record<string, unknown>;
    const aiSummary = (aiView.summary ?? {}) as Record<string, unknown>;
    const aiLabel = typeof aiSummary.label === 'string' ? aiSummary.label : null;

    const sections: Section[] = overview
        ? [
              {
                  label: 'AI card',
                  value:
                      overview.latestCardVersion === null
                          ? (aiLabel ?? 'not configured')
                          : `${aiLabel ? `${aiLabel} · ` : ''}v${overview.latestCardVersion} built`,
                  to: link('qualification'),
                  icon: 'badge',
                  tone: overview.latestCardVersion === null ? '#9ca3af' : '#0a56c7',
              },
              {
                  label: 'Qualification',
                  value: overview.qualificationDone ? 'done' : 'not done',
                  to: link('qualification'),
                  icon: 'fact_check',
                  tone: overview.qualificationDone ? '#16a34a' : '#9ca3af',
              },
              {
                  label: 'Control objectives',
                  value: `${overview.objectives.keyCovered}/${overview.objectives.key} key covered · ${overview.objectives.total} objectives`,
                  to: link('control-objectives'),
                  icon: 'track_changes',
                  tone: '#7c3aed',
              },
              {
                  label: 'Checklists',
                  value: `${overview.checklists.configured}/${overview.checklists.installed} configured · ${overview.checklists.questions} questions`,
                  to: link('checklists'),
                  icon: 'checklist',
                  tone: '#0ea5e9',
              },
              {
                  label: 'Plugins',
                  value: `${overview.plugins.configured}/${overview.plugins.enabled} configured`,
                  to: link('plugins'),
                  icon: 'extension',
                  tone: '#f59e0b',
              },
              {
                  label: 'Sandbox',
                  value: overview.sandboxReady ? `ready (${overview.sandboxDetail})` : overview.sandboxDetail,
                  to: link('sandbox'),
                  icon: 'science',
                  tone: overview.sandboxReady ? '#16a34a' : '#9ca3af',
              },
          ]
        : [];

    // The pilot's four-step landing: plan (1-3) then collect evidence (4).
    const steps = base
        ? [
              {
                  n: '1',
                  svc: 'Qualification',
                  title: 'Qualify the AI system',
                  body: 'Describe the system, its components and its risks in a versioned AI card.',
                  to: `${base}/qualification`,
              },
              {
                  n: '2',
                  svc: 'Control objectives',
                  title: 'Set control objectives',
                  body: "Rate the system's risks and link them to the control objectives it must meet.",
                  to: `${base}/control-objectives`,
              },
              {
                  n: '3',
                  svc: 'Catalogue',
                  title: 'Choose tests and checklists',
                  body: 'Pick tests and checklists, and install them in one click.',
                  to: `${base}/plugins`,
              },
              {
                  n: '4',
                  svc: 'Evidence',
                  title: 'Collect evidence',
                  body: 'Answer the checklists, run the tests, see the results and compose the report, in one place.',
                  to: `${base}/sandbox`,
              },
          ]
        : [];

    return (
        <Box>
            <Box className="page-header" sx={{ mb: 3 }}>
                <Typography variant="h4" className="page-header-title">
                    Overview
                </Typography>
            </Box>
            <Box className="brand-block">
                <Typography variant="h5" className="brand-block-title">
                    Plan the assessment
                </Typography>
                <Box className="brand-steps">
                    {steps.map((s) => (
                        <Box key={s.n} component={Link} to={s.to} className="brand-step">
                            <span className="brand-mono brand-step-svc">{s.svc}</span>
                            <Typography variant="h6" className="brand-step-title">
                                {s.n}. {s.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {s.body}
                            </Typography>
                            <span className="brand-step-open">Open →</span>
                        </Box>
                    ))}
                </Box>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {overview === null && !error && <CircularProgress />}
            <Grid container spacing={2}>
                {sections.map((section) => (
                    <Grid key={section.label} size={{ xs: 12, sm: 6, md: 4 }}>
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
                                            bgcolor: `${section.tone}1f`,
                                            color: section.tone,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon fontSize="small">{section.icon}</Icon>
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
                                        {section.label}
                                    </Typography>
                                </Box>
                            }
                            footer={
                                section.to ? (
                                    <Box sx={{ ml: 'auto' }}>
                                        <Button
                                            component={Link}
                                            to={section.to}
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
                                {section.value}
                            </Typography>
                        </AppCard>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default ProjectHome;
