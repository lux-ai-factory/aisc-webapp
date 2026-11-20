import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evalTitle, listAllRuns, runStatusColor, SandboxRun, sortRunsNewest } from './sandbox';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('listAllRuns', () => {
    it('fetches every evaluation without a status filter', async () => {
        const fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => [{ pid: 'e1', status: 'Done' }],
        });
        vi.stubGlobal('fetch', fetch);
        const runs = await listAllRuns('p1');
        expect(runs).toEqual([{ pid: 'e1', status: 'Done' }]);
        const [url] = fetch.mock.calls[0] as [string];
        expect(url).toContain('/projects/p1/evaluations');
        expect(url).not.toContain('status=');
    });

    it('throws on HTTP errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
        );
        await expect(listAllRuns('p1')).rejects.toThrow('404');
    });
});

describe('sortRunsNewest', () => {
    it('orders newest first, dateless last', () => {
        const runs: SandboxRun[] = [
            { pid: 'old', status: 'Done', created_at: '2026-01-01T00:00:00Z' },
            { pid: 'new', status: 'Done', created_at: '2026-10-01T00:00:00Z' },
            { pid: 'nodate', status: 'Running' },
        ];
        expect(sortRunsNewest(runs).map((r) => r.pid)).toEqual(['new', 'old', 'nodate']);
    });
});

describe('runStatusColor', () => {
    it('maps statuses to chip colors', () => {
        expect(runStatusColor('Done')).toBe('success');
        expect(runStatusColor('Failed')).toBe('error');
        expect(runStatusColor('Processing')).toBe('info');
        expect(runStatusColor('Archived')).toBe('default');
    });
});

describe('evalTitle', () => {
    it('renders "Name (short uuid)" when a name is set', () => {
        expect(evalTitle({ pid: 'abcdef123456', name: 'Accuracy sweep' })).toBe('Accuracy sweep (abcdef12)');
    });

    it('falls back to just the short uuid when no name is set', () => {
        expect(evalTitle({ pid: 'abcdef123456' })).toBe('abcdef12');
    });
});
