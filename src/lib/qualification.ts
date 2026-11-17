import { API_VERSION_PREFIX } from '../config';

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Questionnaire {
    pid: string;
    name: string;
    definition: Record<string, Json>;
    /** latest config revision (1..n, 0 when none recorded yet) */
    version?: number;
}

export interface QuestionnaireVersion {
    pid: string;
    questionnaire_id: string;
    number: number;
    definition: Record<string, Json>;
    created_at: string;
    created_by: string;
}

export interface SystemVersion {
    pid: string;
    project_id: string;
    number: number;
    name: string;
    version: string;
    provider: string;
    description: string;
    created_at: string;
    created_by: string;
}

export interface Qualification {
    pid: string;
    questionnaire_id: string;
    answers: Record<string, Json>;
    system_card: Record<string, Json> | null;
    status: string;
    /** the questionnaire version number the answers were filled against */
    questionnaire_version?: number | null;
    system_version: SystemVersion | null;
    system_card_jsonld?: string | null;
}

export interface ObjectivePriority {
    objective_id: string;
    score: number;
    top_rating: number;
    rank: number;
    key: boolean;
    key_default: boolean;
    risk_ids: string[];
    reasons: string[];
    /** The assessor's manual per-objective likelihood (1-5), when set. */
    likelihood?: number | null;
    /** The assessor's free-text note for the objective. */
    comment?: string | null;
}

export interface ObjectiveRisk {
    pid: string;
    position: number;
    name: string;
    airo_text: string;
    impact: number | null;
    likelihood: number | null;
    rating: number;
    comment: string;
}

export interface ObjectiveMapping {
    pid: string;
    risk_pid: string;
    objective_id: string;
    quote: string;
    rationale: string;
    source: string;
}

export interface ObjectivesMatrix {
    priorities: ObjectivePriority[];
    risks?: ObjectiveRisk[];
    mappings?: ObjectiveMapping[];
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

export function listProjectQuestionnaires(pid: string): Promise<Questionnaire[]> {
    return request<Questionnaire[]>(`/questionnaires/projects/${pid}`);
}

export function addProjectQuestionnaire(
    pid: string,
    data: { name: string; definition: Record<string, Json> },
): Promise<Questionnaire> {
    return request<Questionnaire>(`/questionnaires/projects/${pid}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function updateProjectQuestionnaire(
    pid: string,
    questionnairePid: string,
    data: { name: string; definition: Record<string, Json> },
): Promise<Questionnaire> {
    return request<Questionnaire>(`/questionnaires/projects/${pid}/${questionnairePid}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function listQuestionnaireVersions(
    pid: string,
    questionnairePid: string,
): Promise<QuestionnaireVersion[]> {
    return request<QuestionnaireVersion[]>(
        `/questionnaires/projects/${pid}/${questionnairePid}/versions`,
    );
}

export function getSelection(pid: string): Promise<{ questionnaire_id: string | null }> {
    return request<{ questionnaire_id: string | null }>(`/projects/${pid}/questionnaire`);
}

export interface DefaultQuestionnaire {
    id: string;
    name: string;
    description: string;
    version: number;
    definition: Record<string, Json>;
}

/** The builtin default, owned by the headless service (null when unconfigured). */
export async function getDefaultQuestionnaire(): Promise<DefaultQuestionnaire | null> {
    try {
        return await request<DefaultQuestionnaire>('/questionnaires/default');
    } catch (e) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
    }
}

export function selectQuestionnaire(
    pid: string,
    questionnaireId: string | null,
): Promise<{ questionnaire_id: string | null }> {
    return request<{ questionnaire_id: string | null }>(`/projects/${pid}/questionnaire`, {
        method: 'PUT',
        body: JSON.stringify({ questionnaire_id: questionnaireId }),
    });
}

export function listQualifications(pid: string): Promise<Qualification[]> {
    return request<Qualification[]>(`/projects/${pid}/qualification`);
}

export function saveDraftQualification(
    pid: string,
    data: {
        questionnaire_id: string;
        name: string;
        answers: Record<string, Json>;
        questionnaire_version?: number | null;
    },
): Promise<Qualification> {
    return request<Qualification>(`/projects/${pid}/qualification`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function completeQualification(pid: string, qualificationPid: string): Promise<Qualification> {
    return request<Qualification>(`/projects/${pid}/qualification/${qualificationPid}/complete`, {
        method: 'POST',
    });
}

/** Reopen a completed qualification as a draft (keeps its card until rebuilt). */
export function reopenQualification(pid: string, qualificationPid: string): Promise<Qualification> {
    return request<Qualification>(`/projects/${pid}/qualification/${qualificationPid}/reopen`, {
        method: 'POST',
    });
}

export function listQualificationVersions(
    pid: string,
    qualificationPid: string,
): Promise<Qualification[]> {
    return request<Qualification[]>(
        `/projects/${pid}/qualification/${qualificationPid}/versions`,
    );
}

export function editQualificationCard(
    pid: string,
    qualificationPid: string,
    systemCard: Record<string, Json>,
): Promise<Qualification> {
    return request<Qualification>(`/projects/${pid}/qualification/${qualificationPid}/card`, {
        method: 'PUT',
        body: JSON.stringify({ system_card: systemCard }),
    });
}

/** One reviewer's correction to one card node. The backend merges it into the
 *  answers' `__patch` and rebuilds the card; the returned row is the new
 *  version. `vair: null` removes the type; omit a key to leave it unchanged. */
export function patchQualificationNode(
    pid: string,
    qualificationPid: string,
    nodeId: string,
    change: Record<string, Json>,
): Promise<Qualification> {
    return request<Qualification>(
        `/projects/${pid}/qualification/${qualificationPid}/nodes/${nodeId}`,
        {
            method: 'PUT',
            body: JSON.stringify(change),
        },
    );
}

export function patchQualificationNodes(
    pid: string,
    qualificationPid: string,
    nodes: Record<string, Record<string, Json>>,
): Promise<Qualification> {
    return request<Qualification>(`/projects/${pid}/qualification/${qualificationPid}/nodes`, {
        method: 'PUT',
        body: JSON.stringify({ nodes }),
    });
}

export function getObjectivesMatrix(pid: string): Promise<ObjectivesMatrix> {
    return request<ObjectivesMatrix>(
        `/projects/${pid}/control-objectives/matrix`,
    );
}

/** Set the assessor's manual score/likelihood for individual objectives.
 *  Objectives without an entry keep their computed (sum-of-risks) score. */
export function setObjectiveRatings(
    pid: string,
    ratings: Record<string, { score: number; likelihood?: number | null; comment?: string }>,
): Promise<ObjectiveProfile> {
    return request<ObjectiveProfile>(`/projects/${pid}/control-objectives/ratings`, {
        method: 'PUT',
        body: JSON.stringify({ ratings }),
    });
}

export function listRiskRegister(pid: string): Promise<ObjectiveRisk[]> {
    return request<ObjectiveRisk[]>(`/projects/${pid}/control-objectives/risks`);
}

/** Populate the risk register from the latest AI card's risks: existing risks
 *  are updated (card text only; ratings/mappings kept), new ones are added. */
export function importCardRisks(
    pid: string,
): Promise<{ created: ObjectiveRisk[]; updated: ObjectiveRisk[] }> {
    return request<{ created: ObjectiveRisk[]; updated: ObjectiveRisk[] }>(
        `/projects/${pid}/control-objectives/risks/from-card`,
        { method: 'POST' },
    );
}

/** True when the latest completed AI card declares at least one risk row, so the
 *  frontend can skip the from-card import (which otherwise 400s) when it has none. */
export async function latestCardHasRisks(pid: string): Promise<boolean> {
    try {
        const quals = await listQualifications(pid);
        const latest = quals
            .filter((q) => q.status === 'completed' && q.system_card)
            .sort(
                (a, b) =>
                    (b.system_version?.number ?? 0) - (a.system_version?.number ?? 0),
            )[0];
        if (!latest) return false;
        const sc = (latest.system_card ?? {}) as Record<string, Json>;
        const view = (sc['view'] ?? {}) as Record<string, Json>;
        if (Array.isArray(view['risks']) && view['risks'].length > 0) return true;
        const counts = view['counts'];
        if (typeof counts === 'object' && counts !== null && !Array.isArray(counts)) {
            const counted = (counts as Record<string, Json>)['risks'];
            if (typeof counted === 'number' && counted > 0) return true;
        }
        return false;
    } catch {
        // Cannot inspect the card — keep the previous POST behaviour so real
        // errors keep surfacing through the existing import error handler.
        return true;
    }
}

export function deleteRisk(pid: string, riskPid: string): Promise<void> {
    return request<void>(`/projects/${pid}/control-objectives/risks/${riskPid}`, {
        method: 'DELETE',
    });
}

/** Rate one risk's impact/likelihood (1-5; null clears) with an optional rationale. */
export function rateRisk(
    pid: string,
    riskPid: string,
    rating: { impact?: number | null; likelihood?: number | null; comment?: string },
): Promise<ObjectiveRisk> {
    return request<ObjectiveRisk>(
        `/projects/${pid}/control-objectives/risks/${riskPid}/rating`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                impact: rating.impact ?? null,
                likelihood: rating.likelihood ?? null,
                comment: rating.comment ?? '',
            }),
        },
    );
}

export interface RiskVersion {
    pid: string;
    risk_pid: string;
    number: number;
    name: string;
    impact: number | null;
    likelihood: number | null;
    rating: number;
    comment: string;
    airo_text: string;
    created_at: string;
    created_by: string;
}

export function listRiskVersions(pid: string, riskPid: string): Promise<RiskVersion[]> {
    return request<RiskVersion[]>(
        `/projects/${pid}/control-objectives/risks/${riskPid}/versions`,
    );
}

export function getRiskVersion(
    pid: string,
    riskPid: string,
    number: number,
): Promise<RiskVersion> {
    return request<RiskVersion>(
        `/projects/${pid}/control-objectives/risks/${riskPid}/versions/${number}`,
    );
}

/** Version-dropdown entries for a risk's revision chain. */
export function riskVersionEntries(versions: RiskVersion[]): { id: string; label: string }[] {
    return versions.map((v) => ({
        id: String(v.number),
        label:
            v.rating > 0
                ? `v${v.number} · ${v.impact}×${v.likelihood}`
                : `v${v.number} · unrated`,
    }));
}

export function listRiskMappings(pid: string): Promise<ObjectiveMapping[]> {
    return request<ObjectiveMapping[]>(`/projects/${pid}/control-objectives/mappings`);
}

export function addRiskMapping(
    pid: string,
    riskPid: string,
    objectiveId: string,
    opts?: { quote?: string; rationale?: string },
): Promise<ObjectiveMapping> {
    return request<ObjectiveMapping>(
        `/projects/${pid}/control-objectives/risks/${riskPid}/mappings`,
        {
            method: 'POST',
            body: JSON.stringify({ objective_id: objectiveId, ...opts }),
        },
    );
}

export function deleteRiskMapping(pid: string, mappingPid: string): Promise<void> {
    return request<void>(`/projects/${pid}/control-objectives/mappings/${mappingPid}`, {
        method: 'DELETE',
    });
}

export interface ObjectiveProfile {
    pid?: string | null;
    name?: string;
    objectives?: string[];
    key_objectives?: string[];
    catalogue_digest?: string | null;
}

/** Undo the assessor's priority (key) choices: the computed defaults apply again. */
export function undoPriorityChoices(pid: string): Promise<ObjectiveProfile> {
    return request<ObjectiveProfile>(`/projects/${pid}/control-objectives/profile/keys`, {
        method: 'DELETE',
    });
}

export interface ObjectiveCatalogueItem {
    id: string;
    macro_requirement: string;
    legal_basis: string;
    sub_requirement_label: string;
    text: string;
    assessment_mode: string;
    custom?: boolean;
}

export function listObjectiveCatalogue(pid: string): Promise<ObjectiveCatalogueItem[]> {
    return request<ObjectiveCatalogueItem[]>(`/projects/${pid}/control-objectives/catalogue`);
}

export interface ObjectiveCatalogueIn {
    objective_id: string;
    macro_requirement: string;
    legal_basis?: string;
    sub_requirement_label?: string;
    text?: string;
    assessment_mode?: string;
    target?: string;
    standards_grounding?: string;
    grounding_tier_flag?: string;
    notes?: string;
}

export function addObjectiveCatalogueItem(
    pid: string,
    data: ObjectiveCatalogueIn,
): Promise<ObjectiveCatalogueItem> {
    return request<ObjectiveCatalogueItem>(`/projects/${pid}/control-objectives/catalogue`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function updateObjectiveCatalogueItem(
    pid: string,
    objectiveId: string,
    data: ObjectiveCatalogueIn,
): Promise<ObjectiveCatalogueItem> {
    return request<ObjectiveCatalogueItem>(
        `/projects/${pid}/control-objectives/catalogue/${objectiveId}`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        },
    );
}

export function deleteObjectiveCatalogueItem(pid: string, objectiveId: string): Promise<void> {
    return request<void>(`/projects/${pid}/control-objectives/catalogue/${objectiveId}`, {
        method: 'DELETE',
    });
}

/** Parse an imported catalogue file: one objective or an array of them. */
export function parseObjectiveImport(text: string): ObjectiveCatalogueIn[] {
    const raw = JSON.parse(text) as unknown;
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            throw new Error('not an objective');
        }
        const record = item as Record<string, unknown>;
        const str = (k: string) => (typeof record[k] === 'string' ? (record[k] as string) : '');
        return {
            objective_id: str('objective_id') || str('id'),
            macro_requirement: str('macro_requirement'),
            legal_basis: str('legal_basis'),
            sub_requirement_label: str('sub_requirement_label'),
            text: str('text'),
            assessment_mode: str('assessment_mode'),
            target: str('target'),
            standards_grounding: str('standards_grounding'),
            grounding_tier_flag: str('grounding_tier_flag'),
            notes: str('notes'),
        };
    });
}

export async function getObjectiveProfile(pid: string): Promise<ObjectiveProfile | null> {
    try {
        return await request<ObjectiveProfile>(`/projects/${pid}/control-objectives/profile`);
    } catch (e) {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
    }
}

export function setObjectiveProfile(
    pid: string,
    profile: Partial<ObjectiveProfile> & { key_objectives: string[] },
): Promise<ObjectiveProfile> {
    return request<ObjectiveProfile>(`/projects/${pid}/control-objectives/profile`, {
        method: 'PUT',
        body: JSON.stringify(profile),
    });
}

/** One risk row of the card's structured blocks. The Impact node takes its name
 *  from the risk text; kind of harm rides on `impactTerm`. */
export interface RiskBlockRow {
    affected: string;
    risk: string;
    source: string;
    vulnerability: string;
    consequence: string;
    impactAreas: string[];
    control: string;
    followUpControl: string;
    sourceTerm: string;
    consequenceTerm: string;
    impactTerm: string;
    controlTerm: string;
    followUpControlTerm: string;
}

/** The structured blocks collected alongside prose answers. Stored inside the
 *  answers payload under `__blocks` so old cards (no blocks) keep working and
 *  the headless service can map them onto the ontology contract. */
export interface QualificationBlocks {
    profile: {
        description: string;
        targetUseCase: string;
        targetUsers: string;
        intendedDeployers: string;
    };
    tags: {
        targetSystem: string[];
        sector: string[];
        marketForm: string[];
        locality: string[];
    };
    risks: RiskBlockRow[];
}

export const BLOCKS_KEY = '__blocks';

export function emptyBlocks(): QualificationBlocks {
    return {
        profile: { description: '', targetUseCase: '', targetUsers: '', intendedDeployers: '' },
        tags: { targetSystem: [], sector: [], marketForm: [], locality: [] },
        risks: [],
    };
}

export function emptyRiskRow(): RiskBlockRow {
    return {
        affected: '',
        risk: '',
        source: '',
        vulnerability: '',
        consequence: '',
        impactAreas: [],
        control: '',
        followUpControl: '',
        sourceTerm: '',
        consequenceTerm: '',
        impactTerm: '',
        controlTerm: '',
        followUpControlTerm: '',
    };
}

function nonEmptyStrings(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0);
}

function asRecord(value: unknown): Record<string, Json> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, Json>;
}

/** A risk row is kept only when the ontology's required fields are all set. */
export function completeRiskRows(rows: RiskBlockRow[]): RiskBlockRow[] {
    return rows
        .map((r) => ({
            affected: r.affected.trim(),
            risk: r.risk.trim(),
            source: r.source.trim(),
            vulnerability: r.vulnerability.trim(),
            consequence: r.consequence.trim(),
            impactAreas: r.impactAreas.map((a) => a.trim()).filter((a) => a.length > 0),
            control: r.control.trim(),
            followUpControl: r.followUpControl.trim(),
            sourceTerm: r.sourceTerm.trim(),
            consequenceTerm: r.consequenceTerm.trim(),
            impactTerm: r.impactTerm.trim(),
            controlTerm: r.controlTerm.trim(),
            followUpControlTerm: r.followUpControlTerm.trim(),
        }))
        .filter(
            (r) =>
                r.affected !== '' &&
                r.risk !== '' &&
                r.source !== '' &&
                r.consequence !== '' &&
                r.control !== '',
        );
}

export function blocksNonEmpty(blocks: QualificationBlocks): boolean {
    const profileSet = Object.values(blocks.profile).some((v) => v.trim() !== '');
    const tagsSet = Object.values(blocks.tags).some((list) => list.length > 0);
    return profileSet || tagsSet || completeRiskRows(blocks.risks).length > 0;
}

/** Merge blocks into an answers payload for saving. Drops empty blocks and
 *  incomplete risk rows so the card build only sees usable content. */
export function mergeBlocksIntoAnswers(
    answers: Record<string, Json>,
    blocks: QualificationBlocks,
): Record<string, Json> {
    if (!blocksNonEmpty(blocks)) {
        if (!(BLOCKS_KEY in answers)) return answers;
        const rest = { ...answers };
        delete rest[BLOCKS_KEY];
        return rest;
    }
    const profile: Record<string, Json> = {};
    for (const [k, v] of Object.entries(blocks.profile)) {
        const text = v.trim();
        if (text) profile[k] = text;
    }
    const tags: Record<string, Json> = {};
    const tagKeys: Array<[string, string[]]> = [
        ['targetSystem', blocks.tags.targetSystem],
        ['sector', blocks.tags.sector],
        ['marketForm', blocks.tags.marketForm],
        ['locality', blocks.tags.locality],
    ];
    for (const [k, list] of tagKeys) {
        const terms = list.map((t) => t.trim()).filter((t) => t.length > 0);
        if (terms.length > 0) tags[k] = terms;
    }
    const out: Record<string, Json> = { ...answers };
    out[BLOCKS_KEY] = {
        ...(Object.keys(profile).length > 0 ? { profile } : {}),
        ...(Object.keys(tags).length > 0 ? { tags } : {}),
        risks: completeRiskRows(blocks.risks).map((r) => ({
            affected: r.affected,
            risk: r.risk,
            source: r.source,
            vulnerability: r.vulnerability,
            consequence: r.consequence,
            impactAreas: [...r.impactAreas],
            control: r.control,
            followUpControl: r.followUpControl,
            sourceTerm: r.sourceTerm,
            consequenceTerm: r.consequenceTerm,
            impactTerm: r.impactTerm,
            controlTerm: r.controlTerm,
            followUpControlTerm: r.followUpControlTerm,
        })),
    };
    return out;
}

/** Split a loaded answers payload back into prose answers and blocks. */
export function splitBlocksFromAnswers(answers: Record<string, Json>): {
    answers: Record<string, Json>;
    blocks: QualificationBlocks;
} {
    const { [BLOCKS_KEY]: rawBlocks, ...rest } = answers;
    const blocks = emptyBlocks();
    const record = asRecord(rawBlocks);
    if (record) {
        const profile = asRecord(record['profile']);
        if (profile) {
            for (const k of ['description', 'targetUseCase', 'targetUsers', 'intendedDeployers'] as const) {
                if (typeof profile[k] === 'string') blocks.profile[k] = profile[k] as string;
            }
        }
        const tags = asRecord(record['tags']);
        if (tags) {
            for (const k of ['targetSystem', 'sector', 'marketForm', 'locality'] as const) {
                blocks.tags[k] = nonEmptyStrings(tags[k]);
            }
        }
        if (Array.isArray(record['risks'])) {
            for (const item of record['risks']) {
                const row = asRecord(item);
                if (!row) continue;
                const text = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : '');
                blocks.risks.push({
                    affected: text('affected'),
                    risk: text('risk'),
                    source: text('source'),
                    vulnerability: text('vulnerability'),
                    consequence: text('consequence'),
                    impactAreas: nonEmptyStrings(row['impactAreas']),
                control: text('control'),
                followUpControl: text('followUpControl'),
                sourceTerm: text('sourceTerm'),
                consequenceTerm: text('consequenceTerm'),
                impactTerm: text('impactTerm'),
                controlTerm: text('controlTerm'),
                followUpControlTerm: text('followUpControlTerm'),
                });
            }
        }
    }
    return { answers: rest, blocks };
}

/** The VAIR term lists for the qualification form, per AIRO class.
 *  {} when the service is unavailable: the form then offers free text. */
export async function listQualificationVocabularies(
    pid: string,
): Promise<Record<string, string[]>> {
    try {
        const vocab = await request<Record<string, string[]>>(
            `/projects/${pid}/qualification/vocabularies`,
        );
        if (typeof vocab !== 'object' || vocab === null || Array.isArray(vocab)) return {};
        const out: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(vocab)) {
            if (Array.isArray(v)) out[k] = v.filter((t): t is string => typeof t === 'string');
        }
        return out;
    } catch {
        return {};
    }
}
/** Version-gutter entries for a questionnaire's revision chain. */
export function questionnaireVersionEntries(versions: QuestionnaireVersion[]): {
    id: string;
    label: string;
}[] {
    return versions.map((v) => ({ id: String(v.number), label: `v${v.number}` }));
}

export function hasAnswers(answers: Record<string, Json> | null | undefined): boolean {
    const filled = (v: Json): boolean => {
        if (v === null || v === undefined || v === false) return false;
        if (typeof v === 'string') return v.trim() !== '';
        if (Array.isArray(v)) return v.some(filled);
        if (typeof v === 'object') return Object.values(v).some(filled);
        return true;
    };
    return Object.values(answers ?? {}).some(filled);
}

/** Version-gutter entries for a qualification's chain (draft + completions + edits). */
export function qualificationVersionEntries(chain: Qualification[]): {
    id: string;
    label: string;
}[] {
    return chain.map((q) =>
        q.system_version
            ? { id: q.pid, label: `v${q.system_version.number}` }
            : { id: q.pid, label: 'draft' },
    );
}

/** One answerable question from a service-style definition. */
export interface AnswerableQuestion {
    field: string;
    text: string;
    citation: string;
    required: boolean;
}

/** Pull per-question fields out of a service-style definition (questions
array with field/text); null for opaque backend definitions, which keep the
JSON editor. */
export function answerableQuestions(definition: Record<string, Json>): AnswerableQuestion[] | null {
    const raw = definition['questions'];
    if (!Array.isArray(raw)) return null;
    const out: AnswerableQuestion[] = [];
    for (const item of raw) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
        const record = item as Record<string, Json>;
        if (typeof record['field'] !== 'string' || typeof record['text'] !== 'string') return null;
        out.push({
            field: record['field'],
            text: record['text'],
            citation: typeof record['citation'] === 'string' ? record['citation'] : '',
            required: record['required'] === true,
        });
    }
    return out;
}

/** Parse an imported questionnaire file: {name?, definition}. */
export function parseQuestionnaireImport(text: string): {
    name: string;
    definition: Record<string, Json>;
} {
    const raw = JSON.parse(text) as Record<string, Json>;
    const definition =
        raw['definition'] && typeof raw['definition'] === 'object' && !Array.isArray(raw['definition'])
            ? (raw['definition'] as Record<string, Json>)
            : (raw as Record<string, Json>);
    const name = typeof raw['name'] === 'string' && raw['name'] ? raw['name'] : 'Imported questionnaire';
    return { name, definition };
}

/** --- Step 1: pre-filling the form from an uploaded document -----------------
 *
 * The backend reads the document with text rules (no model) and *proposes*
 * answers; nothing is stored, so the person accepts, edits or rejects each one.
 */

export interface PrefillSuggestion {
    field: string;
    value: string;
    line: number;
    matched: string;
}

export interface PrefillResult {
    filename: string;
    characters: number;
    proposals: PrefillSuggestion[];
    unmatched: string[];
    /** set when the questionnaire has no answerable questions to fill */
    note: string;
}

/** The error line a refusing backend sends (`{"detail": ...}`). */
async function failure(res: Response, fallback: string): Promise<Error> {
    try {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body.detail === 'string' && body.detail) return new Error(body.detail);
    } catch {
        /* not JSON: keep the fallback */
    }
    return new Error(fallback);
}

export async function prefillQualification(
    pid: string,
    file: File,
    questionnaireId?: string,
): Promise<PrefillResult> {
    const form = new FormData();
    form.append('file', file);
    const query = questionnaireId ? `?questionnaire_id=${encodeURIComponent(questionnaireId)}` : '';
    const res = await fetch(`${API_URL}/projects/${pid}/qualification/prefill${query}`, {
        method: 'POST',
        body: form,
    });
    if (res.status === 415) throw await failure(res, 'that file could not be read');
    if (!res.ok) throw await failure(res, `request failed: ${res.status}`);
    return (await res.json()) as PrefillResult;
}

export type PrefillMode = 'empty' | 'replace';

/** The answers after taking `proposals`: `empty` fills blanks only, `replace`
 *  overwrites what is there. Answers the person typed into fields the document
 *  says nothing about are always kept. */
export function applyPrefill(
    answers: Record<string, string>,
    proposals: PrefillSuggestion[],
    mode: PrefillMode,
): Record<string, string> {
    const out = { ...answers };
    for (const proposal of proposals) {
        const current = (out[proposal.field] ?? '').trim();
        if (mode === 'empty' && current !== '') continue;
        out[proposal.field] = proposal.value;
    }
    return out;
}

/** --- The card agent ---------------------------------------------------------
 *
 * It answers about the card and *proposes* node corrections, each quoting the
 * person's words or the card. Nothing is stored: applying one goes through the
 * existing node-correction endpoint.
 */

export interface CardAgentProposal {
    node_id: string;
    property: string;
    value: string;
    quote: string;
    reason: string;
}

export interface CardAgentTurn {
    text: string;
    proposals: CardAgentProposal[];
    dropped: { node_id?: string | null; reason: string }[];
    card: Record<string, Json>;
}

export async function askCardAgent(
    pid: string,
    qualificationPid: string,
    message: string,
): Promise<CardAgentTurn> {
    const res = await fetch(
        `${API_URL}/projects/${pid}/qualification/${qualificationPid}/agent`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        },
    );
    if (res.status === 503) {
        throw await failure(res, 'no model is configured for the card agent');
    }
    if (!res.ok) throw await failure(res, `request failed: ${res.status}`);
    return (await res.json()) as CardAgentTurn;
}

/** --- The card's components and the engine's -------------------------------- */

export interface CardComponentLink {
    component_key: string;
    name: string;
    component_type: string;
    role: string;
    engine_component_pid: string;
    snapshot: Record<string, Json>;
    changed: boolean;
    missing: boolean;
    captured_at: string;
}

export function listCardComponents(
    pid: string,
    qualificationPid: string,
): Promise<CardComponentLink[]> {
    return request<CardComponentLink[]>(
        `/projects/${pid}/qualification/${qualificationPid}/card-components`,
    );
}

/** How one card component stands against the engine: the flag the system page
 *  shows, or null when there is nothing to say. */
export function componentFlag(
    link: CardComponentLink,
): { label: string; tone: 'warning' | 'info' } | null {
    if (link.missing) return { label: 'not in the engine', tone: 'info' };
    if (link.changed) return { label: 'changed in the engine since', tone: 'warning' };
    return null;
}

/** --- The risk mapper ("Suggest with AI") ----------------------------------- */

export interface MappingSuggestion {
    attempts: number;
    created: ObjectiveMapping[];
    dropped: { risk: string | null; objective_id: string | null; reason: string }[];
}

/** Ask the project's model which profile objectives mitigate each unlinked risk.
 *  Every proposal quotes the risk's chain; with no model configured the backend
 *  answers 503. */
export async function suggestMappings(
    pid: string,
    alsoReplaceManual = false,
): Promise<MappingSuggestion> {
    const res = await fetch(
        `${API_URL}/projects/${pid}/control-objectives/risks/mappings/suggest`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ also_replace_manual: alsoReplaceManual }),
        },
    );
    if (res.status === 503) {
        throw await failure(res, 'no model is configured for the risk mapper');
    }
    if (!res.ok) throw await failure(res, `request failed: ${res.status}`);
    return (await res.json()) as MappingSuggestion;
}

/** The plain-language line for a mapper run: what it linked and what it let go. */
export function describeSuggestion(result: MappingSuggestion): string {
    const linked = result.created.length;
    const dropped = result.dropped.length;
    const runs = `${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`;
    if (linked === 0 && dropped === 0) return `Nothing to link (${runs}).`;
    const parts = [`Linked ${linked}`];
    if (dropped > 0) parts.push(`left ${dropped} unlinked`);
    return `${parts.join(', ')} in ${runs}.`;
}

/** --- The two built-in objective profiles ----------------------------------- */

export interface BuiltinProfile {
    key: string;
    name: string;
    description: string;
    objectives: string[];
}

export interface BuiltinProfiles {
    profiles: BuiltinProfile[];
    current: string;
    current_name: string;
    selected: string[];
}

export function listObjectiveProfiles(pid: string): Promise<BuiltinProfiles> {
    return request<BuiltinProfiles>(`/projects/${pid}/control-objectives/profiles`);
}

/** Switch to a built-in profile; its objectives become the profile's. */
export function chooseBuiltinProfile(
    pid: string,
    key: string,
    name = '',
): Promise<ObjectiveProfile> {
    return request<ObjectiveProfile>(`/projects/${pid}/control-objectives/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name, profile_key: key, key_objectives: [] }),
    });
}

/** --- A project's own objective set ---------------------------------------- */

export interface ObjectiveSetRow {
    objective_id: string;
    macro_requirement: string;
    text: string;
    legal_basis: string;
    sub_requirement_label: string;
    assessment_mode: string;
    target: string;
    standards_grounding: string;
    grounding_tier_flag: string;
    notes: string;
}

export interface ObjectiveSetVersion {
    number: number;
    objectives: ObjectiveSetRow[];
    created_by: string;
    created_at: string;
}

export interface ObjectiveSet {
    pid: string;
    name: string;
    code_prefix: string;
    draft: ObjectiveSetRow[];
    published_version: number | null;
    versions: ObjectiveSetVersion[];
}

/** One field of one row that differs between two versions of a set. */
export interface ObjectiveSetFieldChange {
    field: string;
    before: string;
    after: string;
}

export interface ObjectiveSetChangedRow {
    objective_id: string;
    fields: ObjectiveSetFieldChange[];
}

/** What changed between two versions: a published one, or the draft (null). */
export interface ObjectiveSetDiff {
    from_version: number | null;
    to_version: number | null;
    added: string[];
    removed: string[];
    changed: ObjectiveSetChangedRow[];
    unchanged: string[];
}

/**
 * The history view: what changed between two versions of a set. With no version
 * numbers given the backend compares the **last published version with the draft**
 * — the question someone editing a set is actually asking.
 */
export function getObjectiveSetDiff(
    pid: string,
    setPid: string,
    opts: { fromVersion?: number; toVersion?: number } = {},
): Promise<ObjectiveSetDiff> {
    const query = new URLSearchParams();
    if (opts.fromVersion !== undefined) query.set('from_version', String(opts.fromVersion));
    if (opts.toVersion !== undefined) query.set('to_version', String(opts.toVersion));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ObjectiveSetDiff>(`/projects/${pid}/objective-sets/${setPid}/diff${suffix}`);
}

/** "text, target" — the fields a changed row moved, as a line a person reads. */
export function describeSetDiff(diff: ObjectiveSetDiff): string {
    const parts: string[] = [];
    if (diff.added.length) parts.push(`+${diff.added.join(', +')}`);
    if (diff.removed.length) parts.push(`−${diff.removed.join(', −')}`);
    for (const row of diff.changed) {
        parts.push(`${row.objective_id}: ${row.fields.map((f) => f.field).join(', ')}`);
    }
    return parts.length ? parts.join(' · ') : 'no change';
}

export function listObjectiveSets(pid: string): Promise<ObjectiveSet[]> {
    return request<ObjectiveSet[]>(`/projects/${pid}/objective-sets`);
}

export function createObjectiveSet(
    pid: string,
    data: { name: string; code_prefix?: string; draft?: ObjectiveSetRow[] },
): Promise<ObjectiveSet> {
    return request<ObjectiveSet>(`/projects/${pid}/objective-sets`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function updateObjectiveSet(
    pid: string,
    setPid: string,
    data: { name: string; code_prefix?: string; draft?: ObjectiveSetRow[] },
): Promise<ObjectiveSet> {
    return request<ObjectiveSet>(`/projects/${pid}/objective-sets/${setPid}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/** Freeze the draft as the next numbered version; an old version is never edited. */
export function publishObjectiveSet(pid: string, setPid: string): Promise<ObjectiveSet> {
    return request<ObjectiveSet>(`/projects/${pid}/objective-sets/${setPid}/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

/** Copy a published version into the project's own objectives and select it. */
export function applyObjectiveSet(
    pid: string,
    setPid: string,
    number?: number,
): Promise<{ created: string[]; updated: string[]; selected: string[]; number: number }> {
    return request(`/projects/${pid}/objective-sets/${setPid}/apply`, {
        method: 'POST',
        body: JSON.stringify({ number: number ?? null }),
    });
}

export function deleteObjectiveSet(pid: string, setPid: string): Promise<void> {
    return request<void>(`/projects/${pid}/objective-sets/${setPid}`, { method: 'DELETE' });
}

/** A set's draft rows for a new set built from the catalogue's own objectives. */
export function setRowsFromCatalogue(items: ObjectiveCatalogueItem[]): ObjectiveSetRow[] {
    return items.map((item) => ({
        objective_id: item.id,
        macro_requirement: item.macro_requirement ?? '',
        text: item.text ?? '',
        legal_basis: item.legal_basis ?? '',
        sub_requirement_label: item.sub_requirement_label ?? '',
        assessment_mode: item.assessment_mode ?? '',
        target: '',
        standards_grounding: '',
        grounding_tier_flag: '',
        notes: '',
    }));
}
