// @vitest-environment jsdom
// A run can be named at launch and renamed afterwards; the results list shows the name (runName.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RenameRun from '../components/RenameRun';
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
        expect(list).toContain('runTitle(evaluation)');
        expect(list).toContain('<RenameRun');
        // the rename box opens on the stored name, not on the card's title
        expect(list).toContain('current={runName(evaluation)}');
    });

    it('the launch page asks for an optional name and sends it', () => {
        expect(start).toMatch(/label="Run name \(optional\)"/);
        expect(start).toContain('launchBody(');
    });
});

describe('the Rename control on a run card', () => {
    let root: Root | null = null;
    let container: HTMLElement | null = null;
    afterEach(() => {
        act(() => root?.unmount());
        container?.remove();
        vi.unstubAllGlobals();
    });

    async function show(current: string, answer: { ok: boolean; body: unknown }) {
        const fetchMock = vi.fn(async () => ({ ok: answer.ok, status: answer.ok ? 200 : 400,
                                               json: async () => answer.body }) as Response);
        vi.stubGlobal('fetch', fetchMock);
        const onRenamed = vi.fn();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root!.render(createElement(RenameRun, { apiUrl: 'http://api', evaluationPid: 'e1', current, onRenamed }));
        });
        return { fetchMock, onRenamed };
    }

    const button = (text: string) =>
        [...container!.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
    const press = async (text: string) => {
        await act(async () => { button(text)!.click(); });
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };
    const field = () => container!.querySelector('input') as HTMLInputElement | null;
    const type = async (value: string) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        await act(async () => {
            set.call(field(), value);
            field()!.dispatchEvent(new Event('input', { bubbles: true }));
        });
    };

    it('opens on the current name, saves the new one and asks for the runs again', async () => {
        const { fetchMock, onRenamed } = await show('Results', { ok: true, body: { pid: 'e1', name: 'Local' } });
        expect(field()).toBeNull();
        await press('Rename');
        expect(field()?.value).toBe('Results');
        await type('Local');
        await press('Save');
        expect(fetchMock).toHaveBeenCalledWith('http://api/evaluations/e1/name', expect.objectContaining({
            method: 'PATCH', body: JSON.stringify({ name: 'Local' }) }));
        expect(onRenamed).toHaveBeenCalledOnce();
        expect(field()).toBeNull();
        expect(button('Rename')).toBeDefined();
    });

    it('Cancel closes the box without saving', async () => {
        const { fetchMock, onRenamed } = await show('Old', { ok: true, body: {} });
        await press('Rename');
        await type('New');
        await press('Cancel');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(onRenamed).not.toHaveBeenCalled();
        expect(field()).toBeNull();
    });

    it("keeps the box open with the engine's reason when it refuses", async () => {
        const { onRenamed } = await show('Old', { ok: false, body: { detail: "A run's name is at most 255 characters" } });
        await press('Rename');
        await press('Save');
        expect(container!.textContent).toContain("A run's name is at most 255 characters");
        expect(field()?.value).toBe('Old');
        expect(onRenamed).not.toHaveBeenCalled();
    });
});
