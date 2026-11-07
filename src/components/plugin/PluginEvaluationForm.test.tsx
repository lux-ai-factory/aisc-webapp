// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin } from '../../models/models';
import { rememberPlatformProject } from '../../platform/currentProject';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

function createContainer() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
}

const qc = () => new QueryClient({
    defaultOptions: { queries: { retry: false } },
});

const plugin: Plugin = {
    pid: 'plg-1',
    name: 'DemoPlugin',
    config: {},
    display_icon: 'extension',
    package_name: 'demo-pkg',
    version: '0.1.0',
    display_name: 'Demo',
    plugin_pid: 'plg-1',
    enabled: true,
    status: 'ok',
};

// the plugin's saved configurations, as GET /plugins/{pid}/configs answers them
let savedConfigs: object[] = [];

beforeEach(() => {
    savedConfigs = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) {
            return { ok: true, json: async () => 'extension' } as Response;
        }
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [
                    { name: 'dataset', label: 'Dataset', input_type: 'dataset', required: true },
                    { name: 'model', label: 'Model', input_type: 'model', required: true },
                ],
            } as Response;
        }
        if (url.includes('/configs')) {
            return { ok: true, json: async () => savedConfigs } as Response;
        }
        if (url.includes('/evaluation-inputs-template')) {
            return {
                ok: true,
                json: async () => ({
                    DemoPlugin: {
                        dataset: { component_pid: 'comp-dataset', value: {} },
                        model: { component_pid: 'comp-model', value: {} },
                    },
                }),
            } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'proj-1',
                    name: 'P',
                    plugins: [plugin],
                    components: [
                        { pid: 'comp-dataset', name: 'Dataset A', component_type: 'dataset' },
                        { pid: 'comp-model', name: 'Model A', component_type: 'model' },
                    ],
                }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

it('prefills selection dropdowns from the last-used evaluation template on activation', async () => {
    const container = createContainer();
    const onSelectionChange = vi.fn();
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <QueryClientProvider client={qc()}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid="proj-1" />
                    <PluginEvaluationForm
                        plugin={plugin}
                        isConfigured
                        isActive
                        selections={[]}
                        onToggle={() => {}}
                        onSelectionChange={onSelectionChange}
                    />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });

    // Allow the react-query fetch + effect to settle.
    await act(async () => {
        await new Promise(r => setTimeout(r, 400));
    });

    const datasetCall = onSelectionChange.mock.calls.find(
        c => c[1] === 'dataset'
    );
    const modelCall = onSelectionChange.mock.calls.find(
        c => c[1] === 'model'
    );

    expect(onSelectionChange).toHaveBeenCalled();
    expect(datasetCall?.[0]).toMatchObject({ pid: 'comp-dataset', name: 'dataset' });
    expect(modelCall?.[0]).toMatchObject({ pid: 'comp-model', name: 'model' });

    container.remove();
});

// ---- a helper model's input: picked from the project's helper models on the platform ----

const HELPER_PROJECT = '11111111-2222-4333-8444-555555555555';
const JUDGE_REF = `helper:${HELPER_PROJECT}/judge-a`;

function mockEngine(opts: { helpers: object[]; components: object[]; required?: boolean; models?: object }) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'extension' } as Response;
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [
                    { name: 'target', label: 'Target', input_type: 'resource', required: false },
                    { name: 'helper:judge', label: 'Helper model · Judge (not assessed)', input_type: 'helper', required: opts.required ?? true },
                ],
            } as Response;
        }
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) return { ok: true, json: async () => ({}) } as Response;
        if (url.includes('/helpers/models')) {
            return { ok: true, json: async () => opts.models ?? { models: [], error: 'the endpoint lists no models' } } as Response;
        }
        if (url.includes('/helpers')) return { ok: true, json: async () => opts.helpers } as Response;
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({ pid: HELPER_PROJECT, name: 'P', plugins: [plugin], components: opts.components }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
}

const judgeA = { ref: JUDGE_REF, label: 'judge-a', roles: ['judge'], endpoint_host: 'api.example.com' };

async function renderForm(selections: object[], onSelectionChange = vi.fn(), onValidationChange = vi.fn()) {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <QueryClientProvider client={qc()}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid={HELPER_PROJECT} />
                    <PluginEvaluationForm
                        plugin={plugin}
                        isConfigured
                        isActive
                        selections={selections as never}
                        onToggle={() => {}}
                        onSelectionChange={onSelectionChange}
                        onValidationChange={onValidationChange}
                    />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    // until the helper models have been asked for and answered
    for (let i = 0; i < 100; i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        const text = container.textContent ?? '';
        if (text.includes('Helper model') && !text.includes('Loading')) break;
    }
    return { container, onSelectionChange, onValidationChange };
}

const openSelect = async (container: HTMLElement, index: number) => {
    const boxes = container.querySelectorAll('[role="combobox"]');
    await act(async () => {
        boxes[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
};

it('lists only helper models for a helper input', async () => {
    mockEngine({
        helpers: [judgeA],
        components: [{ pid: 'llm-1', name: 'Legacy judge', component_type: 'llm' }],
    });
    const { container, onSelectionChange } = await renderForm([]);

    await openSelect(container, 1);
    const options = [...document.querySelectorAll('[role="option"]')].map(o => o.textContent);
    expect(options).toContain('judge-a');
    expect(options).not.toContain('Legacy judge');
    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]))).toContain(
        `/projects/${HELPER_PROJECT}/helpers?role=judge`);

    await act(async () => {
        (([...document.querySelectorAll('[role="option"]')].find(o => o.textContent === 'judge-a')) as HTMLElement).click();
    });
    const picked = onSelectionChange.mock.calls.find(c => c[1] === 'helper:judge')?.[0];
    expect(picked).toEqual({ name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } });
    expect('pid' in picked).toBe(false);
    container.remove();
});

it('submits the model typed for the chosen helper, with no pid', async () => {
    mockEngine({ helpers: [judgeA], components: [] });
    const picked = { name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } };
    const { container, onSelectionChange } = await renderForm([picked]);

    const field = [...container.querySelectorAll('label')].find(l => l.textContent?.startsWith('Model'))
        ?.parentElement?.querySelector('input') as HTMLInputElement;
    await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(field, 'gpt-4o-mini');
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sent = onSelectionChange.mock.calls.find(c => c[1] === 'helper:judge')?.[0];
    expect(sent).toEqual({ ...picked, value: { model: 'gpt-4o-mini' } });
    expect('pid' in sent).toBe(false);
    container.remove();
});

it('keeps a text box for the model while it is typed, when the helper lists no models', async () => {
    mockEngine({ helpers: [judgeA], components: [] });
    const picked = { name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } };
    const sent: object[] = [];
    // the run page keeps what the form sends and hands it back as the form's selections
    function FedBack() {
        const [selections, setSelections] = useState<object[]>([picked]);
        return (
            <PluginEvaluationForm
                plugin={plugin}
                isConfigured
                isActive
                selections={selections as never}
                onToggle={() => {}}
                onSelectionChange={(item) => { sent.push(item as object); setSelections(item ? [item] : []); }}
            />
        );
    }
    const container = createContainer();
    await act(async () => {
        createRoot(container).render(
            <QueryClientProvider client={qc()}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid={HELPER_PROJECT} />
                    <FedBack />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    for (let i = 0; i < 100 && !(container.textContent ?? '').includes('lists no models'); i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    }
    const modelBox = () => [...container.querySelectorAll('label')].find(l => l.textContent?.startsWith('Model'))
        ?.parentElement?.querySelector('input:not([aria-hidden])') as HTMLInputElement | null;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const typed of ['g', 'gp']) {
        const field = modelBox();
        expect(field, `a text box before typing ${typed}`).not.toBeNull();
        await act(async () => {
            set.call(field, typed);
            field!.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    expect(modelBox()?.value).toBe('gp');
    expect(sent[sent.length - 1]).toEqual({ ...picked, value: { model: 'gp' } });
    container.remove();
});

it("offers the chosen helper's models in a list and sends the one picked", async () => {
    mockEngine({ helpers: [judgeA], components: [], models: { models: ['gpt-4o', 'gpt-4o-mini'], error: null } });
    const picked = { name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } };
    const { container, onSelectionChange } = await renderForm([picked]);
    for (let i = 0; i < 100 && container.querySelectorAll('[role="combobox"]').length < 3; i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    }

    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]))).toContain(
        `/projects/${HELPER_PROJECT}/helpers/models?ref=${encodeURIComponent(JUDGE_REF)}`);
    await openSelect(container, 2);
    const options = [...document.querySelectorAll('[role="option"]')].map(o => o.textContent);
    expect(options).toEqual(['gpt-4o', 'gpt-4o-mini']);
    await act(async () => {
        (([...document.querySelectorAll('[role="option"]')].find(o => o.textContent === 'gpt-4o-mini')) as HTMLElement).click();
    });
    const sent = onSelectionChange.mock.calls.filter(c => c[1] === 'helper:judge').pop()?.[0];
    expect(sent).toEqual({ ...picked, value: { model: 'gpt-4o-mini' } });
    container.remove();
});

it('asks for the model by name, with the reason, when the helper lists none', async () => {
    mockEngine({ helpers: [judgeA], components: [] });
    const picked = { name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } };
    const { container } = await renderForm([picked]);
    for (let i = 0; i < 100 && !(container.textContent ?? '').includes('lists no models'); i++) {
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    }
    expect(container.textContent).toContain('the endpoint lists no models');
    container.remove();
});

it('points to Manage when no helper allows the role', async () => {
    mockEngine({ helpers: [], components: [] });
    rememberPlatformProject(HELPER_PROJECT);
    const { container } = await renderForm([]);
    expect(container.textContent).toContain(
        'No helper model allows this role yet. Add one under Manage > Helper models.');
    const link = container.querySelector('a[href*="/helpers.html?project="]');
    expect(link?.getAttribute('href')).toContain(`/helpers.html?project=${HELPER_PROJECT}`);
    container.remove();
});

describe('a helper input is complete only with a model', () => {
    const emptyModel = { name: 'helper:judge', input_type: 'helper', helper_ref: JUDGE_REF, value: { model: '' } };
    const lastValidity = (fn: ReturnType<typeof vi.fn>) => fn.mock.lastCall?.[0];

    it.each([true, false])('is not filled when the helper is picked with no model (required: %s)', async (required) => {
        mockEngine({ helpers: [judgeA], components: [], required });
        const { container, onValidationChange } = await renderForm([emptyModel]);
        expect(lastValidity(onValidationChange)).toBe(false);
        container.remove();
    });

    it('is filled once the picked helper has a model', async () => {
        mockEngine({ helpers: [judgeA], components: [], required: false });
        const { container, onValidationChange } = await renderForm([{ ...emptyModel, value: { model: 'gpt-4o-mini' } }]);
        expect(lastValidity(onValidationChange)).toBe(true);
        container.remove();
    });

    it('stays fine on an optional role with nothing picked', async () => {
        mockEngine({ helpers: [judgeA], components: [], required: false });
        const { container, onValidationChange } = await renderForm([]);
        expect(lastValidity(onValidationChange)).toBe(true);
        container.remove();
    });
});


it('names the configuration a run will use by the name its author gave it', async () => {
    savedConfigs = [
        { id: 2, name: '', config: {}, created_at: '2026-10-28T16:03:01Z' },
        { id: 3, name: 'debts pilot, 3 reps', config: {}, created_at: '2026-11-02T15:06:36Z' },
    ];
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <QueryClientProvider client={qc()}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid="proj-1" />
                    <PluginEvaluationForm plugin={plugin} isConfigured isActive selections={[]}
                                          onToggle={() => {}} onSelectionChange={vi.fn()} />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    for (let i = 0; i < 40 && !/debts pilot/.test(container.textContent ?? ''); i++) {
        await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    // the latest is chosen: shown by its name, not by its number
    expect(container.textContent).toContain('debts pilot, 3 reps');
    expect(container.textContent).not.toContain('Config #2');
    act(() => root.unmount());
    container.remove();
});
