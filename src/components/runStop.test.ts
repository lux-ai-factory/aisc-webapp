// The progress bar titles each run with its name and offers to stop it (runStop.ts does the call).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { progressTitle, stopRun } from './runStop';

describe('the title of a run in the progress bar', () => {
    it('is the run name when the run has one', () => {
        expect(progressTitle({ evaluation_plugins: [{ run_name: ' GENDER on local ' }] })).toBe('GENDER on local');
    });

    it('is "Evaluation Progress" when the run has no name, as before', () => {
        expect(progressTitle({ evaluation_plugins: [{ run_name: '' }] })).toBe('Evaluation Progress');
        expect(progressTitle({})).toBe('Evaluation Progress');
    });
});

describe('stopping a run', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('posts to the run and answers its new status', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pid: 'e1', status: 'Failed' }) });
        vi.stubGlobal('fetch', fetchMock);
        expect(await stopRun('http://api', 'e1')).toBe('Failed');
        expect(fetchMock).toHaveBeenCalledWith('http://api/evaluations/e1/stop', { method: 'POST' });
    });

    it('says why when the engine refuses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false, status: 409, json: async () => ({ detail: 'The run has already ended (Done)' }) }));
        await expect(stopRun('http://api', 'e1')).rejects.toThrow('already ended');
    });

    it('gives a general reason when the engine says nothing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error(); } }));
        await expect(stopRun('http://api', 'e1')).rejects.toThrow('could not be stopped');
    });
});

describe('the progress bar', () => {
    const bar = readFileSync(join(__dirname, 'EvaluationProgressList.tsx'), 'utf8');

    it('titles each run with progressTitle', () => {
        expect(bar).toContain('progressTitle(evaluation)');
        expect(bar).not.toMatch(/>\s*Evaluation Progress\s*</);
    });

    it('offers Stop, asks to confirm on the page and calls stopRun', () => {
        expect(bar).toMatch(/>\s*Stop\s*</);
        expect(bar).toContain('stopRun(');
        expect(bar).toMatch(/Stop this run\?/);
        expect(bar).not.toMatch(/window\.confirm|\bconfirm\(/);
    });
});
