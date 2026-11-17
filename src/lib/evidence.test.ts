import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEvidenceMap, putEvidenceLinks, reviewEvidenceMap } from './evidence';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('evidence client', () => {
    it('reads the map for a version', async () => {
        const seen: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string) => {
                seen.push(url);
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ version: null }) });
            }),
        );
        await getEvidenceMap('p1', 'v0');
        expect(seen[0]).toContain('/projects/p1/evidence?version=v0');
    });

    it('puts the whole link set for a version', async () => {
        const calls: { url: string; init?: RequestInit }[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push({ url, init });
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ links: [] }) });
            }),
        );
        await putEvidenceLinks('p1', 'v1', [
            { objective_id: 'O1', kind: 'test', key: 'fairness', note: 'holds' },
            { objective_id: 'O1', kind: 'control', key: 'cl1' },
        ]);
        expect(calls[0].url).toContain('/projects/p1/evidence/links');
        expect(calls[0].init?.method).toBe('PUT');
        const body = JSON.parse(String(calls[0].init?.body));
        expect(body.version).toBe('v1');
        expect(body.links).toEqual([
            { objective_id: 'O1', kind: 'test', key: 'fairness', note: 'holds' },
            { objective_id: 'O1', kind: 'control', key: 'cl1', note: null },
        ]);
    });

    it('surfaces a refusal detail', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
                json: async () => ({ detail: 'an older version\u2019s map is kept as it was' }),
            }),
        );
        await expect(reviewEvidenceMap('p1', 'v0')).rejects.toThrow('kept as it was');
    });
});
