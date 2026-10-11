// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin, PluginInputValue, InputAdapter } from '../../models/models';
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

beforeEach(() => {
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
            return { ok: true, json: async () => [] } as Response;
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
        if (url.includes('/plugins/adapters')) {
            return {
                ok: true,
                json: async () => [
                    { package_name: 'demo-pkg', version: '0.1.0', adapter_class: 'UppercaseAdapter', source: 'local' },
                    { package_name: 'demo-pkg', version: '0.1.0', adapter_class: 'ExclaimSuffixAdapter', source: 'local' },
                ],
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

it('leaves selection dropdowns empty on activation (no auto-prefill)', async () => {
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

    // The template endpoint is not used for prefill anymore: dropdowns must
    // stay empty until the user explicitly picks a value.
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Dataset A');
    expect(container.textContent).not.toContain('Model A');

    container.remove();
});

const upper: InputAdapter = { adapter_class: 'UppercaseAdapter', package_name: 'demo-pkg', version: '0.1.0' };
const exclaim: InputAdapter = { adapter_class: 'ExclaimSuffixAdapter', package_name: 'demo-pkg', version: '0.1.0' };

function datasetSelection(extra?: Partial<PluginInputValue>): PluginInputValue {
    return { pid: 'comp-dataset', name: 'dataset', input_type: 'dataset', value: {}, ...extra };
}

type SelectionHandler = (item: PluginInputValue | null, inputName: string) => void;

async function renderForm(selections: PluginInputValue[], onSelectionChange: SelectionHandler) {
    const container = createContainer();
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
                        selections={selections}
                        onToggle={() => {}}
                        onSelectionChange={onSelectionChange}
                    />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });

    // Allow the react-query fetches (definitions, project, adapters) to settle.
    await act(async () => {
        await new Promise(r => setTimeout(r, 400));
    });

    return { container, root };
}

async function cleanup(container: HTMLElement, root: Root) {
    await act(async () => {
        root.unmount();
    });
    container.remove();
}

it('renders an adapter chain as numbered steps in order', async () => {
    const { container, root } = await renderForm([datasetSelection({ adapters: [upper, exclaim] })], vi.fn());

    const chain = container.querySelector('[data-testid="adapter-chain-dataset"]');
    expect(chain).not.toBeNull();
    const text = chain!.textContent ?? '';
    expect(text.indexOf('UppercaseAdapter')).toBeLessThan(text.indexOf('ExclaimSuffixAdapter'));
    expect(text).toContain('Applied top to bottom');

    await cleanup(container, root);
});

it('move-up emits the reversed chain order', async () => {
    const onSelectionChange = vi.fn();
    const sel = datasetSelection({ adapters: [upper, exclaim] });
    const { container, root } = await renderForm([sel], onSelectionChange);

    // First step cannot move up; second step can.
    expect(container.querySelector('button[aria-label="Move UppercaseAdapter up"]')).toHaveProperty('disabled', true);
    const upButton = container.querySelector('button[aria-label="Move ExclaimSuffixAdapter up"]');
    expect(upButton).not.toBeNull();

    await act(async () => {
        upButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith(
        { ...sel, adapters: [exclaim, upper] },
        'dataset',
    );

    await cleanup(container, root);
});

it('removing down to one adapter emits a one-element list', async () => {
    const onSelectionChange = vi.fn();
    const { container, root } = await renderForm([datasetSelection({ adapters: [upper, exclaim] })], onSelectionChange);

    const removeButton = container.querySelector('button[aria-label="Remove UppercaseAdapter"]');
    expect(removeButton).not.toBeNull();

    await act(async () => {
        removeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const [item, name] = onSelectionChange.mock.calls[0];
    expect(name).toBe('dataset');
    expect(item).toEqual(datasetSelection({ adapters: [exclaim] }));

    await cleanup(container, root);
});

it('adding an adapter appends it to the end of the chain', async () => {
    const onSelectionChange = vi.fn();
    const sel = datasetSelection({ adapters: [upper] });
    const { container, root } = await renderForm([sel], onSelectionChange);

    // Single-entry selection renders as a one-row chain.
    expect(container.querySelector('[data-testid="adapter-chain-dataset"]')?.textContent).toContain('UppercaseAdapter');

    // Open the Add-adapter dropdown for the dataset input.
    const adder = container.querySelector('div[aria-labelledby*="adapter-label-dataset"]');
    expect(adder).not.toBeNull();
    await act(async () => {
        adder!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
    });

    const option = Array.from(document.body.querySelectorAll('li[role="option"]'))
        .find(el => el.textContent?.includes('ExclaimSuffixAdapter'));
    expect(option).toBeDefined();

    await act(async () => {
        option!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 200));
    });

    expect(onSelectionChange).toHaveBeenCalledWith(
        { ...sel, adapters: [upper, exclaim] },
        'dataset',
    );

    await cleanup(container, root);
});
