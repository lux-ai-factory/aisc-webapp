import { afterEach, expect, it, vi } from 'vitest';
import { fetchDashboard, saveDashboard, scheduleDashboardSave, flushDashboardSave } from './dashboardStorage';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('loads shared state and sends its revision with saves', async () => {
    const state = { widgets: [], layouts: {}, revision: 4, can_edit: true };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => state });
    vi.stubGlobal('fetch', fetch);
    expect(await fetchDashboard('project')).toEqual(state);
    await saveDashboard('project', { widgets: [], layouts: {} }, 4);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ widgets: [], layouts: {}, revision: 4 });
});
it('reports revision conflicts instead of overwriting shared state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    await expect(saveDashboard('project', { widgets: [], layouts: {} }, 0)).rejects.toThrow('another session');
});

it('flushes the latest edit before an immediate read, without waiting for debounce', async () => {
    vi.useFakeTimers();
    const saved = { widgets: [{ key: 'note', kind: 'text' as const, text: 'latest' }], layouts: {} };
    const response = { ...saved, revision: 1, can_edit: true };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetch);
    const first = scheduleDashboardSave('flush', { widgets: [], layouts: {} }, 0);
    const latest = scheduleDashboardSave('flush', saved, 0);
    expect(first).toBe(latest);
    expect(fetch).not.toHaveBeenCalled();
    expect(await fetchDashboard('flush')).toEqual(response);
    await latest;
    expect(fetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[0][1].body).widgets).toEqual(saved.widgets);
    expect(fetch.mock.calls[1][1]).toBeUndefined();
});

it('flushes departing projects independently and serializes overlapping saves', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/departing/')) await blocked;
        const revision = JSON.parse(String(init?.body)).revision + 1;
        return { ok: true, json: async () => ({ widgets: [], layouts: {}, revision, can_edit: true }) };
    });
    vi.stubGlobal('fetch', fetch);
    const state = { widgets: [], layouts: {} };
    void scheduleDashboardSave('departing', state, 0);
    const departing = flushDashboardSave('departing');
    await Promise.resolve();
    const next = scheduleDashboardSave('departing', state, 0);
    const tail = flushDashboardSave('departing');
    const other = scheduleDashboardSave('other', state, 8);
    await flushDashboardSave('other');
    expect((await other).revision).toBe(9);
    release();
    await departing;
    await tail;
    expect((await next).revision).toBe(2);
    const revisions = fetch.mock.calls.filter(([url]) => url.includes('/departing/'))
        .map(([, init]) => JSON.parse(String(init?.body)).revision);
    expect(revisions).toEqual([0, 1]);
});
