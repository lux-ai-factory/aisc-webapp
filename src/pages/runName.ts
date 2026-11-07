// A run's name: given at launch, changed afterwards, shown as the run card's title, the progress bar's title and
// in the results dashboard (empty: the automatic name). The engine keeps it on each plugin run (run_name).

// any run as the engine lists it: its plugin runs carry run_name, which not every webapp model declares
type NamedRun = { evaluation_plugins?: ReadonlyArray<object> | null };

/** The name the run is stored under: the first non-empty run_name of its plugin runs, '' for the automatic one. */
export function runName(evaluation: NamedRun): string {
    return (evaluation.evaluation_plugins || [])
        .map((p) => String((p as { run_name?: unknown }).run_name ?? '').trim()).find(Boolean) ?? '';
}

/** The run card's title: the run's name, or "Results" when it has none. */
export function runTitle(evaluation: NamedRun): string {
    return runName(evaluation) || 'Results';
}

/** An engine refusal as an error: the engine's own reason (its detail) when it gives one, else `fallback`. */
export async function engineError(res: Response, fallback: string): Promise<Error> {
    try {
        const body = await res.json();
        if (typeof body?.detail === 'string') return new Error(body.detail);
    } catch { /* no body: the general reason */ }
    return new Error(fallback);
}

/** The launch request: the project, the plugins to run and the run's name (trimmed; empty when none). */
export function launchBody<T>(projectPid: string, pluginsToRun: T[], name: string | undefined) {
    return { project_pid: projectPid, plugins_to_run: pluginsToRun, name: (name || '').trim() };
}

/** Renames a run; answers the name the engine kept, or throws with the engine's reason. */
export async function renameRun(apiUrl: string, evaluationPid: string, name: string): Promise<string> {
    const res = await fetch(`${apiUrl}/evaluations/${evaluationPid}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw await engineError(res, 'The run could not be renamed');
    return ((await res.json()) as { name: string }).name;
}
