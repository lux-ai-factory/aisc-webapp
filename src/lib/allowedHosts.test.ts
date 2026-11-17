import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { allowHost, getAllowedHosts, removeAllowedHost } from './allowedHosts';

beforeEach(() => {
    vi.unstubAllGlobals();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const recording = (payload: unknown, ok = true, status = 200) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            calls.push({ url, init });
            return Promise.resolve({ ok, status, json: async () => payload });
        }),
    );
    return calls;
};

describe('allowed internal hosts client', () => {
    it('reads the floor, the entries and whether this caller may manage them', async () => {
        const calls = recording({
            floor: ['10.0.0.5:8500'],
            entries: [
                {
                    host: 'box.local:8500',
                    note: 'MCAS-lite',
                    updated_at: '2026-11-17T09:25:00Z',
                    updated_by: 'development',
                    denied: null,
                },
            ],
            can_manage: true,
            rule: 'A connection may call any public address.',
        });

        const list = await getAllowedHosts('p1');

        expect(calls[0].url).toContain('/projects/p1/allowed-hosts');
        expect(calls[0].init).toBeUndefined();
        expect(list.floor).toEqual(['10.0.0.5:8500']);
        expect(list.entries[0].host).toBe('box.local:8500');
        expect(list.can_manage).toBe(true);
    });

    it('allows a host, keeping its port in the address', async () => {
        const calls = recording({ host: 'box.local:8500', note: 'MCAS-lite' });

        await allowHost('p1', 'box.local:8500', 'MCAS-lite');

        expect(calls[0].url).toContain('/projects/p1/allowed-hosts/box.local%3A8500');
        expect(calls[0].init?.method).toBe('PUT');
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({ note: 'MCAS-lite' });
    });

    it('sends null, not an empty string, when there is no note', async () => {
        const calls = recording({ host: 'box.local' });

        await allowHost('p1', 'box.local', '');

        expect(JSON.parse(String(calls[0].init?.body))).toEqual({ note: null });
    });

    it('withdraws a host', async () => {
        const calls = recording(null, true, 204);

        await removeAllowedHost('p1', 'box.local:8500');

        expect(calls[0].url).toContain('/projects/p1/allowed-hosts/box.local%3A8500');
        expect(calls[0].init?.method).toBe('DELETE');
    });

    it('carries the platform’s own words when a host is refused', async () => {
        recording({ detail: 'loopback addresses (the platform itself) can never be reached' }, false, 400);

        await expect(allowHost('p1', '127.0.0.1', '')).rejects.toThrow(/loopback/);
    });
});
