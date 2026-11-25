/** A limiter shared by every caller using the returned scheduler. */
export function createLimiter(concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid concurrency');
    let active = 0;
    const waiting: Array<() => void> = [];
    return <T>(task: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
        const start = () => {
            active++;
            void (async () => {
                try { resolve(await task()); }
                catch (error) { reject(error); }
                finally { active--; waiting.shift()?.(); }
            })();
        };
        if (active < concurrency) start();
        else waiting.push(start);
    });
}

/** Drain in-flight jobs before reporting a failure, preserving input order. */
export async function settledValues<T>(jobs: Promise<T>[]): Promise<T[]> {
    const results = await Promise.allSettled(jobs);
    return results.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
    });
}
