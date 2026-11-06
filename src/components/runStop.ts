// The progress bar's title for a run (its name, given at launch or afterwards) and its Stop button's call. The
// engine decides what stopping does (POST /evaluations/{pid}/stop): unfinished tests failed as stopped by a person,
// the worker told to end them.

// any run as the engine lists it: its plugin runs carry run_name, which the webapp's models do not declare
type NamedRun = { evaluation_plugins?: ReadonlyArray<object> | null };

/** The run's name, or "Evaluation Progress" when it has none. */
export function progressTitle(evaluation: NamedRun): string {
    const named = (evaluation.evaluation_plugins || [])
        .map((p) => String((p as { run_name?: unknown }).run_name ?? '').trim()).find(Boolean);
    return named || 'Evaluation Progress';
}

/** Stops a run; answers its new status, or throws with the engine's reason. */
export async function stopRun(apiUrl: string, evaluationPid: string): Promise<string> {
    const res = await fetch(`${apiUrl}/evaluations/${evaluationPid}/stop`, { method: 'POST' });
    if (!res.ok) {
        let reason = 'The run could not be stopped';
        try {
            const body = await res.json();
            if (typeof body?.detail === 'string') reason = body.detail;
        } catch { /* no body: the general reason */ }
        throw new Error(reason);
    }
    return ((await res.json()) as { status: string }).status;
}
