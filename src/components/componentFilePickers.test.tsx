// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AISystemSettings from './AISystemSettings';
import AddProjectWizard from './addProjectWizard';
import { ProjectProvider, useProject } from '../context/ProjectContext';

// Every picker that uploads a component file offers only the extensions the engine takes for
// that component's type; anything else the engine refuses with 415.

const DATASET = '.csv,.tsv,.parquet,.json,.jsonl,.zip';
const MODEL = '.onnx,.pkl,.joblib,.pt,.pth,.safetensors,.h5,.keras,.zip';
const PID = '11111111-2222-4333-8444-555555555555';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

beforeEach(() => {
    vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/aisystem')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'sys-1', name: 'System',
                    components: [
                        { pid: 'c-2', name: 'Weights', component_type: 'model', data: 'w.onnx' },
                        { pid: 'c-3', name: 'Holdout set', component_type: 'dataset', data: 'h.csv' },
                    ],
                }),
            } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
    });
});

const roots: Root[] = [];

afterEach(() => {
    act(() => { roots.splice(0).forEach(r => r.unmount()); });
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
});

async function mount(node: React.ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => { root.render(node); });
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    return container;
}

const button = (text: RegExp) =>
    [...document.querySelectorAll('button')].find(b => text.test(b.textContent ?? ''))!;
const filePicker = () =>
    document.querySelector<HTMLInputElement>('[role="dialog"] input[type="file"]')!;

async function chooseType(label: RegExp) {
    const select = document.querySelector('[role="dialog"] [role="combobox"]')!;
    await act(async () => { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    const option = [...document.querySelectorAll('[role="option"]')].find(o => label.test(o.textContent ?? ''))!;
    await act(async () => { (option as HTMLElement).click(); });
}

const settings = () => mount(
    <ProjectProvider>
        <ProjectUUIDSetter uuid={PID} />
        <AISystemSettings />
    </ProjectProvider>,
);

it('the add dialog offers a dataset only the engine\'s dataset extensions', async () => {
    await settings();
    await act(async () => { button(/Add (component|test data)/).click(); });
    await chooseType(/^Dataset/);
    expect(filePicker().accept).toBe(DATASET);
});

it('the add dialog offers a model only the engine\'s model extensions', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    await settings();
    await act(async () => { button(/Add (component|test data)/).click(); });
    await chooseType(/^Model/);
    expect(filePicker().accept).toBe(MODEL);
});

it('editing a dataset offers only the dataset extensions for its new file', async () => {
    await settings();
    const edit = document.querySelector<HTMLButtonElement>('button[aria-label="Edit Holdout set"]')!;
    await act(async () => { edit.click(); });
    expect(filePicker().accept).toBe(DATASET);
});

it('editing a model offers only the model extensions for its new file', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    await settings();
    const edit = document.querySelector<HTMLButtonElement>('button[aria-label="Edit Weights"]')!;
    await act(async () => { edit.click(); });
    expect(filePicker().accept).toBe(MODEL);
});

it('the new project wizard offers a dataset only the engine\'s dataset extensions', async () => {
    await mount(
        <AddProjectWizard open onClose={() => {}} onFinish={() => {}} datasets={[]} models={[]} plugins={[]}
            fetchDatasets={() => {}} fetchModels={() => {}} fetchPlugins={() => {}} />,
    );
    const name = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
    await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(name, 'Project');
        name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button(/^Next$/).click(); });
    await act(async () => { button(/Add Dataset/).click(); });
    expect(filePicker().accept).toBe(DATASET);
});
