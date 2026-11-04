// What the Results page shows of a finished run, failed ones included (evaluationOutcome.test.ts).

/** The two reads of a project's finished runs: Done and Failed (never Archived, Pending or Processing). */
export function finishedEvaluationUrls(apiUrl: string, projectUuid: string): string[] {
    return ['Done', 'Failed'].map((status) => `${apiUrl}/projects/${projectUuid}/evaluations?status=${status}`);
}

/** The label a finished run's card gives its end. */
export function evaluationOutcome(evaluation: { status?: string }): 'Failed' | 'Finished' {
    return evaluation.status === 'Failed' ? 'Failed' : 'Finished';
}

type EngineProblem = { loc?: unknown[]; msg?: string };

/** A plugin run's error_message in words: the engine's validation answer one problem a line
 * ("measure 1, description: ..."), anything else as it is; null when there is none. */
export function pluginErrorText(errorMessage: string | null | undefined): string | null {
    if (!errorMessage) return null;
    let detail: unknown;
    try {
        detail = (JSON.parse(errorMessage) as { detail?: unknown }).detail;
    } catch {
        return failureReason(errorMessage);
    }
    if (!Array.isArray(detail) || detail.length === 0) return failureReason(errorMessage);
    return (detail as EngineProblem[]).map((p) => {
        const loc = Array.isArray(p.loc) ? p.loc : [];
        const index = loc.find((part) => typeof part === 'number');
        const field = loc.length ? String(loc[loc.length - 1]) : '';
        const where = [index !== undefined ? `measure ${index}` : '', field].filter(Boolean).join(', ');
        return where ? `${where}: ${p.msg ?? ''}` : (p.msg ?? '');
    }).join('\n');
}

/** How much of a failure a card shows: the run's log (a file of the run) has the rest. */
const REASON_MAX = 500;
const RUN_STEP = '====== Step 3: Plugin Run ======';
const EXCEPTION_CLASS = /^(?:\w+\.)*[A-Z]\w*: /;

/** A failure in a few words. A run stored before the worker kept only the plugin's reason has its whole log
 *  as its error ("Plugin failed: ====== Step 1 ..."): it reads as what the plugin said last in its run step,
 *  without the exception's class. Anything longer than REASON_MAX is cut. */
function failureReason(message: string): string {
    let text = message;
    const step = message.lastIndexOf(RUN_STEP);
    if (message.startsWith('Plugin failed:') && step >= 0) {
        const lines = message.slice(step + RUN_STEP.length).split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length) text = `Plugin failed: ${lines[lines.length - 1].replace(EXCEPTION_CLASS, '')}`;
    }
    return text.length <= REASON_MAX ? text : `${text.slice(0, REASON_MAX - 1)}…`;
}
