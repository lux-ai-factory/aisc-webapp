import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Icon from '@mui/material/Icon';
import EditIcon from '@mui/icons-material/Edit';
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
import AICardView from '../components/AICardView';
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

export default function QualificationPage() {
    const { projectUUID: pid } = useProject();
    const [questionnaires, setQuestionnaires] = useState<Questionnaire[] | null>(null);
    const [builtIn, setBuiltIn] = useState<DefaultQuestionnaire | null>(null);
    const [selection, setSelection] = useState<string | null>(null);
    const [pageCardPid, setPageCardPid] = useState<string | null>(null);
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
    const [vocab, setVocab] = useState<Record<string, string[]>>({});

    const [editQ, setEditQ] = useState<Questionnaire | null>(null);
    const [editMode, setEditMode] = useState<'builder' | 'json'>('builder');
    const [editBlocks, setEditBlocks] = useState<string[]>([]);
    const [editQuestions, setEditQuestions] = useState<BuilderQuestion[]>([]);
    const [definitionText, setDefinitionText] = useState('{}');
    const [editError, setEditError] = useState<string | null>(null);
    const [editVersions, setEditVersions] = useState<QuestionnaireVersion[]>([]);
    const [editVersionSel, setEditVersionSel] = useState<string | null>(null);
    const [cardQVersion, setCardQVersion] = useState<Record<string, number>>({});

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
            const chosen = chain.find((x) => x.pid === qid) ?? chain[chain.length - 1] ?? null;
            setSelectedCardPid(chosen ? chosen.pid : null);
        } catch (e) {
            setCardChain([]);
            setCardError(e instanceof Error ? e.message : 'failed to load versions');
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
            setPageCardPid(edited.pid);
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
        if (set && set.status === 'completed' && set.system_card) setPageCardPid(set.pid);
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
                      sub: `${builtInQuestions} questions · v${builtIn.version}`,
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
            ) : questionnaireCards.length === 0 ? (
                <Typography color="text.secondary">
                    No questionnaires yet. Add one to start a qualification.
                </Typography>
            ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box className="page-header">
                <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                    description
                </Icon>
                <Typography variant="h6" className="page-header-title">
                    Questionnaires
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    config and answers
                </Typography>
                <Button
                    size="small"
                    variant="contained"
                    className="gradient-btn"
                    startIcon={<Icon fontSize="small">add</Icon>}
                    onClick={openAdd}
                    sx={{ ml: 'auto', textTransform: 'none' }}
                >
                    Add
                </Button>
            </Box>
            <Grid container spacing={2} className="plugins-grid">
                {questionnaireCards.map((c) => {
                    const isSelected = selection === c.id;
                    return (
                        <Grid key={c.id} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                            <AppCard
                                active
                                onClick={() =>
                                    void openAnswer({
                                        qid: c.id,
                                        name: c.name,
                                        definition: c.definition,
                                        versionPid: c.versionPid,
                                    })
                                }
                                header={
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                        <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1, minWidth: 0 }}>
                                            {c.name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                                            {(
                                                <Tooltip title={c.isBuiltIn ? 'Copy to project and edit' : 'Edit definition'}>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Edit ${c.name}`}
                                                        onClick={() => {
                                                            const q = (c as { raw?: Questionnaire }).raw;
                                                            if (q) openEditor(q);
                                                            else void copyBuiltInAndEdit();
                                                            }}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {isSelected ? (
                                                    <Tooltip title="Selected questionnaire">
                                                        <CheckCircleIcon sx={{ color: 'success.main', alignSelf: 'center', fontSize: 24 }} />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Select questionnaire">
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                aria-label={`Select ${c.name}`}
                                                                disabled={busy !== null}
                                                                onClick={() =>
                                                                    run(`select-${c.id}`, async () =>
                                                                        selectQuestionnaire(pid, c.id),
                                                                    )
                                                                }
                                                            >
                                                                <CircleOutlinedIcon sx={{ color: 'action.disabled', fontSize: 24 }} />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </Box>
                                        }
                                    >
                                        <Typography variant="caption" color="text.secondary">
                                            {c.sub}
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: 1 }}>
                                            {c.qversion != null && (
                                                <Chip
                                                    label={`config v${cardQVersion[c.id] ?? c.qversion}`}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {c.badge && (
                                                <Chip label={c.badge} size="small" color="default" variant="outlined" />
                                            )}
                                            {isSelected && <Chip label="selected" size="small" color="primary" />}
                                            {(() => {
                                                const list = (qualifications ?? []).filter(
                                                    (q) => q.questionnaire_id === c.id,
                                                );
                                                if (list.length === 0) return null;
                                                const completed = list.filter(
                                                    (q) => q.status === 'completed',
                                                ).length;
                                                const drafts = list.filter(
                                                    (q) => q.status === 'draft' && hasAnswers(q.answers),
                                                ).length;
                                                const last = [...list].sort(
                                                    (a, b) =>
                                                        (b.system_version?.number ?? 0) -
                                                        (a.system_version?.number ?? 0),
                                                )[0];
                                                return (
                                                    <>
                                                        <Chip
                                                            label={`${last?.system_version ? `answers v${last.system_version.number}` : 'answers'}`}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                        />
                                                        {completed > 0 && drafts === 0 && (
                                                            <Chip label={`${completed} completed`} size="small" variant="outlined" />
                                                        )}
                                                        {drafts > 0 && (
                                                            <Chip
                                                                label={`${drafts} draft${drafts === 1 ? '' : 's'}`}
                                                                size="small"
                                                                color="warning"
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                </AppCard>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
            )}

            {(() => {
                const cardGroups = new Map<
                    string,
                    Qualification[]
                >();
                for (const q of qualifications ?? []) {
                    if (q.status !== 'completed' || !q.system_card) continue;
                    const group = cardGroups.get(q.questionnaire_id) ?? [];
                    group.push(q);
                    cardGroups.set(q.questionnaire_id, group);
                }
                if (cardGroups.size === 0) return null;
                const cardGroupsList = [...cardGroups.entries()]
                    .filter(([qid]) => qid === selection)
                    .map(
                    ([qid, entries]) =>
                        [
                            qid,
                            [...entries].sort(
                                (a, b) =>
                                    (b.system_version?.number ?? 0) -
                                    (a.system_version?.number ?? 0),
                            ),
                        ] as const,
                );
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box className="page-header">
                            <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                                badge
                            </Icon>
                            <Typography variant="h6" className="page-header-title">
                                AI cards
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                one per questionnaire
                            </Typography>
                        </Box>
                        <Grid container spacing={2} className="plugins-grid">
                            {cardGroupsList.map(([qid, entries]) => {
                                const latest = entries[0];
                                const shown =
                                    entries.find((q) => q.pid === pageCardPid) ?? latest;
                                const sc = (latest.system_card ?? {}) as Record<string, Json>;
                                const view = (sc['view'] ?? {}) as Record<string, Json>;
                                const summary = (view['summary'] ?? {}) as Record<string, Json>;
                                const system = (view['system'] ?? {}) as Record<string, Json>;
                                const questionnaire =
                                    qid === builtIn?.id
                                        ? builtIn
                                        : (questionnaires ?? []).find(
                                              (x) => x.pid === qid,
                                          );
                                const label =
                                    questionnaire?.name ||
                                    (typeof summary['label'] === 'string' && summary['label']) ||
                                    (typeof system['label'] === 'string' && system['label']) ||
                                    'AI system card';
                                const nodeCount =
                                    typeof view['counts'] === 'object' &&
                                    view['counts'] !== null &&
                                    !Array.isArray(view['counts'])
                                        ? (view['counts'] as Record<string, Json>)['nodes']
                                        : undefined;
                                const tripleCount =
                                    typeof view['counts'] === 'object' &&
                                    view['counts'] !== null &&
                                    !Array.isArray(view['counts'])
                                        ? (view['counts'] as Record<string, Json>)['triples']
                                        : undefined;
                                const riskCount =
                                    typeof view['counts'] === 'object' &&
                                    view['counts'] !== null &&
                                    !Array.isArray(view['counts'])
                                        ? (view['counts'] as Record<string, Json>)['risks']
                                        : undefined;
                                const coverage = (view['coverage'] ?? {}) as Record<string, Json>;
                                const answerCount =
                                    typeof view['answers_count'] === 'number'
                                        ? view['answers_count']
                                        : Array.isArray(view['answers'])
                                          ? (view['answers'] as Json[]).length
                                          : undefined;
                                const draftCount = (qualifications ?? []).filter(
                                    (q) =>
                                        q.questionnaire_id === qid &&
                                        q.status === 'draft' &&
                                        hasAnswers(q.answers),
                                ).length;
                                return (
                                    <Grid key={qid} size={{ xs: 12, sm: 12, md: 6, lg: 4 }}>
                                        <AppCard
                                            active
                                            onClick={() => {
                                                const remembered =
                                                    pageCardPid !== null &&
                                                    entries.some((q) => q.pid === pageCardPid)
                                                        ? pageCardPid
                                                        : latest.pid;
                                                setPageCardPid(remembered);
                                                void openCard(remembered);
                                            }}
                                            header={
                                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                                    {label}
                                                </Typography>
                                            }
                                        >
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: 1 }}>
                                                    <Chip
                                                        label={shown.system_version ? `v${shown.system_version.number}` : 'draft'}
                                                        size="small"
                                                        color="primary"
                                                    />
                                                    <Chip
                                                        label={`${questionnaire?.name ?? qid}${typeof shown.questionnaire_version === 'number' ? ` · config v${shown.questionnaire_version}` : ''}`}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    {typeof nodeCount === 'number' && (
                                                        <Chip
                                                            label={`${nodeCount} nodes${typeof tripleCount === 'number' ? ` · ${tripleCount} triples` : ''}`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {typeof riskCount === 'number' && riskCount > 0 && (
                                                        <Chip
                                                            label={`${riskCount} risks`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {typeof answerCount === 'number' && (
                                                        <Chip
                                                            label={`${answerCount} answers`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {typeof coverage['summary'] === 'string' && coverage['summary'] && (
                                                        <Chip
                                                            label={String(coverage['summary'])}
                                                            size="small"
                                                            color="info"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                    {draftCount > 0 && (
                                                        <Chip
                                                            label={`${draftCount} draft${draftCount === 1 ? '' : 's'} pending`}
                                                            size="small"
                                                            color="warning"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Box>
                                        </AppCard>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                );
            })()}
            {(() => {
                const completed = [...(qualifications ?? [])].filter(
                    (q) => q.status === 'completed' && q.system_card,
                );
                if (completed.length === 0) return null;
                const ofSelection = completed.filter((q) => q.questionnaire_id === selection);
                const selectedCard =
                    ofSelection.find((q) => q.pid === pageCardPid) ??
                    [...ofSelection].sort(
                        (a, b) =>
                            (b.system_version?.number ?? 0) -
                            (a.system_version?.number ?? 0),
                    )[0] ??
                    null;
                if (!selectedCard) return null;
                const sc = (selectedCard.system_card ?? {}) as Record<string, Json>;
                const view = (sc['view'] ?? {}) as Record<string, Json>;
                const jsonld =
                    typeof sc['jsonld'] === 'string'
                        ? sc['jsonld']
                        : typeof selectedCard.system_card_jsonld === 'string'
                          ? selectedCard.system_card_jsonld
                          : null;
                const selectedQuestionnaire =
                    selectedCard.questionnaire_id === builtIn?.id
                        ? builtIn
                        : (questionnaires ?? []).find(
                              (x) => x.pid === selectedCard.questionnaire_id,
                          );
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Icon fontSize="small" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                                account_tree
                            </Icon>
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                AI card graph
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {selectedQuestionnaire?.name ?? 'Selected questionnaire'}
                                {selectedCard.system_version
                                    ? ` · card v${selectedCard.system_version.number}`
                                    : ''}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Icon>open_in_full</Icon>}
                                onClick={() => setFullScreenCard(selectedCard)}
                                sx={{ textTransform: 'none' }}
                            >
                                Full screen
                            </Button>
                        </Box>
                        <CardGraph
                            view={view}
                            jsonld={jsonld}
                            height={420}
                        />
                    </Box>
                );
            })()}

            <SideDrawer
                open={answerQ !== null}
                onClose={() => setAnswerQ(null)}
                title={answerQ ? `Answer — ${answerQ.name}` : 'Answer'}
                mode="edit"
                versions={questionnaireVersionEntries(answerVersions)}
                selectedVersionId={answerVersionSel ?? undefined}
                onSelectVersion={navigateAnswerVersion}
                onPreviewVersion={navigateAnswerVersion}
                headerAction={
                    savedDraft ? (
                        <Chip
                            label={`answers · ${savedDraft.status}`}
                            size="small"
                            color={savedDraft.status === 'draft' ? 'warning' : 'success'}
                            variant="outlined"
                        />
                    ) : undefined
                }
                onSave={() => void saveAnswers()}
                onCancel={() => setAnswerQ(null)}
                footerActions={
                    <>
                        <Tooltip title="Export JSON">
                            <IconButton
                                size="small"
                                aria-label="Export answers"
                                onClick={() => exportAnswers()}
                            >
                                <Icon fontSize="small">file_download</Icon>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Import JSON">
                            <IconButton
                                size="small"
                                aria-label="Import answers"
                                onClick={() => answerFileRef.current?.click()}
                            >
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
                }
            >
                <Typography variant="caption" color="text.secondary">
                    {answerQ ? definitionSummary(answerQ.definition) : ''} · saving stores a draft;
                    completing versions it and builds the AI card.
                </Typography>
                {(() => {
                    const fields = answerQ ? answerableQuestions(answerQ.definition) : null;
                    if (!fields) {
                        return (
                            <TextField
                                multiline
                                minRows={10}
                                fullWidth
                                value={answersText}
                                onChange={(e) => setAnswersText(e.target.value)}
                                aria-label="Answers JSON"
                                sx={{ mt: 1, fontFamily: 'monospace' }}
                            />
                        );
                    }
                    return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
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
                                                label="Controlled by"
                                                value={row.control}
                                                onChange={(e) => setRiskRow(i, { control: e.target.value })}
                                            />
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Then / follow-up control (optional)"
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
                    <Typography color="error" sx={{ mt: 1 }}>
                        {answerError}
                    </Typography>
                )}
            </SideDrawer>

            <SideDrawer
                open={editQ !== null}
                onClose={() => setEditQ(null)}
                title={editQ ? `Edit definition — ${editQ.name}` : 'Edit definition'}
                mode="edit"
                versions={questionnaireVersionEntries(editVersions)}
                selectedVersionId={editVersionSel ?? undefined}
                onSelectVersion={(v) => {
                    navigateEditVersion(v);
                    if (editQ && v.id && v.id !== 'current') {
                        setCardQVersion((prev) => ({ ...prev, [editQ.pid]: Number(v.id) }));
                    }
                }}
                onPreviewVersion={(v) => {
                    navigateEditVersion(v);
                    if (editQ && v.id && v.id !== 'current') {
                        setCardQVersion((prev) => ({ ...prev, [editQ.pid]: Number(v.id) }));
                    }
                }}
                onSave={() => void saveDefinitionEdit()}
                onCancel={() => setEditQ(null)}
                headerAction={
                    editVersions.length > 0 ? (
                        <Chip
                            label={`config v${editVersionSel ?? editVersions[editVersions.length - 1].number}`}
                            size="small"
                            variant="outlined"
                        />
                    ) : undefined
                }
            >
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
            </SideDrawer>

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
                    setPageCardPid(v.id ?? null);
                }}
                onPreviewVersion={(v) => {
                    setSelectedCardPid(v.id ?? null);
                    setPageCardPid(v.id ?? null);
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
