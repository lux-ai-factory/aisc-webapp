// @vitest-environment jsdom
// Deleting a component asks first. A change the engine refuses, or a file it could not store, is said with the
// engine's reason, and the dialog stays open with what was typed: nothing closes as if it had been saved.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AISystemSettings from './AISystemSettings';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PID = '11111111-2222-4333-8444-555555555555';
let calls: { url: string; method: string }[] = [];
let patchAnswer: Response;
let uploadAnswer: Response;
let createAnswer: Response;

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

beforeEach(() => {
    vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
    calls = [];
    patchAnswer = { ok: true, status: 200, json: async () => ({}) } as Response;
    uploadAnswer = { ok: true, status: 200, json: async () => ({}) } as Response;
    createAnswer = { ok: true, status: 200, json: async () => ({ pid: 'c-new' }) } as Response;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input), method = init?.method ?? 'GET';
        calls.push({ url, method });
        if (method === 'DELETE') return { ok: true, status: 204, json: async () => null } as Response;
        if (method === 'PATCH') return patchAnswer;
        if (method === 'PUT') return uploadAnswer;
        if (method === 'POST' && url.endsWith('/components')) return createAnswer;
        if (url.includes('/aisystem')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'sys-1', name: 'System',
                    components: [
                        { pid: 'c-1', name: 'Mijke openings', component_type: 'dataset', data: 'openings.csv', retired_at: null },
                    ],
                }),
            } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
    });
});

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

async function render() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        createRoot(container).render(
            <ProjectProvider><ProjectUUIDSetter uuid={PID} /><AISystemSettings /></ProjectProvider>);
    });
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    return container;
}

const button = (root: ParentNode, label: RegExp) =>
    [...root.querySelectorAll('button')].find(b => label.test(b.textContent ?? '') || label.test(b.getAttribute('aria-label') ?? '')) as HTMLElement;

const pause = () => act(async () => { await new Promise(r => setTimeout(r, 50)); });

/** Opens Edit on the dataset, attaches a new file and presses Save. */
async function editWithNewFile(page: HTMLElement) {
    await act(async () => { button(page, /Edit Mijke openings/).click(); });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['language,message\nen,Hello.\n'], 'openings-v2.csv', { type: 'text/csv' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { button(dialog, /^Save/).click(); });
    await pause();
}

it('Delete asks before anything is deleted', async () => {
    // a confirm the person dismisses, in whatever form the page asks
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const page = await render();
    await act(async () => { button(page, /Delete Mijke openings/).click(); });
    await pause();
    expect(calls.filter(c => c.method === 'DELETE'), 'no delete sent on one click').toEqual([]);
});

it("a refused edit shows the engine's reason and keeps the dialog open", async () => {
    patchAnswer = { ok: false, status: 400, json: async () => ({ detail: "names another project's target" }) } as Response;
    const page = await render();
    await editWithNewFile(page);
    expect(document.querySelector('[role="dialog"]'), 'the dialog stays open').not.toBeNull();
    expect(document.body.textContent).toContain("names another project's target");
});

it('a file the engine could not store is said, and the dialog does not close as saved', async () => {
    uploadAnswer = { ok: false, status: 500, json: async () => ({ detail: 'Failed to upload file' }) } as Response;
    const page = await render();
    await editWithNewFile(page);
    expect(calls.some(c => c.method === 'PUT' && c.url.includes('/components/c-1/data'))).toBe(true);
    expect(document.querySelector('[role="dialog"]'), 'the dialog stays open').not.toBeNull();
    expect(document.body.textContent).toContain('Failed to upload file');
});

it("a refused new component shows the engine's reason and keeps the dialog open", async () => {
    createAnswer = { ok: false, status: 400, json: async () => ({ detail: "names another project's target" }) } as Response;
    const page = await render();
    await act(async () => { button(page, /^Add (test data|component)/).click(); });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const name = [...dialog.querySelectorAll('label')].find(l => l.textContent?.startsWith('Name'))
        ?.parentElement?.querySelector('input') as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'organisations');
        name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [new File(['name\nGGD\n'], 'organisations.csv', { type: 'text/csv' })] });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { button(dialog, /^Add$/).click(); });
    await pause();
    expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/components')), 'the add was sent').toBe(true);
    expect(document.querySelector('[role="dialog"]'), 'the dialog stays open').not.toBeNull();
    expect(document.body.textContent).toContain("names another project's target");
});
