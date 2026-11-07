// A run can be named at launch and renamed afterwards; the results list shows the name (runName.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { engineError, launchBody, renameRun, runName, runTitle } from './runName';

describe('the title a run card shows', () => {
    it('is the run name when the run has one', () => {
        expect(runTitle({ evaluation_plugins: [{ run_name: 'Mijke on OpenAI' }] })).toBe('Mijke on OpenAI');
    });

    it('is "Results" when the run has no name, as before', () => {
        expect(runTitle({ evaluation_plugins: [{ run_name: '' }] })).toBe('Results');
        expect(runTitle({ evaluation_plugins: [] })).toBe('Results');
        expect(runTitle({})).toBe('Results');
    });
});

describe('the name a run is stored under', () => {
    it('is the name even when the name is "Results", the title of a run with none', () => {
        expect(runName({ evaluation_plugins: [{ run_name: 'Results' }] })).toBe('Results');
    });

    it('is empty when the run has the automatic name', () => {
        expect(runName({ evaluation_plugins: [{ run_name: '' }, { run_name: null }] })).toBe('');
        expect(runName({})).toBe('');
    });
});

describe("the reason an engine refusal is shown with", () => {
    it("is the engine's detail when it gives one", async () => {
        const res = { ok: false, json: async () => ({ detail: 'The run has already ended (Done)' }) } as Response;
        expect((await engineError(res, 'The run could not be stopped')).message).toBe('The run has already ended (Done)');
    });

    it('is the general reason when the answer has no detail or no body', async () => {
        const noDetail = { ok: false, json: async () => ({}) } as Response;
        const noBody = { ok: false, json: async () => { throw new Error('no json'); } } as unknown as Response;
        expect((await engineError(noDetail, 'general')).message).toBe('general');
        expect((await engineError(noBody, 'general')).message).toBe('general');
    });
});

describe('the name of a run as the engine lists it in progress', () => {
    it('is read from plugin runs the webapp models do not type', () => {
        const listed: ReadonlyArray<object> = [{ status: 'Running' }, { run_name: ' GENDER ' }];
        expect(runName({ evaluation_plugins: listed })).toBe('GENDER');
    });
});

describe('the launch request', () => {
    const plugins = [{ name: 'StrongRejectPlugin', package_name: 'pkg', inputs: [] }];

    it('carries the name, trimmed', () => {
        expect(launchBody('p1', plugins, '  Local, 4 Nov ')).toEqual(
            { project_pid: 'p1', plugins_to_run: plugins, name: 'Local, 4 Nov' });
    });

    it('carries an empty name when none is given', () => {
        expect(launchBody('p1', plugins, undefined).name).toBe('');
    });
});

describe('renaming a run', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('sends the name to the run and answers the name kept', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pid: 'e1', name: 'Local' }) });
        vi.stubGlobal('fetch', fetchMock);
        expect(await renameRun('http://api', 'e1', ' Local ')).toBe('Local');
        expect(fetchMock).toHaveBeenCalledWith('http://api/evaluations/e1/name', expect.objectContaining({
            method: 'PATCH', body: JSON.stringify({ name: ' Local ' }) }));
    });

    it('says why when the engine refuses', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false, status: 400, json: async () => ({ detail: "A run's name is at most 255 characters" }) }));
        await expect(renameRun('http://api', 'e1', 'x')).rejects.toThrow("at most 255 characters");
    });
});

describe('the pages', () => {
    const list = readFileSync(join(__dirname, 'PluginEvaluations.tsx'), 'utf8');
    const start = readFileSync(join(__dirname, 'PluginStartEvaluation.tsx'), 'utf8');

    it('the results list titles each run with its name and offers to rename it', () => {
        const rename = readFileSync(join(__dirname, '../components/RenameRun.tsx'), 'utf8');
        expect(list).toContain('runTitle(evaluation)');
        expect(list).toContain('<RenameRun');
        // the rename box opens on the stored name, not on the card's title
        expect(list).toContain('current={runName(evaluation)}');
        expect(rename).toContain('renameRun(');
        expect(rename).toMatch(/>\s*Rename\s*</);
    });

    it('the launch page asks for an optional name and sends it', () => {
        expect(start).toMatch(/label="Run name \(optional\)"/);
        expect(start).toContain('launchBody(');
    });
});
