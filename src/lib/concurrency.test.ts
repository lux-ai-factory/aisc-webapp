import { afterEach, expect, it, vi } from 'vitest';
import { createLimiter, settledValues } from './concurrency';

afterEach(() => vi.useRealTimers());
it('bounds parallel work and preserves order for different completion times', async () => {
    vi.useFakeTimers();
    const schedule = createLimiter(2);
    let active = 0;
    let peak = 0;
    const jobs = [40, 10, 10, 10].map((delay, index) => schedule(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, delay));
        active--;
        return index;
    }));
    const result = settledValues(jobs);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
    expect(active).toBe(0);
});
it('drains in-flight jobs before reporting a failure and releases slots', async () => {
    vi.useFakeTimers();
    const schedule = createLimiter(2);
    let finished = false;
    const result = settledValues([
        schedule(async () => { throw new Error('upload failed'); }),
        schedule(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); finished = true; }),
    ]);
    const failure = expect(result).rejects.toThrow('upload failed');
    expect(finished).toBe(false);
    await vi.runAllTimersAsync();
    await failure;
    expect(finished).toBe(true);
    expect(await schedule(async () => 'retry')).toBe('retry');
});
it.each([2, 4])('finishes eight simulated jobs faster than serial at concurrency %s', async (limit) => {
    vi.useFakeTimers();
    const start = Date.now();
    const schedule = createLimiter(limit);
    const result = settledValues(Array.from({ length: 8 }, (_, index) => schedule(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return index;
    })));
    await vi.runAllTimersAsync();
    expect(await result).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Date.now() - start).toBe(1600 / limit);
});
