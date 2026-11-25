import { API_VERSION_PREFIX } from '../config';
import type { GridWidgetsState } from './dashboardCharts';

export interface SharedDashboard extends GridWidgetsState { revision: number; can_edit: boolean }
const cache = new Map<string, SharedDashboard>();
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; start: () => void;
    state: GridWidgetsState; promise: Promise<SharedDashboard> }>();
const writes = new Map<string, Promise<SharedDashboard>>();
const url = (pid: string) => `${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}/projects/${pid}/dashboard`;
export const cachedDashboard = (pid: string) => cache.get(pid);
export async function fetchDashboard(pid: string): Promise<SharedDashboard> {
    await flushDashboardSave(pid);
    const response = await fetch(url(pid));
    if (!response.ok) throw new Error('Could not load dashboard');
    const state = await response.json() as SharedDashboard;
    cache.set(pid, state);
    return state;
}

/** Debounce edits per project without tying their lifetime to a mounted page. */
export function scheduleDashboardSave(pid: string, state: GridWidgetsState, revision: number): Promise<SharedDashboard> {
    const previous = pending.get(pid);
    if (previous) {
        previous.state = state;
        clearTimeout(previous.timer);
        previous.timer = setTimeout(previous.start, 500);
        return previous.promise;
    }
    const before = writes.get(pid) ?? Promise.resolve();
    let start!: () => void;
    const promise = new Promise<SharedDashboard>((resolve, reject) => {
        start = () => {
            const job = pending.get(pid);
            if (!job || job.promise !== promise) return;
            clearTimeout(job.timer);
            pending.delete(pid);
            void before.then(() => saveDashboard(pid, job.state, cache.get(pid)?.revision ?? revision))
                .then(resolve, reject);
        };
    });
    pending.set(pid, { state, start, promise, timer: setTimeout(start, 500) });
    writes.set(pid, promise);
    const finished = () => { if (writes.get(pid) === promise) writes.delete(pid); };
    void promise.then(finished, finished);
    return promise;
}

export async function flushDashboardSave(pid: string): Promise<void> {
    const write = writes.get(pid);
    pending.get(pid)?.start();
    await write;
}
export async function saveDashboard(pid: string, state: GridWidgetsState, revision: number): Promise<SharedDashboard> {
    const response = await fetch(url(pid), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, revision }) });
    if (!response.ok) throw new Error(response.status === 409
        ? 'Dashboard changed in another session. Reload before saving.' : 'Could not save dashboard');
    const saved = await response.json() as SharedDashboard;
    cache.set(pid, saved);
    return saved;
}
