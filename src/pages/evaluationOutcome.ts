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
        return errorMessage;
    }
    if (!Array.isArray(detail) || detail.length === 0) return errorMessage;
    return (detail as EngineProblem[]).map((p) => {
        const loc = Array.isArray(p.loc) ? p.loc : [];
        const index = loc.find((part) => typeof part === 'number');
        const field = loc.length ? String(loc[loc.length - 1]) : '';
        const where = [index !== undefined ? `measure ${index}` : '', field].filter(Boolean).join(', ');
        return where ? `${where}: ${p.msg ?? ''}` : (p.msg ?? '');
    }).join('\n');
}
