// The progress bar's title for a run (its name, given at launch or afterwards) and its Stop button's call. The
// engine decides what stopping does (POST /evaluations/{pid}/stop): unfinished tests failed as stopped by a person,
// the worker told to end them. A run's name and the engine's refusals are read as pages/runName.ts reads them.
import { engineError, runName } from '../pages/runName';

/** The run's name, or "Evaluation Progress" when it has none. */
export function progressTitle(evaluation: Parameters<typeof runName>[0]): string {
    return runName(evaluation) || 'Evaluation Progress';
}

/** Stops a run; answers its new status, or throws with the engine's reason. */
export async function stopRun(apiUrl: string, evaluationPid: string): Promise<string> {
    const res = await fetch(`${apiUrl}/evaluations/${evaluationPid}/stop`, { method: 'POST' });
    if (!res.ok) throw await engineError(res, 'The run could not be stopped');
    return ((await res.json()) as { status: string }).status;
}
