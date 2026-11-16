import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '../context/ProjectContext';
import CatalogueExploreDialog from '../components/CatalogueExploreDialog';
import AppCard from '../components/AppCard';
import SideDrawer from '../components/SideDrawer';
import { useCatalogue, useInstalledChecklists } from '../lib/cache';
import '../styles/common.css';
import {
    ChecklistDetail,
    ChecklistQuestion,
    ChecklistSubmission,
    InstalledChecklist,
    checklistChips,
    checklistChipColor,
    closeSubmission,
    createSubmission,
    getChecklist,
    getSubmission,
    listSubmissions,
    reinstallChecklist,
    reopenSubmission,
    saveSubmissionAnswers,
    uninstallChecklist,
} from '../lib/checklists';

const SCORE_LABELS: Record<number, string> = {
    1: 'Not started',
    2: 'Incomplete',
    3: 'Partially implemented',
    4: 'Substantially implemented',
    5: 'Optimized',
};

function groupByCategory(questions: ChecklistQuestion[]): Map<string, ChecklistQuestion[]> {
    const groups = new Map<string, ChecklistQuestion[]>();
    for (const q of questions) {
        const key = q.category || 'General';
        groups.set(key, [...(groups.get(key) ?? []), q]);
    }
    return groups;
}

export default function ChecklistsPage() {
    const { projectUUID: pid } = useProject();
    const queryClient = useQueryClient();
    const [exploreOpen, setExploreOpen] = useState(false);
    const [detail, setDetail] = useState<ChecklistDetail | null>(null);
    const [submissions, setSubmissions] = useState<ChecklistSubmission[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [answerMode, setAnswerMode] = useState(false);
    const [answersDraft, setAnswersDraft] = useState<Record<string, string>>({});
    const [scoresDraft, setScoresDraft] = useState<Record<string, number | null>>({});
    const [saving, setSaving] = useState(false);
    const [answerError, setAnswerError] = useState<string | null>(null);
    const [submissionVersionSel, setSubmissionVersionSel] = useState<string | null>(null);
    /** last submission version picked in the drawer, per checklist, driving the card chip */
    const [pickedVersion, setPickedVersion] = useState<Record<string, number>>({});
    const { catalogue, loading: catalogueLoading } = useCatalogue();
    const installed = useInstalledChecklists(pid);
    const library = installed.library;

    const refresh = useCallback(async () => {
        if (!pid) return;
        await queryClient.invalidateQueries({ queryKey: ['checklists', pid] });
    }, [queryClient, pid]);

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open checklists.</Typography>;
    }

    const run = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key);
        setError(null);
        try {
            await fn();
            await refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(null);
        }
    };

    const openDetail = async (checklist: InstalledChecklist) => {
        try {
            const [full, subs] = await Promise.all([
                getChecklist(pid, checklist.pid),
                listSubmissions(pid, checklist.pid),
            ]);
            setDetail(full);
            setSubmissions(subs);
            setAnswerMode(false);
            setAnswerError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load checklist');
        }
    };

    const answerChecklist = async (checklist: InstalledChecklist) => {
        try {
            const [subs, full] = await Promise.all([
                listSubmissions(pid, checklist.pid),
                getChecklist(pid, checklist.pid),
            ]);
            setDetail(full);
            setSubmissions(subs);
            setAnswerError(null);
            setAnswerMode(true);
            // Reopen on the submission version last picked in the drawer,
            // falling back to the active draft, then the latest submitted
            // version: a reopened drawer shows that version's answers, not a
            // fresh blank form.
            const remembered = subs.find((s) => s.pid === submissionVersionSel) ?? null;
            const active = subs.find((s) => s.status?.toLowerCase() === 'draft') ?? null;
            const latest = [...subs].sort((a, b) => b.version - a.version)[0] ?? null;
            await showSubmissionVersion(
                remembered?.pid ?? active?.pid ?? latest?.pid,
                full.questions,
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load checklist');
        }
    };

    const showSubmissionVersion = async (
        submissionPid: string | undefined,
        questions: ChecklistQuestion[],
    ) => {
        const draft: Record<string, string> = {};
        const scores: Record<string, number | null> = {};
        for (const q of questions) {
            draft[String(q.order)] = '';
            scores[String(q.order)] = null;
        }
        setSubmissionVersionSel(submissionPid ?? null);
        setAnswerError(null);
        if (!submissionPid) {
            setAnswersDraft(draft);
            setScoresDraft(scores);
            return;
        }
        try {
            const saved = await getSubmission(pid, submissionPid);
            for (const a of saved.answers) {
                draft[String(a.question_order)] = a.answer;
                scores[String(a.question_order)] = a.score;
            }
            setPickedVersion((prev) => ({ ...prev, [saved.checklist_pid]: saved.version }));
        } catch (e) {
            setAnswerError(e instanceof Error ? e.message : 'failed to load this version');
        }
        setAnswersDraft(draft);
        setScoresDraft(scores);
    };

    const saveAnswers = async () => {
        if (!detail) return;
        setSaving(true);
        setAnswerError(null);
        try {
            const entries = detail.questions.flatMap((q) => {
                const answer = (answersDraft[String(q.order)] ?? '').trim();
                const score = scoresDraft[String(q.order)] ?? null;
                if (!answer && score === null) return [];
                return [{ question_order: q.order, answer, score }];
            });
            if (entries.length === 0) {
                setAnswerError('nothing to save: fill in at least one answer or score');
                return;
            }
            const subs = await listSubmissions(pid, detail.pid);
            const draft = subs.find((s) => s.status?.toLowerCase() === 'draft') ?? null;
            const latest = [...subs].sort((a, b) => b.version - a.version)[0] ?? null;
            const selected = subs.find((s) => s.pid === submissionVersionSel) ?? null;
            let target: ChecklistSubmission | null = draft;
            if (selected && selected.status?.toLowerCase() !== 'draft') {
                if (draft) {
                    throw new Error('An open draft exists. Close it before saving a new version.');
                }
                if (latest) {
                    await reopenSubmission(pid, latest.pid);
                    const after = await listSubmissions(pid, detail.pid);
                    target = after.find((s) => s.status?.toLowerCase() === 'draft') ?? null;
                }
            } else if (!target && latest) {
                await reopenSubmission(pid, latest.pid);
                const after = await listSubmissions(pid, detail.pid);
                target = after.find((s) => s.status?.toLowerCase() === 'draft') ?? null;
            }
            if (!target) target = await createSubmission(pid, detail.pid, '');
            const saved = target;
            await saveSubmissionAnswers(pid, saved.pid, entries);
            setSubmissionVersionSel(saved.pid);
            setSubmissions(await listSubmissions(pid, detail.pid));
            // Refresh the installed-library summary so the card chips (versions,
            // status, readiness) reflect the saved submission without a reload.
            await refresh();
            toast.success('Answers saved.', { position: 'bottom-right' });
        } catch (e) {
            setAnswerError(e instanceof Error ? e.message : 'failed to save answers');
        } finally {
            setSaving(false);
        }
    };

    const closeDraft = async () => {
        if (!detail) return;
        const draft = submissions.find((s) => s.status?.toLowerCase() === 'draft') ?? null;
        if (!draft) return;
        setSaving(true);
        try {
            await closeSubmission(pid, draft.pid);
            setSubmissions(await listSubmissions(pid, detail.pid));
            await refresh();
            toast.success('Submission version closed.', { position: 'bottom-right' });
        } catch (e) {
            setAnswerError(e instanceof Error ? e.message : 'failed to close submission');
        } finally {
            setSaving(false);
        }
    };

    const uninstallChecklistByCatalogue = async (catalogueId: string) => {
        const target = (library ?? []).find(
            (cl) => cl.template?.catalogue_id === catalogueId,
        );
        if (!target) return;
        await uninstallChecklist(pid, target.pid);
        await refresh();
    };

    const loading = library === null;

    const displayError =
        error ??
        (installed.error
            ? installed.error instanceof Error
                ? installed.error.message
                : String(installed.error)
            : null);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <Box className="page-header">
                <Typography variant="h4" className="page-header-title">
                    Checklists
                </Typography>
                <Button
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon>storefront</Icon>}
                    onClick={() => setExploreOpen(true)}
                    sx={{ textTransform: 'none' }}
                >
                    Explore catalogue
                </Button>
            </Box>

            {displayError && <Typography color="error">{displayError}</Typography>}
            {loading && <CircularProgress size={24} />}

            {!loading && (library ?? []).length === 0 && (
                <Typography color="text.secondary">
                    No checklists installed. Explore the catalogue to add one.
                </Typography>
            )}

            {!loading && (library ?? []).length > 0 && (
                <Grid container spacing={2} className="plugins-grid">
                    {(library ?? []).map((cl) => (
                        <Grid key={cl.pid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                                <AppCard
                                    active
                                    onClick={() => void answerChecklist(cl)}
                                    header={
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                            <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1, minWidth: 0 }}>
                                                {cl.template?.title ?? 'Checklist'}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                                                <Tooltip title="View checklist">
                                                    <IconButton size="small" aria-label={`View ${cl.template?.title ?? 'checklist'}`} onClick={() => void openDetail(cl)}>
                                                        <Icon fontSize="small">visibility</Icon>
                                                    </IconButton>
                                                </Tooltip>
                                                {cl.template && (
                                                <Tooltip title="Update checklist">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Update ${cl.template?.title ?? 'checklist'}`}
                                                            disabled={busy !== null}
                                                            onClick={() =>
                                                                run(`update-${cl.pid}`, async () =>
                                                                    reinstallChecklist(pid, cl.template!.catalogue_id),
                                                                )
                                                            }
                                                        >
                                                            <Icon fontSize="small">refresh</Icon>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Remove checklist">
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Remove ${cl.template?.title ?? 'checklist'}`}
                                                        color="error"
                                                        disabled={busy !== null}
                                                        onClick={() => {
                                                            if (detail?.pid === cl.pid) setDetail(null);
                                                            void run(`remove-${cl.pid}`, async () => {
                                                                await uninstallChecklist(pid, cl.pid);
                                                                await refresh();  // drop it from the installed set so the catalogue no longer highlights it
                                                            });
                                                        }}
                                                    >
                                                        <Icon fontSize="small">delete</Icon>
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    }
                                    footer={
                                    <>
                                        {checklistChips(cl).map((chip) => {
                                            const picked = pickedVersion[cl.pid];
                                            const label =
                                                picked != null && /^v\d+$/.test(chip)
                                                    ? `v${picked}`
                                                    : chip;
                                            return (
                                                <Chip
                                                    key={label}
                                                    label={label}
                                                    size="small"
                                                    variant="outlined"
                                                    color={checklistChipColor(label)}
                                                />
                                            );
                                        })}
                                    </>
                                    }
                                />
                        </Grid>
                    ))}
                </Grid>
            )}

            <CatalogueExploreDialog
                open={exploreOpen}
                onClose={() => setExploreOpen(false)}
                projectPid={pid}
                kind="control"
                catalogue={catalogue}
                loading={catalogueLoading}
                installedKeys={
                    new Set(
                        (library ?? [])
                            .map((cl) => cl.template?.catalogue_id)
                            .filter((x): x is string => Boolean(x)),
                    )
                }
                onInstalled={() => {
                    void refresh();
                }}
                onUninstall={(id) => uninstallChecklistByCatalogue(String(id))}
            />

            <SideDrawer
                open={detail !== null}
                onClose={() => {
                    setDetail(null);
                    setAnswerMode(false);
                    setAnswerError(null);
                }}
                title={detail?.template?.title ?? 'Checklist'}
                mode={answerMode ? 'edit' : 'view'}
                versions={submissions.map((s) => ({
                    id: s.pid,
                    label: `v${s.version}`,
                }))}
                selectedVersionId={submissionVersionSel ?? undefined}
                onSelectVersion={(v) => void showSubmissionVersion(v.id, detail?.questions ?? [])}
                onPreviewVersion={(v) => void showSubmissionVersion(v.id, detail?.questions ?? [])}
                onSave={() => void saveAnswers()}
                onCancel={() => setAnswerMode(false)}
                footerActions={
                    answerMode ? (
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={
                                saving ||
                                !submissions.some((s) => s.status?.toLowerCase() === 'draft')
                            }
                            onClick={() => void closeDraft()}
                        >
                            Close version
                        </Button>
                    ) : undefined
                }
                headerAction={
                    detail ? (
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {(() => {
                                const shown = submissions.find((s) => s.pid === submissionVersionSel);
                                if (!shown) return null;
                                return (
                                    <Chip
                                        label={`v${shown.version} · ${shown.status}`}
                                        size="small"
                                        variant="outlined"
                                        color={shown.status?.toLowerCase() === 'draft' ? 'warning' : 'success'}
                                    />
                                );
                            })()}
                            {!answerMode && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    className="gradient-btn"
                                    startIcon={<Icon fontSize="small">question_answer</Icon>}
                                    onClick={() => setAnswerMode(true)}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Answer
                                </Button>
                            )}
                        </Box>
                    ) : undefined
                }
            >
                {detail && answerMode ? (
                    <>
                        {Array.from(groupByCategory(detail.questions).entries()).map(
                            ([category, questions]) => (
                                <Box key={category} sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">
                                        {category}
                                    </Typography>
                                    {questions.map((q) => (
                                        <Box key={q.order} sx={{ mb: 2 }}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {q.order}. {q.text}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {[q.article, q.category].filter(Boolean).join(' · ')}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 1,
                                                    mt: 0.5,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ minWidth: 80 }}
                                                    >
                                                        Readiness
                                                    </Typography>
                                                    <TextField
                                                        select
                                                        size="small"
                                                        value={String(scoresDraft[String(q.order)] ?? '')}
                                                        onChange={(e) =>
                                                            setScoresDraft((prev) => ({
                                                                ...prev,
                                                                [String(q.order)]:
                                                                    e.target.value === ''
                                                                        ? null
                                                                        : Number(e.target.value),
                                                            }))
                                                        }
                                                        inputProps={{ 'aria-label': `Score ${q.order}` }}
                                                        sx={{ minWidth: 200 }}
                                                    >
                                                        <MenuItem value="">No score</MenuItem>
                                                        {[1, 2, 3, 4, 5].map((n) => (
                                                            <MenuItem key={n} value={n}>
                                                                {n} — {SCORE_LABELS[n]}
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                </Box>
                                                <TextField
                                                    multiline
                                                    minRows={1}
                                                    size="small"
                                                    fullWidth
                                                    value={answersDraft[String(q.order)] ?? ''}
                                                    onChange={(e) =>
                                                        setAnswersDraft((prev) => ({
                                                            ...prev,
                                                            [String(q.order)]: e.target.value,
                                                        }))
                                                    }
                                                    inputProps={{ 'aria-label': `Question ${q.order}` }}
                                                    sx={{ flex: 1, minWidth: 220 }}
                                                />
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            ),
                        )}
                        {answerError && <Typography color="error">{answerError}</Typography>}
                        {saving && <CircularProgress size={20} sx={{ mt: 1 }} />}
                    </>
                ) : (
                    <>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Questions ({detail?.questions.length ?? 0})
                        </Typography>
                        {detail?.questions.map((q) => (
                            <Box key={q.order} sx={{ mb: 1.5 }}>
                                <Typography variant="body2">
                                    {q.order}. {q.text}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {[q.article, q.category].filter(Boolean).join(' · ')}
                                </Typography>
                            </Box>
                        ))}
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                            Submissions ({submissions.length})
                        </Typography>
                        {submissions.length === 0 && (
                            <Typography color="text.secondary" variant="body2">
                                No submissions yet.
                            </Typography>
                        )}
                        {submissions.map((s) => (
                            <Box key={s.pid} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                    v{s.version}
                                </Typography>
                                <Chip label={s.status} size="small" />
                                {s.readiness !== null && s.readiness !== undefined && (
                                    <Chip label={`${s.readiness}% ready`} size="small" variant="outlined" />
                                )}
                            </Box>
                        ))}
                    </>
                )}
            </SideDrawer>
        </Box>
    );
}
