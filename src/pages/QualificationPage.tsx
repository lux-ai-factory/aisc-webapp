import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Icon from '@mui/material/Icon';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import { useProject } from '../context/ProjectContext';
import SideDrawer from '../components/SideDrawer';
import AppDialog from '../components/AppDialog';
import AppCard from '../components/AppCard';
import SplitPaneDialog, { type SplitPaneItem } from '../components/SplitPaneDialog';
import VersionSelect from '../components/VersionSelect';
import AICardView from '../components/AICardView';
import CardAgentPanel from '../components/CardAgentPanel';
import QualificationPrefill from '../components/QualificationPrefill';
import CardGraph from '../components/CardGraph';
import NodeEditorDialog, { findNodeInView, withStagedChange } from '../components/NodeEditorDialog';
import QuestionnaireBuilderForm, {
    type BuilderQuestion,
} from '../components/QuestionnaireBuilderForm';
import '../styles/common.css';
import {
    Json,
    Qualification,
    Questionnaire,
    QuestionnaireVersion,
    addProjectQuestionnaire,
    answerableQuestions,
    completeQualification,
    reopenQualification,
    DefaultQuestionnaire,
    emptyBlocks,
    emptyRiskRow,
    getDefaultQuestionnaire,
    getSelection,
    listProjectQuestionnaires,
    listQualificationVersions,
    listQualifications,
    listQuestionnaireVersions,
    listQualificationVocabularies,
    mergeBlocksIntoAnswers,
    parseQuestionnaireImport,
    patchQualificationNodes,
    qualificationVersionEntries,
    questionnaireVersionEntries,
    saveDraftQualification,
    selectQuestionnaire,
    splitBlocksFromAnswers,
    updateProjectQuestionnaire,
    type QualificationBlocks,
    type RiskBlockRow,
    hasAnswers,
} from '../lib/qualification';

function toJsonText(value: unknown): string {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

function definitionSummary(definition: Record<string, Json>): string {
    const blocks = definition['blocks'];
    if (Array.isArray(blocks)) return `${blocks.length} blocks`;
    const fields = definition['fields'];
    if (Array.isArray(fields)) return `${fields.length} fields`;
    return `${Object.keys(definition).length} keys`;
}

const PROFILE_FIELDS: Array<{
    key: keyof QualificationBlocks['profile'];
    label: string;
    hint: string;
}> = [
    { key: 'description', label: 'Description', hint: 'What the system is, in one paragraph.' },
    { key: 'targetUseCase', label: 'Target use case', hint: 'What the system is used for.' },
    { key: 'targetUsers', label: 'Target users', hint: 'Who uses the system or is affected by it.' },
    {
        key: 'intendedDeployers',
        label: 'Intended deployers',
        hint: 'Who puts the system into service.',
    },
];

const TAG_FIELDS: Array<{
    key: keyof QualificationBlocks['tags'];
    label: string;
    vocabClass: string;
    hint: string;
}> = [
    { key: 'targetSystem', label: 'Target systems', vocabClass: 'AICapability', hint: 'VAIR terms, comma-separated.' },
    { key: 'sector', label: 'Sectors', vocabClass: 'Domain', hint: 'VAIR terms, comma-separated.' },
    { key: 'marketForm', label: 'Market form', vocabClass: 'Modality', hint: 'VAIR terms, comma-separated.' },
    { key: 'locality', label: 'Localities of use', vocabClass: 'LocalityOfUse', hint: 'VAIR terms, comma-separated.' },
];

/** Detail pane for one questionnaire in the split-pane dialog: read-only
 *  questions of the selected config version. The Select/Edit/Answer actions
 *  live on the dialog footer. */
function QuestionnaireDetail({
    name,
    definition,
    versionPid,
    isBuiltIn,
    isSelected,
    versionNumber,
    onVersionChange,
}: {
    name: string;
    definition: Record<string, Json>;
    versionPid: string | null;
    isBuiltIn: boolean;
    isSelected: boolean;
    versionNumber: number | null;
    onVersionChange: (n: number) => void;
}) {
    const { projectUUID: pid } = useProject();
    const [versions, setVersions] = useState<QuestionnaireVersion[]>([]);

    useEffect(() => {
        let alive = true;
        setVersions([]);
        if (!pid || !versionPid) return;
        listQuestionnaireVersions(pid, versionPid)
            .then((list) => {
                if (alive) setVersions(list);
            })
            .catch(() => {
                if (alive) setVersions([]);
            });
        return () => {
            alive = false;
        };
    }, [pid, versionPid]);

    // The picked config version for this questionnaire (persisted per qid),
    // falling back to the latest revision until one is picked. Being driven by
    // the parent's cardQVersion means it survives closing the dialog.
    const shownVersion =
        versionNumber !== null && versions.some((v) => v.number === versionNumber)
            ? versionNumber
            : versions.length > 0
              ? versions[versions.length - 1].number
              : null;
    const chosenDef =
        versions.find((v) => v.number === shownVersion)?.definition ?? definition;
    const questions = answerableQuestions(chosenDef);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {isSelected ? (
                    <Tooltip title="Selected questionnaire">
                        <CheckCircleIcon sx={{ color: 'success.main' }} />
                    </Tooltip>
                ) : (
                    <CircleOutlinedIcon sx={{ color: 'action.disabled' }} />
                )}
                <Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0 }}>
                    {name}
                </Typography>
                {!isBuiltIn && versions.length > 0 && (
                    <VersionSelect
                        ariaLabel="Questionnaire version"
                        options={versions.map((v) => ({ id: String(v.number), label: `v${v.number}` }))}
                        value={shownVersion !== null ? String(shownVersion) : null}
                        onSelect={(id) => onVersionChange(Number(id))}
                    />
                )}
            </Box>
            <Box
                sx={{
                    borderTop: '1px solid #eef2f7',
                    pt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                }}
            >
                <Typography variant="overline" color="text.secondary">
                    Questions
                </Typography>
                {questions ? (
                    questions.map((q) => (
                        <Box
                            key={q.field}
                            sx={{ p: 1.5, border: '1px solid #eef2f7', borderRadius: 1 }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    {q.text}
                                </Typography>
                                {q.required && (
                                    <Chip label="required" size="small" variant="outlined" />
                                )}
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontFamily: 'monospace' }}
                            >
                                {q.field}
                            </Typography>
                            {q.citation && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {q.citation}
                                </Typography>
                            )}
                        </Box>
                    ))
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        This questionnaire has no parseable questions (JSON definition).
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export default function QualificationPage() {
    const { projectUUID: pid } = useProject();
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[] | null>(null);
    const [builtIn, setBuiltIn] = useState<DefaultQuestionnaire | null>(null);
    const [selection, setSelection] = useState<string | null>(null);
    const [qualifications, setQualifications] = useState<Qualification[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const [answerQ, setAnswerQ] = useState<{
        qid: string;
        name: string;
        definition: Record<string, Json>;
        versionPid: string | null;
    } | null>(null);
    const [fieldAnswers, setFieldAnswers] = useState<Record<string, string>>({});
    const [answerVersions, setAnswerVersions] = useState<QuestionnaireVersion[]>([]);
    const [answersText, setAnswersText] = useState('{}');
    const [savedDraft, setSavedDraft] = useState<Qualification | null>(null);
    const [answerError, setAnswerError] = useState<string | null>(null);
    const [blockState, setBlockState] = useState<QualificationBlocks>(() => emptyBlocks());
    const [patchState, setPatchState] = useState<Record<string, Json>>({});
    const [prefillOpen, setPrefillOpen] = useState(false);
    const [vocab, setVocab] = useState<Record<string, string[]>>({});

    const [editQ, setEditQ] = useState<Questionnaire | null>(null);
    const [editMode, setEditMode] = useState<'builder' | 'json'>('builder');
    const [editBlocks, setEditBlocks] = useState<string[]>([]);
    const [editQuestions, setEditQuestions] = useState<BuilderQuestion[]>([]);
    const [definitionText, setDefinitionText] = useState('{}');
    const [editError, setEditError] = useState<string | null>(null);
    const [editVersions, setEditVersions] = useState<QuestionnaireVersion[]>([]);
    const [editVersionSel, setEditVersionSel] = useState<string | null>(null);
    const [cardQVersion, setCardQVersion] = useState<Record<string, number>>(() => {
        // Per-questionnaire version picks must survive closing the dialog or
        // leaving the page; keep them per project so they don't leak across
        // projects (questionnaire pids like the built-in default are global).
        try {
            const saved = localStorage.getItem(`cardQVersion:${pid}`);
            return saved ? (JSON.parse(saved) as Record<string, number>) : {};
        } catch {
            return {};
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(`cardQVersion:${pid}`, JSON.stringify(cardQVersion));
        } catch {
            // Storage unavailable: the in-memory pick still works this session.
        }
    }, [cardQVersion, pid]);

    // Last-shown AI-card graph version per questionnaire (qualification pid),
    // persisted exactly like cardQVersion so a reopened graph shows the version
    // the user last browsed, not the latest card.
    const [rememberedCardPid, setRememberedCardPid] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem(`cardGraphVersion:${pid}`);
            return saved ? (JSON.parse(saved) as Record<string, string>) : {};
        } catch {
            return {};
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(`cardGraphVersion:${pid}`, JSON.stringify(rememberedCardPid));
        } catch {
            // Storage unavailable: the in-memory pick still works this session.
        }
    }, [rememberedCardPid, pid]);

    const [cardPid, setCardPid] = useState<string | null>(null);
    const [cardChain, setCardChain] = useState<Qualification[]>([]);
    const [selectedCardPid, setSelectedCardPid] = useState<string | null>(null);
    const [fullScreenCard, setFullScreenCard] = useState<Qualification | null>(null);
    const [fullScreenEditingId, setFullScreenEditingId] = useState<string | null>(null);
    const [stagedNodes, setStagedNodes] = useState<Record<string, Record<string, Record<string, Json>>>>({});
    const [fullScreenError, setFullScreenError] = useState<string | null>(null);
    const [answerVersionSel, setAnswerVersionSel] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);

    const exportCardJson = () => {
        const withCard = [...(qualifications ?? [])].filter(
            (q) => q.status === 'completed' && q.system_card,
        );
        const latest = [...withCard].sort(
            (a, b) => (b.system_version?.number ?? 0) - (a.system_version?.number ?? 0),
        )[0] ?? null;
        if (!latest) return;
        const blob = new Blob([toJsonText(latest.system_card)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-card.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const answerFileRef = useRef<HTMLInputElement>(null);
    const addFileRef = useRef<HTMLInputElement>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [qpaneOpen, setQPaneOpen] = useState(false);
    const [qPaneSel, setQPaneSel] = useState<string | null>(null);
    const [addName, setAddName] = useState('');
    const [addMode, setAddMode] = useState<'builder' | 'json'>('builder');
    const [addBlocks, setAddBlocks] = useState<string[]>([]);
    const [addQuestions, setAddQuestions] = useState<
        Array<{ field: string; text: string; citation: string; required: boolean }>
    >([]);
    const [addDefinition, setAddDefinition] = useState('{\n  "blocks": []\n}');
    const [addError, setAddError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!pid) return;
        setError(null);
        try {
            const [qs, sel, quals] = await Promise.all([
                listProjectQuestionnaires(pid),
                getSelection(pid),
                listQualifications(pid),
            ]);
            setQuestionnaires(qs);
            setSelection(sel.questionnaire_id);
            setQualifications(quals);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to load qualification');
        }
        try {
            setBuiltIn(await getDefaultQuestionnaire());
        } catch {
            setBuiltIn(null);
        }
    }, [pid]);

    useEffect(() => {
        setQuestionnaires(null);
        setQualifications(null);
        void refresh();
    }, [refresh]);

    // A card correction stores a NEW version: show it at once and remember it as
    // the card this questionnaire's graph is looking at.
    const onCardCorrected = (updated: Qualification) => {
        setQualifications((prev) => {
            const list = prev ?? [];
            return list.some((q) => q.pid === updated.pid) ? list : [...list, updated];
        });
        if (updated.questionnaire_id) {
            setRememberedCardPid((prev) => ({ ...prev, [updated.questionnaire_id]: updated.pid }));
        }
    };

    if (!pid) {
        return <Typography color="text.secondary">Select a project to open qualification.</Typography>;
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

    const openAnswer = async (target: {
        qid: string;
        name: string;
        definition: Record<string, Json>;
        versionPid: string | null;
    }) => {
        setAnswerQ(target);
        setAnswerError(null);
        setAnswerVersionSel(null);
        setAnswersText('{}');
        setFieldAnswers({});
        setBlockState(emptyBlocks());
        setPatchState({});
        setVocab({});
        if (!pid) {
            setAnswerVersions([]);
            return;
        }
        void listQualificationVocabularies(pid)
            .then(setVocab)
            .catch(() => setVocab({}));
        let list: QuestionnaireVersion[] = [];
        const copyOfBuiltIn = target.versionPid
            ? null
            : (questionnaires ?? []).find((x) => x.name === target.name);
        const versionSource = target.versionPid ?? copyOfBuiltIn?.pid;
        if (versionSource) {
            try {
                list = await listQuestionnaireVersions(pid, versionSource);
            } catch {
                list = [];
            }
        }
        // Answers are only ever tied to a questionnaire version, so the drawer
        // must always have at least one: the questionnaire's first revision.
        if (list.length === 0) {
            list = [
                {
                    pid: `${target.qid}:v1`,
                    questionnaire_id: target.qid,
                    number: 1,
                    definition: target.definition,
                    created_at: '',
                    created_by: '',
                },
            ];
        }
        setAnswerVersions(list);
        const latestN = list.length > 0 ? Math.max(...list.map((v) => v.number)) : null;
        // Reopen on the config revision last picked in the drawer (cardQVersion),
        // falling back to the latest revision. Show THAT revision's questionnaire,
        // not the head, so a reopened drawer matches the version dropdown.
        const lastPicked = cardQVersion[target.qid];
        const pickedN = list.some((v) => v.number === lastPicked) ? lastPicked : latestN;
        const pickedDef = list.find((v) => v.number === pickedN)?.definition ?? target.definition;
        // Persist the opened revision per questionnaire so each answer session
        // resumes its own config version (not a global one).
        setCardQVersion((prev) => (pickedN === null ? prev : { ...prev, [target.qid]: pickedN }));
        setAnswerQ({ ...target, definition: pickedDef });
        applyAnswerSet(target.qid, pickedDef, pickedN);
    };

    const saveAnswers = async () => {
        if (!answerQ) return;
        const fields = answerableQuestions(answerQ.definition);
        let answers: Record<string, Json>;
        if (fields) {
            answers = {};
            for (const q of fields) {
                const value = (fieldAnswers[q.field] ?? '').trim();
                if (value) answers[q.field] = value;
            }
        } else {
            try {
                answers = JSON.parse(answersText) as Record<string, Json>;
            } catch {
                setAnswerError('answers are not valid JSON');
                return;
            }
        }
        const payload = withPatch(mergeBlocksIntoAnswers(answers, blockState));
        if (!hasAnswers(payload)) {
            setAnswerError('nothing to save: fill in at least one answer');
            return;
        }
        setAnswerError(null);
        await run(`save-${answerQ.qid}`, async () => {
            const draft = await saveDraftQualification(pid, {
                questionnaire_id: answerQ.qid,
                name: answerQ.name,
                answers: payload,
                questionnaire_version: answerVersionSel === null ? null : Number(answerVersionSel),
            });
            setSavedDraft(draft);
        });
    };

    const completeDraft = (qid: string) =>
        run(`complete-${qid}`, async () => {
            const completed = await completeQualification(pid, qid);
            setSavedDraft(completed);
        });

    const reopenAnswer = (qid: string) =>
        run(`reopen-${qid}`, async () => {
            const reopened = await reopenQualification(pid, qid);
            setSavedDraft(reopened);
            setAnswerQ((prev) => (prev ? { ...prev } : prev));
        });

    const setProfileField = (key: keyof QualificationBlocks['profile'], value: string) =>
        setBlockState((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));

    const setTagField = (key: keyof QualificationBlocks['tags'], text: string) =>
        setBlockState((prev) => ({
            ...prev,
            tags: {
                ...prev.tags,
                [key]: text
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0),
            },
        }));

    const setRiskRow = (index: number, patch: Partial<RiskBlockRow>) =>
        setBlockState((prev) => ({
            ...prev,
            risks: prev.risks.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        }));

    const addRiskRow = () =>
        setBlockState((prev) => ({ ...prev, risks: [...prev.risks, emptyRiskRow()] }));

    const removeRiskRow = (index: number) =>
        setBlockState((prev) => ({ ...prev, risks: prev.risks.filter((_, i) => i !== index) }));

    const withPatch = (answers: Record<string, Json>): Record<string, Json> =>
        Object.keys(patchState).length > 0 ? { ...answers, __patch: patchState } : answers;

    const exportAnswers = () => {
        if (!answerQ) return;
        const fields = answerableQuestions(answerQ.definition);
        let answers: Record<string, Json>;
        if (fields) {
            answers = {};
            for (const q of fields) {
                const value = (fieldAnswers[q.field] ?? '').trim();
                if (value) answers[q.field] = value;
            }
        } else {
            try {
                answers = JSON.parse(answersText) as Record<string, Json>;
            } catch {
                setAnswerError('answers are not valid JSON');
                return;
            }
        }
        const payload = withPatch(mergeBlocksIntoAnswers(answers, blockState));
        const blob = new Blob(
            [JSON.stringify({ questionnaire_id: answerQ.qid, name: answerQ.name, answers: payload }, null, 2)],
            { type: 'application/json' },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `answers-${answerQ.qid}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const importAnswers = async (file: File) => {
        if (!answerQ) return;
        let raw: unknown;
        try {
            raw = JSON.parse(await file.text());
        } catch {
            setAnswerError('that file is not valid JSON');
            return;
        }
        const record =
            typeof raw === 'object' && raw !== null && !Array.isArray(raw)
                ? (raw as Record<string, unknown>)
                : null;
        if (!record) {
            setAnswerError('that file is not an answers file');
            return;
        }
        const inner = record['answers'];
        const answers =
            typeof inner === 'object' && inner !== null && !Array.isArray(inner)
                ? (inner as Record<string, unknown>)
                : record;
        setAnswerError(null);
        const { answers: prose, blocks: importedBlocks } = splitBlocksFromAnswers(
            answers as Record<string, Json>,
        );
        setBlockState(importedBlocks);
        const rawPatch = prose['__patch'];
        if (rawPatch && typeof rawPatch === 'object' && !Array.isArray(rawPatch)) {
            setPatchState(rawPatch as Record<string, Json>);
        } else {
            setPatchState({});
        }
        delete prose['__patch'];
        const fields = answerableQuestions(answerQ.definition);
        if (fields) {
            const next: Record<string, string> = {};
            for (const q of fields) {
                const value = prose[q.field];
                if (typeof value === 'string') next[q.field] = value;
                else if (typeof value === 'number' || typeof value === 'boolean') {
                    next[q.field] = String(value);
                } else if (value !== undefined && value !== null) {
                    next[q.field] = JSON.stringify(value);
                }
            }
            setFieldAnswers(next);
        } else {
            setAnswersText(JSON.stringify(prose, null, 2));
        }
    };

    const openCard = async (qid: string) => {
        setCardPid(qid);
        setCardError(null);
        if (pid) {
            void listQualificationVocabularies(pid)
                .then(setVocab)
                .catch(() => setVocab({}));
        }
        try {
            const full = await listQualificationVersions(pid, qid);
            const anchor = full.find((x) => x.pid === qid);
            const chain = full.filter(
                (x) =>
                    anchor !== undefined &&
                    x.questionnaire_id === anchor.questionnaire_id &&
                    x.status === 'completed' &&
                    x.system_card !== null,
            );
            setCardChain(chain);
            // Reopen the graph on the card version last browsed for this
            // questionnaire, falling back to the requested pid, then the latest.
            const qQuestionId = anchor?.questionnaire_id ?? null;
            const remembered = qQuestionId ? rememberedCardPid[qQuestionId] : undefined;
            const chosen =
                (remembered ? chain.find((x) => x.pid === remembered) : undefined) ??
                chain.find((x) => x.pid === qid) ??
                chain[chain.length - 1] ??
                null;
            setSelectedCardPid(chosen ? chosen.pid : null);
        } catch (e) {
            setCardChain([]);
            setCardError(e instanceof Error ? e.message : 'failed to load versions');
        }
    };

    const rememberCardVersion = (qualificationPid: string | undefined) => {
        const questionnaireId = cardChain[0]?.questionnaire_id;
        if (qualificationPid && questionnaireId) {
            setRememberedCardPid((prev) => ({ ...prev, [questionnaireId]: qualificationPid }));
        }
    };

    const stageNodeEdit = (qid: string, nodeId: string, change: Record<string, Json>) => {
        setStagedNodes((prev) => {
            const forCard = prev[qid] ?? {};
            return { ...prev, [qid]: { ...forCard, [nodeId]: { ...(forCard[nodeId] ?? {}), ...change } } };
        });
        setCardError(null);
    };

    const discardStagedNodes = (qid: string) =>
        setStagedNodes((prev) => {
            const next = { ...prev };
            delete next[qid];
            return next;
        });

    const saveFullScreenPatch = (nodeId: string, change: Record<string, Json>) => {
        if (!fullScreenCard) return;
        stageNodeEdit(fullScreenCard.pid, nodeId, change);
        setFullScreenEditingId(null);
    };

    const saveStagedNodes = async (qid: string): Promise<Qualification | undefined> => {
        const staged = stagedNodes[qid];
        if (!qid || !staged || Object.keys(staged).length === 0) return undefined;
        setCardError(null);
        setBusy(`save-nodes-${qid}`);
        try {
            const edited = await patchQualificationNodes(pid, qid, staged);
            const chain = await listQualificationVersions(pid, edited.pid);
            setCardChain(chain);
            setSelectedCardPid(edited.pid);
            discardStagedNodes(qid);
            if (fullScreenCard?.pid === qid) setFullScreenCard(edited);
            await refresh();
            return edited;
        } catch (e) {
            setCardError(e instanceof Error ? e.message : 'request failed');
            return undefined;
        } finally {
            setBusy(null);
        }
    };

    const findAnswerSet = (qid: string, n: number | null): Qualification | null =>
        n === null
            ? null
            : ((qualifications ?? []).find(
                  (q) => q.questionnaire_id === qid && q.questionnaire_version === n,
              ) ?? null);

    const applyAnswerSet = (qid: string, definition: Record<string, Json>, n: number | null) => {
        const set = findAnswerSet(qid, n);
        setAnswerVersionSel(n === null ? null : String(n));
        setSavedDraft(set);
        setAnswerError(null);
        const fields = answerableQuestions(definition);
        if (!set) {
            setFieldAnswers({});
            setAnswersText('{}');
            setBlockState(emptyBlocks());
            setPatchState({});
            return;
        }
        if (fields) {
            const next: Record<string, string> = {};
            for (const f of fields) {
                const value = set.answers[f.field];
                if (typeof value === 'string') next[f.field] = value;
                else if (typeof value === 'number' || typeof value === 'boolean') {
                    next[f.field] = String(value);
                } else if (value !== undefined && value !== null) {
                    next[f.field] = JSON.stringify(value);
                }
            }
            setFieldAnswers(next);
        } else {
            setAnswersText(JSON.stringify(set.answers ?? {}, null, 2));
        }
        const { answers: prose, blocks } = splitBlocksFromAnswers(
            (set.answers ?? {}) as Record<string, Json>,
        );
        setBlockState(blocks);
        const rawPatch = prose['__patch'];
        if (rawPatch && typeof rawPatch === 'object' && !Array.isArray(rawPatch)) {
            setPatchState(rawPatch as Record<string, Json>);
        } else {
            setPatchState({});
        }
    };

    const navigateAnswerVersion = (v: { id?: string }) => {
        if (!answerQ) return;
        const n = v.id && v.id !== 'current' ? Number(v.id) : null;
        const defVersion = n === null ? undefined : answerVersions.find((x) => x.number === n);
        if (defVersion) {
            setAnswerQ({ ...answerQ, definition: defVersion.definition });
            // `defVersion` is only found for a real revision number, so n is non-null here.
            setCardQVersion((prev) => ({ ...prev, [answerQ.qid]: n! }));
        }
        applyAnswerSet(answerQ.qid, defVersion?.definition ?? answerQ.definition, n);
    };

    const openAdd = () => {
        setAddName('');
        setAddMode('builder');
        setAddBlocks([]);
        setAddQuestions([]);
        setAddDefinition('{\n  "blocks": []\n}');
        setAddError(null);
        setAddOpen(true);
    };

    const onImportIntoAdd = async (file: File) => {
        try {
            const parsed = parseQuestionnaireImport(await file.text());
            setAddName(parsed.name);
            const blocks = parsed.definition['blocks'];
            const questions = parsed.definition['questions'];
            if (
                Array.isArray(blocks) &&
                blocks.every((b) => typeof b === 'string') &&
                Array.isArray(questions)
            ) {
                setAddBlocks(blocks.filter((b): b is string => typeof b === 'string'));
                setAddQuestions(
                    questions.map((q) => {
                        const record = (q ?? {}) as Record<string, Json>;
                        return {
                            field: typeof record['field'] === 'string' ? record['field'] : '',
                            text: typeof record['text'] === 'string' ? record['text'] : '',
                            citation:
                                typeof record['citation'] === 'string' ? record['citation'] : '',
                            required: record['required'] === true,
                        };
                    }),
                );
                setAddMode('builder');
            } else {
                setAddMode('json');
                setAddDefinition(JSON.stringify(parsed.definition, null, 2));
            }
            setAddError(null);
        } catch {
            setAddError('could not import that file as a questionnaire');
        }
    };

    const builderDefinition = (): Record<string, Json> => ({
        blocks: addBlocks,
        questions: addQuestions.map((q) => ({
            field: q.field,
            text: q.text,
            citation: q.citation,
            required: q.required,
        })),
    });

    const saveAdd = async () => {
        if (!addName.trim()) {
            setAddError('name is required');
            return;
        }
        if (
            addMode === 'builder' &&
            addQuestions.some((q) => !q.text.trim() || !q.field.trim())
        ) {
            setAddError('every question needs text and a field key');
            return;
        }
        let definition: Record<string, Json>;
        if (addMode === 'builder') {
            definition = builderDefinition();
        } else {
            try {
                const parsed = JSON.parse(addDefinition) as Record<string, Json>;
                if (
                    typeof parsed !== 'object' ||
                    parsed === null ||
                    Array.isArray(parsed)
                ) {
                    throw new Error('not an object');
                }
                definition = parsed;
            } catch {
                setAddError('definition is not valid JSON');
                return;
            }
        }
        setAddError(null);
        await run('add', async () => {
            await addProjectQuestionnaire(pid, {
                name: addName.trim(),
                definition,
            });
            setAddOpen(false);
        });
    };

    const saveDefinitionEdit = async () => {        if (!editQ) return;
        let definition: Record<string, Json>;
        if (editMode === 'builder') {
            definition = {
                blocks: editBlocks,
                questions: editQuestions.map((q) => ({
                    field: q.field,
                    text: q.text,
                    citation: q.citation,
                    required: q.required,
                })),
            };
        } else {
            try {
                definition = JSON.parse(definitionText) as Record<string, Json>;
            } catch {
                setEditError('definition is not valid JSON');
                return;
            }
        }
        setEditError(null);
        setBusy(`qedit-${editQ.pid}`);
        try {
            await updateProjectQuestionnaire(pid, editQ.pid, {
                name: editQ.name,
                definition,
            });
            if (editQ.pid) {
                setCardQVersion((prev) => ({
                    ...prev,
                    [editQ.pid]: editVersionSel === null ? 1 : Number(editVersionSel),
                }));
            }
            setEditQ(null);
            await refresh();
        } catch (e) {
            setEditError(e instanceof Error ? e.message : 'request failed');
        } finally {
            setBusy(null);
        }
    };

    const copyBuiltInAndEdit = async () => {
        if (!builtIn || !pid) return;
        const existing = (questionnaires ?? []).find((x) => x.name === builtIn.name);
        if (existing) {
            openEditor(existing);
            return;
        }
        setBusy('copy-builtin');
        try {
            const copy = await addProjectQuestionnaire(pid, {
                name: builtIn.name,
                definition: builtIn.definition,
            });
            await refresh();
            openEditor(copy);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'failed to copy the built-in questionnaire');
        } finally {
            setBusy(null);
        }
    };

    const openEditor = (q: Questionnaire) => {
        const blocks = Array.isArray(
            q.definition['blocks'],
        )
            ? q.definition['blocks'].filter(
                  (b): b is string =>
                      typeof b === 'string',
              )
            : [];
        const questions = Array.isArray(
            q.definition['questions'],
        )
            ? q.definition['questions'].map(
                  (x) => {
                      const record =
                          (x ?? {}) as Record<
                              string,
                              Json
                          >;
                      return {
                          field:
                              typeof record[
                                  'field'
                              ] === 'string'
                                  ? record['field']
                                  : '',
                          text:
                              typeof record[
                                  'text'
                              ] === 'string'
                                  ? record['text']
                                  : '',
                          citation:
                              typeof record[
                                  'citation'
                              ] === 'string'
                                  ? record['citation']
                                  : '',
                          required:
                              record[
                                  'required'
                              ] === true,
                      };
                  },
              )
            : [];
        setEditQ(q);
        setEditMode(
            blocks.length > 0 ||
                questions.length > 0
                ? 'builder'
                : 'json',
        );
        setEditBlocks(blocks);
        setEditQuestions(questions);
        setDefinitionText(
            toJsonText(q.definition),
        );
        setEditError(null);
        setEditVersions([]);
        setEditVersionSel(null);
        void listQuestionnaireVersions(
            pid,
            q.pid,
        )
            .then((list) => {
                setEditQ(q);
                setEditVersions(list);
                // Reopen on the version the user last picked in the drawer
                // (cardQVersion), falling back to the latest revision.
                const lastPicked = cardQVersion[q.pid];
                setEditVersionSel(
                    list.length > 0
                        ? String(
                              list.some((x) => x.number === lastPicked)
                                  ? lastPicked
                                  : list[list.length - 1].number,
                          )
                        : null,
                );
            })
            .catch(() => {
                setEditQ(q);
                setEditVersions([]);
            });
    };

    const navigateEditVersion = (v: { id?: string }) => {
        if (!editQ || !v.id || v.id === 'current') {
            setEditVersionSel(v.id ?? null);
            return;
        }
        const version = editVersions.find((x) => String(x.number) === v.id);
        if (!version) return;
        setEditVersionSel(String(version.number));
        // The config version picked here is "the selected version" for this
        // questionnaire: remember it so Answer opens on it, not on latest.
        setCardQVersion((prev) => ({ ...prev, [editQ.pid]: version.number }));
        const blocks = Array.isArray(version.definition['blocks'])
            ? version.definition['blocks'].filter((b): b is string => typeof b === 'string')
            : [];
        const questions = Array.isArray(version.definition['questions'])
            ? version.definition['questions'].map((x) => {
                  const record = (x ?? {}) as Record<string, Json>;
                  return {
                      field: typeof record['field'] === 'string' ? record['field'] : '',
                      text: typeof record['text'] === 'string' ? record['text'] : '',
                      citation:
                          typeof record['citation'] === 'string' ? record['citation'] : '',
                      required: record['required'] === true,
                  };
              })
            : [];
        setEditBlocks(blocks);
        setEditQuestions(questions);
        setEditMode(blocks.length > 0 || questions.length > 0 ? 'builder' : 'json');
        setDefinitionText(toJsonText(version.definition));
        setEditError(null);
    };

    const builtInQuestions = Array.isArray(builtIn?.definition.questions)
        ? builtIn.definition.questions.length
        : 0;
    const loading = questionnaires === null || qualifications === null;

    const questionnaireCards = [
        ...(builtIn && !(questionnaires ?? []).some((x) => x.name === builtIn.name)
            ? [
                  {
                      id: builtIn.id,
                      name: builtIn.name,
                      definition: builtIn.definition,
                      sub: `${builtInQuestions} questions · config v${builtIn.version}`,
                      badge: 'built-in',
                      versionPid: null as string | null,
                      isBuiltIn: true,
                      qversion: builtIn.version,
                  },
              ]
            : []),
        ...(questionnaires ?? []).map((q) => ({
            id: q.pid,
            name: q.name,
            definition: q.definition,
            sub: definitionSummary(q.definition),
            badge: undefined as string | undefined,
            versionPid: q.pid as string | null,
            isBuiltIn: false,
            qversion: q.version as number | undefined,
            raw: q,
        })),
    ];

    // Master–detail entries for the Questionnaires split-pane dialog.
    const questionnaireItems: SplitPaneItem[] = questionnaireCards.map((c) => {
        const isSelected = selection === c.id;
        return {
            id: c.id,
            label: c.name,
            description: c.sub,
            icon: <Icon fontSize="small">description</Icon>,
            badge: isSelected ? (
                <Tooltip title="Selected questionnaire">
                    <IconButton size="small" disabled sx={{ '&.Mui-disabled': { opacity: 1 } }}>
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 22 }} />
                    </IconButton>
                </Tooltip>
            ) : (
                <Tooltip title="Select questionnaire">
                    <span>
                        <IconButton
                            size="small"
                            aria-label={`Select ${c.name}`}
                            disabled={busy !== null}
                            onClick={(e) => {
                                e.stopPropagation();
                                void run(`select-${c.id}`, () => selectQuestionnaire(pid, c.id));
                            }}
                        >
                            <CircleOutlinedIcon sx={{ color: 'action.disabled', fontSize: 22 }} />
                        </IconButton>
                    </span>
                </Tooltip>
            ),
            content: (
                <QuestionnaireDetail
                    name={c.name}
                    definition={c.definition}
                    versionPid={c.versionPid}
                    isBuiltIn={c.isBuiltIn}
                    isSelected={isSelected}
                    versionNumber={cardQVersion[c.id] ?? null}
                    onVersionChange={(n) => {
                        setCardQVersion((prev) => ({ ...prev, [c.id]: n }));
                    }}
                />
            ),
        };
    });

    // Summary values for the two page-level cards (Questionnaires / AI card).
    const selCard = questionnaireCards.find((c) => c.id === selection) ?? null;
    const versionLabel = selCard
        ? selCard.isBuiltIn
            ? `built-in v${selCard.qversion}`
            : `config v${cardQVersion[selCard.id] ?? selCard.qversion ?? '?'}`
        : null;
    const statusLabel = (() => {
        if (!selCard) return null;
        const list = (qualifications ?? []).filter((q) => q.questionnaire_id === selCard.id);
        if (list.some((q) => q.status === 'completed')) return 'completed';
        if (list.some((q) => q.status === 'draft' && hasAnswers(q.answers))) return 'draft';
        return 'not started';
    })();
    // The answers carry their own revision chain (system/card version), distinct
    // from the questionnaire config version shown above.
    const answersVersionLabel = selCard
        ? [...(qualifications ?? [])]
              .filter((q) => q.questionnaire_id === selCard.id && q.system_version)
              .sort(
                  (a, b) =>
                      (b.system_version?.number ?? 0) - (a.system_version?.number ?? 0),
              )[0]?.system_version?.number ?? null
        : null;
    const latestCompleted =
        [...(qualifications ?? [])]
            .filter(
                (q) =>
                    selCard !== null &&
                    q.questionnaire_id === selCard.id &&
                    q.status === 'completed' &&
                    q.system_card,
            )
            .sort(
                (a, b) =>
                    (b.system_version?.number ?? 0) - (a.system_version?.number ?? 0),
            )[0] ?? null;
    // The AI-card page card mirrors the graph's remembered version once picked,
    // else the latest completed card.
    const pickedCard = selCard
        ? (qualifications ?? []).find((q) => q.pid === rememberedCardPid[selCard.id]) ?? null
        : null;
    const shownCard = pickedCard ?? latestCompleted;
    const aiCardLabel = (() => {
        if (!shownCard) return 'not built';
        const sc = (shownCard.system_card ?? {}) as Record<string, Json>;
        const view = (sc['view'] ?? {}) as Record<string, Json>;
        const summary = (view['summary'] ?? {}) as Record<string, Json>;
        const system = (view['system'] ?? {}) as Record<string, Json>;
        return (
            (typeof summary['label'] === 'string' && summary['label']) ||
            (typeof system['label'] === 'string' && system['label']) ||
            'AI system card'
        );
    })();
    const openAiCard = () => {
        if (!latestCompleted) return;
        void openCard(latestCompleted.pid);
    };

    // The selected questionnaire the split-pane footer acts on (also for the
    // inline answer/edit forms); falls back to the first item, matching the
    // dialog's default selection.
    const qPaneCard =
        questionnaireCards.find((c) => c.id === qPaneSel) ?? questionnaireCards[0] ?? null;
    const qPaneRaw = qPaneCard && 'raw' in qPaneCard ? qPaneCard.raw : null;

    // The config revision this questionnaire's answers are shown against is
    // tracked per questionnaire (cardQVersion), not globally.
    const answerVN = ((): number | null => {
        if (!answerQ) return null;
        const picked = cardQVersion[answerQ.qid];
        return answerVersions.some((v) => v.number === picked)
            ? picked ?? null
            : answerVersions.length > 0
              ? answerVersions[answerVersions.length - 1].number
              : null;
    })();
    const answerVersionLabel = answerVN === null ? 'current' : `v${answerVN}`;

    // Shared chips / import-export / status controls: the inline split-pane
    // host keeps them in the header row; the drawer host moves them to footer.
    const answerFormMeta = answerQ ? (
        <>
            {savedDraft && (
                <Chip
                    label={`answers · ${savedDraft.status}`}
                    size="small"
                    color={savedDraft.status === 'draft' ? 'warning' : 'success'}
                    variant="outlined"
                />
            )}
            <Tooltip title="Export JSON">
                <IconButton size="small" aria-label="Export answers" onClick={() => exportAnswers()}>
                    <Icon fontSize="small">file_download</Icon>
                </IconButton>
            </Tooltip>
            <Tooltip title="Import JSON">
                <IconButton size="small" aria-label="Import answers" onClick={() => answerFileRef.current?.click()}>
                    <Icon fontSize="small">file_upload</Icon>
                </IconButton>
            </Tooltip>
            <input
                ref={answerFileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void importAnswers(file);
                }}
            />
            <Tooltip title="Pre-fill from a document">
                <IconButton
                    size="small"
                    aria-label="Pre-fill from a document"
                    onClick={() => setPrefillOpen(true)}
                >
                    <Icon fontSize="small">note_add</Icon>
                </IconButton>
            </Tooltip>
            {savedDraft && (
                <TextField
                    select
                    size="small"
                    label="Status"
                    value={savedDraft.status}
                    disabled={busy !== null}
                    onChange={(e) => {
                        const next = e.target.value;
                        if (next === 'completed') completeDraft(savedDraft.pid);
                        else if (next === 'draft') void reopenAnswer(savedDraft.pid);
                    }}
                    sx={{ minWidth: 140 }}
                >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                </TextField>
            )}
        </>
    ) : null;

    // Primary answer-form actions. The inline split-pane host keeps them in the
    // header row; the drawer host moves them to its footer.
    const answerFormActions = answerQ ? (
        <>
            <Button
                size="small"
                variant="contained"
                className="gradient-btn"
                onClick={() => void saveAnswers()}
                disabled={busy !== null}
                sx={{ textTransform: 'none' }}
            >
                Save
            </Button>
            <Button size="small" onClick={() => setAnswerQ(null)}>
                Close
            </Button>
        </>
    ) : null;

    // Header row for the inline split-pane host only.
    const answerFormHeader = answerQ ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ flexGrow: 1, pr: 1 }}>
                Answer — {answerQ.name}
            </Typography>
            {answerVersions.length > 0 && (
                <VersionSelect
                    ariaLabel="Answer version"
                    options={questionnaireVersionEntries(answerVersions)}
                    value={answerVN === null ? null : String(answerVN)}
                    fallbackLabel={answerVersionLabel}
                    onSelect={(id) => navigateAnswerVersion({ id })}
                />
            )}
            {answerFormMeta}
            {answerFormActions}
        </Box>
    ) : null;

    const answerFormBody = answerQ ? (
        <Box
            sx={{
                borderTop: '1px solid #eef2f7',
                pt: 2,
                flexGrow: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
            }}
        >
            <Typography variant="caption" color="text.secondary">
                {definitionSummary(answerQ.definition)} · saving stores a draft;
                completing versions it and builds the AI card.
            </Typography>
                {(() => {
                    const fields = answerableQuestions(answerQ.definition);
                    if (!fields) {
                        return (
                            <TextField
                                multiline
                                minRows={10}
                                fullWidth
                                value={answersText}
                                onChange={(e) => setAnswersText(e.target.value)}
                                aria-label="Answers JSON"
                                sx={{ fontFamily: 'monospace' }}
                            />
                        );
                    }
                    return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {fields.map((q) => (
                                <Box key={q.field}>
                                    <Typography variant="body2" fontWeight={600}>
                                        {q.text}
                                        {!q.required && (
                                            <Typography component="span" variant="caption" color="text.secondary">
                                                {' '}(optional)
                                            </Typography>
                                        )}
                                    </Typography>
                                    {q.citation && (
                                        <Typography variant="caption" color="text.secondary">
                                            {q.citation}
                                        </Typography>
                                    )}
                                    <TextField
                                        multiline
                                        minRows={2}
                                        fullWidth
                                        value={fieldAnswers[q.field] ?? ''}
                                        onChange={(e) =>
                                            setFieldAnswers((prev) => ({ ...prev, [q.field]: e.target.value }))
                                        }
                                        inputProps={{ 'aria-label': q.field }}
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    );
                })()}
                {(() => {
                    const rawBlocks = answerQ?.definition['blocks'];
                    const declared: string[] = Array.isArray(rawBlocks)
                        ? rawBlocks.filter((b): b is string => typeof b === 'string')
                        : [];
                    const showProfile = PROFILE_FIELDS.some((f) => declared.includes(f.key));
                    const showTags = TAG_FIELDS.some((f) => declared.includes(f.key));
                    const showRisks = declared.includes('risks');
                    if (!showProfile && !showTags && !showRisks) return null;
                    const affectedOptions = ['operator', 'user', ...(vocab['AISubject'] ?? [])].filter(
                        (v, i, all) => all.indexOf(v) === i,
                    );
                    const areaTerms = vocab['AreaOfImpact'] ?? [];
                    return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {showProfile && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Typography variant="body2" fontWeight={600}>
                                        About the deployment
                                    </Typography>
                                    {PROFILE_FIELDS.filter((f) => declared.includes(f.key)).map((f) => (
                                        <Box key={f.key}>
                                            <Typography variant="body2" fontWeight={600}>
                                                {f.label}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {f.hint}
                                            </Typography>
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                value={blockState.profile[f.key]}
                                                onChange={(e) => setProfileField(f.key, e.target.value)}
                                                inputProps={{ 'aria-label': f.label }}
                                                sx={{ mt: 0.5 }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                            {showTags && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Typography variant="body2" fontWeight={600}>
                                        Classifications
                                    </Typography>
                                    {TAG_FIELDS.filter((f) => declared.includes(f.key)).map((f) => {
                                        const terms = vocab[f.vocabClass] ?? [];
                                        const listId = `vocab-${f.key}`;
                                        return (
                                            <Box key={f.key}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {f.label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {f.hint}
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    value={blockState.tags[f.key].join(', ')}
                                                    onChange={(e) => setTagField(f.key, e.target.value)}
                                                    inputProps={{
                                                        'aria-label': f.label,
                                                        list: terms.length > 0 ? listId : undefined,
                                                    }}
                                                    sx={{ mt: 0.5 }}
                                                />
                                                {terms.length > 0 && (
                                                    <datalist id={listId}>
                                                        {terms.map((t) => (
                                                            <option key={t} value={t} />
                                                        ))}
                                                    </datalist>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                            {showRisks && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                                            Risks
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<Icon>add</Icon>}
                                            onClick={addRiskRow}
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Add risk
                                        </Button>
                                    </Box>
                                    {blockState.risks.length === 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            No risks yet. Add the first chain: what causes it, what
                                            happens, how it is controlled.
                                        </Typography>
                                    )}
                                    {blockState.risks.map((row, i) => (
                                        <Box
                                            key={i}
                                            sx={{
                                                p: 1.5,
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 1,
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                                                    Risk {i + 1}
                                                </Typography>
                                                <Button size="small" onClick={() => removeRiskRow(i)}>
                                                    Remove
                                                </Button>
                                            </Box>
                                            <TextField
                                                select
                                                fullWidth
                                                size="small"
                                                label="Affects"
                                                value={row.affected}
                                                onChange={(e) => setRiskRow(i, { affected: e.target.value })}
                                            >
                                                {affectedOptions.map((o) => (
                                                    <MenuItem key={o} value={o}>
                                                        {o}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                label="The risk"
                                                value={row.risk}
                                                onChange={(e) => setRiskRow(i, { risk: e.target.value })}
                                            />
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                label="Caused by"
                                                value={row.source}
                                                onChange={(e) => setRiskRow(i, { source: e.target.value })}
                                            />
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Exploited weakness (optional)"
                                                value={row.vulnerability}
                                                onChange={(e) => setRiskRow(i, { vulnerability: e.target.value })}
                                            />
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                label="Leading to"
                                                value={row.consequence}
                                                onChange={(e) => setRiskRow(i, { consequence: e.target.value })}
                                            />
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Areas of impact (comma-separated, optional)"
                                                value={row.impactAreas.join(', ')}
                                                onChange={(e) =>
                                                    setRiskRow(i, {
                                                        impactAreas: e.target.value
                                                            .split(',')
                                                            .map((a) => a.trim())
                                                            .filter((a) => a.length > 0),
                                                    })
                                                }
                                                inputProps={{
                                                    list: areaTerms.length > 0 ? `vocab-risk-areas-${i}` : undefined,
                                                }}
                                            />
                                            {areaTerms.length > 0 && (
                                                <datalist id={`vocab-risk-areas-${i}`}>
                                                    {areaTerms.map((t) => (
                                                        <option key={t} value={t} />
                                                    ))}
                                                </datalist>
                                            )}
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                label="Control"
                                                value={row.control}
                                                onChange={(e) => setRiskRow(i, { control: e.target.value })}
                                            />
                                            <TextField
                                                multiline
                                                minRows={2}
                                                fullWidth
                                                label="Follow-up controls (optional)"
                                                value={row.followUpControl}
                                                onChange={(e) => setRiskRow(i, { followUpControl: e.target.value })}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    );
                })()}
                {answerError && (
                    <Typography color="error">{answerError}</Typography>
                )}
            </Box>
    ) : null;

    // Inline host (split-pane detail): primary actions stay in the header row.
    const answerForm = answerQ ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            {answerFormHeader}
            {answerFormBody}
        </Box>
    ) : null;

    // Inline edit form (questionnaire builder), also in the split-pane detail.
    const editForm = editQ ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Edit definition — {editQ.name}
                </Typography>
                {editVersions.length > 0 && (
                    <VersionSelect
                        ariaLabel="Edit version"
                        options={questionnaireVersionEntries(editVersions)}
                        value={editVersionSel}
                        fallbackLabel="current"
                        onSelect={(id) => navigateEditVersion({ id })}
                    />
                )}
                <Chip
                    label={`config v${editVersionSel ?? editVersions[editVersions.length - 1]?.number}`}
                    size="small"
                    variant="outlined"
                />
                <Button
                    size="small"
                    variant="contained"
                    className="gradient-btn"
                    onClick={() => void saveDefinitionEdit()}
                    disabled={busy !== null}
                    sx={{ textTransform: 'none' }}
                >
                    Save
                </Button>
                <Button size="small" onClick={() => setEditQ(null)}>
                    Close
                </Button>
            </Box>
            <Box sx={{ borderTop: '1px solid #eef2f7', pt: 2, flexGrow: 1, overflowY: 'auto' }}>
                <Typography variant="caption" color="text.secondary">
                    Every save creates a new version; the form head becomes the latest definition.
                </Typography>
                <Box sx={{ mt: 1 }}>
                    <QuestionnaireBuilderForm
                        mode={editMode}
                        onModeChange={setEditMode}
                        blocks={editBlocks}
                        onBlocksChange={setEditBlocks}
                        questions={editQuestions}
                        onQuestionsChange={setEditQuestions}
                        definition={definitionText}
                        onDefinitionChange={setDefinitionText}
                        busy={busy !== null}
                    />
                </Box>
                {editError && (
                    <Typography color="error" sx={{ mt: 1 }}>
                        {editError}
                    </Typography>
                )}
            </Box>
        </Box>
    ) : null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
            <Box className="page-header">
                <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                    fact_check
                </Icon>
                <Typography variant="h4" className="page-header-title">
                    Qualification
                </Typography>
            </Box>
            {error && <Typography color="error">{error}</Typography>}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
            <Grid container spacing={2} className="plugins-grid">
                <Grid size={{ xs: 12, md: 6 }}>
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
                                        bgcolor: '#0a56c71f',
                                        color: '#0a56c7',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon fontSize="small">description</Icon>
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
                                    Questionnaires
                                </Typography>
                            </Box>
                        }
                        footer={
                            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Icon>fact_check</Icon>}
                                    disabled={!selCard || busy !== null}
                                    onClick={() => {
                                        if (!selCard) return;
                                        void openAnswer({
                                            qid: selCard.id,
                                            name: selCard.name,
                                            definition: selCard.definition,
                                            versionPid: selCard.versionPid,
                                        });
                                    }}
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Answer
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setQPaneOpen(true)}
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Open
                                </Button>
                            </Box>
                        }
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                            {selCard?.name ?? 'No questionnaire'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pt: 1 }}>
                            {selCard && versionLabel && (
                                <Chip label={versionLabel} size="small" variant="outlined" />
                            )}
                            {selCard && answersVersionLabel !== null && (
                                <Chip
                                    label={`answers v${answersVersionLabel}`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                />
                            )}
                            {selCard && (
                                <Chip
                                    label={selCard.isBuiltIn ? 'built-in' : 'project'}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                            {selCard && statusLabel && (
                                <Chip
                                    label={statusLabel}
                                    size="small"
                                    color={
                                        statusLabel === 'completed'
                                            ? 'success'
                                            : statusLabel === 'draft'
                                              ? 'warning'
                                              : 'default'
                                    }
                                />
                            )}
                        </Box>
                    </AppCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
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
                                        bgcolor: '#0a56c71f',
                                        color: '#0a56c7',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon fontSize="small">badge</Icon>
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
                                    AI card
                                </Typography>
                            </Box>
                        }
                        footer={
                            <Box sx={{ ml: 'auto' }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={openAiCard}
                                    disabled={!latestCompleted}
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Open
                                </Button>
                            </Box>
                        }
                    >
                        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                            {aiCardLabel}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pt: 1 }}>
                            {shownCard?.system_version && (
                                <Chip
                                    label={`card v${shownCard.system_version.number}`}
                                    size="small"
                                    color="primary"
                                />
                            )}
                            {shownCard && typeof shownCard.questionnaire_version === 'number' && (
                                <Chip
                                    label={`config v${shownCard.questionnaire_version}`}
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                />
                            )}
                            {selCard && (
                                <Chip label={selCard.name} size="small" variant="outlined" />
                            )}
                        </Box>
                    </AppCard>
                </Grid>
            </Grid>
            )}

            {(() => {
                if (!latestCompleted) return null;
                const sc = (latestCompleted.system_card ?? {}) as Record<string, Json>;
                const view = (sc['view'] ?? {}) as Record<string, Json>;
                const jsonld =
                    typeof sc['jsonld'] === 'string'
                        ? sc['jsonld']
                        : typeof latestCompleted.system_card_jsonld === 'string'
                          ? latestCompleted.system_card_jsonld
                          : null;
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                                account_tree
                            </Icon>
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                AI card graph
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {selCard?.name ?? 'Selected questionnaire'}
                                {latestCompleted.system_version
                                    ? ` · card v${latestCompleted.system_version.number}`
                                    : ''}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Icon>open_in_full</Icon>}
                                onClick={() => setFullScreenCard(latestCompleted)}
                                sx={{ textTransform: 'none' }}
                            >
                                Full screen
                            </Button>
                        </Box>
                        <CardGraph view={view} jsonld={jsonld} height={420} />
                    </Box>
                );
            })()}

            {latestCompleted && (
                <CardAgentPanel
                    pid={pid}
                    qualification={latestCompleted}
                    onApplied={onCardCorrected}
                />
            )}

            <QualificationPrefill
                open={prefillOpen}
                pid={pid}
                questionnaireId={answerQ?.qid}
                answers={fieldAnswers}
                blocks={blockState}
                onClose={() => setPrefillOpen(false)}
                onApply={(answers, blocks) => {
                    // the document fills the prose answers and the blocks together
                    setFieldAnswers(answers);
                    setBlockState(blocks);
                }}
            />

            <AppDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                title="New questionnaire"
                maxWidth="md"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={() => addFileRef.current?.click()}
                            variant="outlined"
                            startIcon={<Icon>file_upload</Icon>}
                            sx={{ textTransform: 'none' }}
                        >
                            Import
                        </Button>
                        <input
                            ref={addFileRef}
                            type="file"
                            accept="application/json,.json"
                            hidden
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) void onImportIntoAdd(file);
                            }}
                        />
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                            onClick={() => setAddOpen(false)}
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            className="gradient-btn"
                            disabled={busy !== null}
                            onClick={() => void saveAdd()}
                            sx={{ textTransform: 'none' }}
                        >
                            Create
                        </Button>
                    </>
                }
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Name"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        disabled={busy !== null}
                    />

                    <QuestionnaireBuilderForm
                        mode={addMode}
                        onModeChange={setAddMode}
                        blocks={addBlocks}
                        onBlocksChange={setAddBlocks}
                        questions={addQuestions}
                        onQuestionsChange={setAddQuestions}
                        definition={addDefinition}
                        onDefinitionChange={setAddDefinition}
                        busy={busy !== null}
                    />

                    <Typography variant="caption" color="text.secondary">
                        Or import a JSON file: it fills the name and definition for review.
                    </Typography>
                    {addError && <Typography color="error">{addError}</Typography>}
                </Box>
            </AppDialog>

            <SplitPaneDialog
                open={qpaneOpen}
                onClose={() => setQPaneOpen(false)}
                title="Questionnaires"
                items={questionnaireItems}
                maxWidth="lg"
                navWidth={280}
                emptyText="No questionnaires yet."
                onSelectedChange={setQPaneSel}
                detailOverride={answerForm ?? editForm ?? undefined}
                actions={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                        <Button
                            size="small"
                            variant="contained"
                            className="gradient-btn"
                            startIcon={<Icon fontSize="small">add</Icon>}
                            onClick={openAdd}
                            sx={{ textTransform: 'none' }}
                        >
                            Add questionnaire
                        </Button>
                        {qPaneCard && !answerQ && !editQ && (
                            <>
                                <Box sx={{ flexGrow: 1 }} />
                                {selection !== qPaneCard.id && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<Icon>check_circle</Icon>}
                                        disabled={busy !== null}
                                        onClick={() =>
                                            void run(`select-${qPaneCard.id}`, () =>
                                                selectQuestionnaire(pid, qPaneCard.id),
                                            )
                                        }
                                        sx={{ textTransform: 'none' }}
                                    >
                                        Select
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Icon>edit</Icon>}
                                    disabled={busy !== null}
                                    onClick={() => {
                                        if (qPaneRaw) openEditor(qPaneRaw);
                                        else void copyBuiltInAndEdit();
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {qPaneCard.isBuiltIn ? 'Copy & edit' : 'Edit'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    className="gradient-btn"
                                    startIcon={<Icon>fact_check</Icon>}
                                    disabled={!selCard || busy !== null}
                                    onClick={() => {
                                        if (!selCard) return;
                                        void openAnswer({
                                            qid: selCard.id,
                                            name: selCard.name,
                                            definition: selCard.definition,
                                            versionPid: selCard.versionPid,
                                        });
                                    }}
                                    sx={{ textTransform: 'none' }}
                                >
                                    Answer
                                </Button>
                            </>
                        )}
                    </Box>
                }
            />

            {/* Answer reached from the page-level Questionnaires card: slide
                over as before; inside the split-pane dialog the same form is
                rendered inline (detailOverride) instead. Uses the drawer header
                for the title + version gutter, footer for meta and actions. */}
            <SideDrawer
                open={answerQ !== null && !qpaneOpen}
                onClose={() => setAnswerQ(null)}
                title={answerQ ? `Answer — ${answerQ.name}` : 'Answer'}
                versions={questionnaireVersionEntries(answerVersions)}
                selectedVersionId={answerVN === null ? undefined : String(answerVN)}
                onSelectVersion={(v) => navigateAnswerVersion({ id: v.id })}
                footerActions={
                    <>
                        {answerFormMeta}
                        {answerFormActions}
                    </>
                }
            >
                {answerFormBody}
            </SideDrawer>

            <SideDrawer
                open={cardPid !== null}
                onClose={() => setCardPid(null)}
                title="AI card"
                mode="view"
                footerActions={
                    selectedCardPid && stagedNodes[selectedCardPid] ? (
                        <>
                            <Chip
                                label={`${Object.keys(stagedNodes[selectedCardPid]).length} staged edit${Object.keys(stagedNodes[selectedCardPid]).length === 1 ? '' : 's'}`}
                                size="small"
                                color="warning"
                                variant="outlined"
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => discardStagedNodes(selectedCardPid)}
                                disabled={busy !== null}
                            >
                                Discard
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                className="gradient-btn"
                                onClick={() => void saveStagedNodes(selectedCardPid)}
                                disabled={busy !== null}
                            >
                                Save changes
                            </Button>
                        </>
                    ) : undefined
                }
                versions={qualificationVersionEntries(cardChain)}
                selectedVersionId={selectedCardPid ?? undefined}
                onSelectVersion={(v) => {
                    setSelectedCardPid(v.id ?? null);
                    rememberCardVersion(v.id);
                }}
                onPreviewVersion={(v) => {
                    setSelectedCardPid(v.id ?? null);
                    rememberCardVersion(v.id);
                }}
                headerAction={
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {(() => {
                            const current = cardChain.find((q) => q.pid === selectedCardPid);
                            return current && typeof current.questionnaire_version === 'number' ? (
                                <Chip
                                    label={`config v${current.questionnaire_version}`}
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                />
                            ) : null;
                        })()}
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Icon>open_in_full</Icon>}
                            onClick={() => {
                                const current =
                                    cardChain.find((q) => q.pid === selectedCardPid) ?? null;
                                setFullScreenCard(current);
                            }}
                            disabled={!selectedCardPid}
                        >
                            Full screen
                        </Button>
                        <Tooltip title="Export JSON">
                            <IconButton
                                size="small"
                                aria-label="Export AI card"
                                onClick={exportCardJson}
                            >
                                <Icon fontSize="small">file_download</Icon>
                            </IconButton>
                        </Tooltip>
                    </Box>
                }
            >
                {cardError && <Typography color="error">{cardError}</Typography>}
                <AICardView
                    card={cardChain.find((q) => q.pid === selectedCardPid) ?? null}
                    editable
                    vocab={vocab}
                    onPatchNode={(nodeId, change) => {
                        stageNodeEdit(selectedCardPid ?? '', nodeId, change);
                        return Promise.resolve();
                    }}
                    staged={stagedNodes[selectedCardPid ?? ''] ?? undefined}
                />

            </SideDrawer>

            <Dialog fullWidth maxWidth="xl" open={fullScreenCard !== null} onClose={() => setFullScreenCard(null)}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 2,
                        py: 1.5,
                        borderBottom: '1px solid #e5e7eb',
                        position: 'sticky',
                        top: 0,
                        bgcolor: 'background.paper',
                        zIndex: 1,
                    }}
                >
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        AI card graph
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<Icon>close_fullscreen</Icon>}
                        onClick={() => setFullScreenCard(null)}
                        sx={{ textTransform: 'none' }}
                    >
                        Close
                    </Button>
                    {fullScreenCard && stagedNodes[fullScreenCard.pid] && (
                        <>
                            <Chip
                                label={`${Object.keys(stagedNodes[fullScreenCard.pid]).length} staged`}
                                size="small"
                                color="warning"
                                variant="outlined"
                            />
                            <Button
                                variant="outlined"
                                onClick={() => discardStagedNodes(fullScreenCard.pid)}
                                disabled={busy !== null}
                                sx={{ textTransform: 'none' }}
                            >
                                Discard
                            </Button>
                            <Button
                                variant="contained"
                                className="gradient-btn"
                                onClick={() => void saveStagedNodes(fullScreenCard.pid)}
                                disabled={busy !== null}
                                sx={{ textTransform: 'none' }}
                            >
                                Save changes
                            </Button>
                        </>
                    )}
                </Box>
                <Box
                    sx={{
                        p: 3,
                        boxSizing: 'border-box',
                        height: '80vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {(() => {
                        const sc = (fullScreenCard?.system_card ?? {}) as Record<string, Json>;
                        const graphView = (sc['view'] ?? null) as unknown as Record<
                            string,
                            Json
                        > | null;
                        const graphJsonld =
                            typeof sc['jsonld'] === 'string'
                                ? (sc['jsonld'] as string)
                                : (fullScreenCard?.system_card_jsonld ?? null);
                        const editingNode =
                            fullScreenEditingId && graphView
                                ? (() => {
                                      const found = findNodeInView(graphView, fullScreenEditingId);
                                      return found
                                          ? withStagedChange(
                                                found,
                                                stagedNodes[fullScreenCard?.pid ?? '']?.[fullScreenEditingId],
                                            )
                                          : null;
                                  })()
                                : null;
                        return (
                            <>
                                <CardGraph
                                    view={graphView}
                                    jsonld={graphJsonld}
                                    height="100%"
                                    onNodeClick={(id) => {
                                        setFullScreenEditingId(id);
                                        setFullScreenError(null);
                                    }}
                                />
                                {editingNode && (
                                    <NodeEditorDialog
                                        key={editingNode.id}
                                        node={editingNode}
                                        vocab={vocab}
                                        busy={false}
                                        error={fullScreenError}
                                        onCancel={() => setFullScreenEditingId(null)}
                                        onSave={(change) =>
                                            void saveFullScreenPatch(editingNode.id, change)
                                        }
                                    />
                                )}
                            </>
                        );
                    })()}
                </Box>
            </Dialog>
        </Box>
    );
}
