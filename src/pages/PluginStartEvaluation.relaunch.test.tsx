// @vitest-environment jsdom
// A relaunch starts from the last run's inputs. The judge (a helper model) is one of them: a relaunch that
// drops it runs an LLM-judged evaluator without its judge, and every test of that run fails with
// "evaluator 'category_check' needs a judge model".
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import PluginEvaluationForm from '../components/plugin/PluginEvaluationForm';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

const PROJECT = '11111111-2222-4333-8444-555555555555';
const JUDGE_REF = `helper:${PROJECT}/judge-a`;

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

const plugin: Plugin = {
    pid: 'plg-sr',
    name: 'StrongREJECT (Mijke)',
    config: {},
    display_icon: 'gpp_bad',
    package_name: 'aisc-plugin-strongreject-mijke',
    version: '0.2.0',
    display_name: 'StrongREJECT (Mijke)',
    plugin_pid: 'plg-sr',
    enabled: true,
    status: 'ok',
};

// the launch request the page sent, if any
let launched: { plugins_to_run: Array<{ name: string; inputs: Array<Record<string, unknown>> }> } | null = null;

beforeEach(() => {
    sessionStorage.clear();
    launched = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/evaluations/task') && init?.method === 'POST') {
            launched = JSON.parse(String(init.body));
            return { ok: true, json: async () => ({ pid: 'run-1' }) } as Response;
        }
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'gpp_bad' } as Response;
        if (url.includes('/input_definitions')) {
            return {
                ok: true,
                json: async () => [
                    { name: 'forbidden-prompts-file', label: 'Forbidden prompts CSV', input_type: 'dataset', required: false },
                    { name: 'helper:judge', label: 'Judge model', input_type: 'helper', required: false },
                ],
            } as Response;
        }
        if (url.includes('/config/state')) return { ok: true, json: async () => ({ plugin_config_id: null }) } as Response;
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/evaluation-inputs-template')) {
            // the last run: the prompts file and the judge, as the engine returns them
            return {
                ok: true,
                json: async () => ({
                    'StrongREJECT (Mijke)': {
                        'forbidden-prompts-file': { component_pid: 'comp-prompts', value: {} },
                        'helper:judge': { helper_ref: JUDGE_REF, value: { model: 'gpt-judge' } },
                    },
                }),
            } as Response;
        }
        if (url.includes('/helpers/models')) {
            return { ok: true, json: async () => ({ models: ['gpt-judge'], error: null }) } as Response;
        }
        if (url.includes('/helpers')) {
            return {
                ok: true,
                json: async () => [{ ref: JUDGE_REF, label: 'judge-a', roles: ['judge'], endpoint_host: 'judge.example' }],
            } as Response;
        }
        if (url.includes('/projects/')) {
            return {
                ok: true,
                json: async () => ({
                    pid: PROJECT,
                    name: 'P',
                    plugins: [plugin],
                    components: [{ pid: 'comp-prompts', name: 'Mijke jailbreak prompts', component_type: 'dataset' }],
                }),
            } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function settle(container: HTMLElement, done: (el: HTMLElement) => boolean, timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        if (done(container)) return;
    }
}

it('relaunch keeps the judge binding of the last run', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter>
                    <ProjectProvider>
                        <ProjectUUIDSetter uuid={PROJECT} />
                        <PluginStartEvaluation />
                    </ProjectProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
    });

    // the last run's prompts file comes back on the card
    await settle(container, el => (el.textContent || '').includes('Mijke jailbreak prompts'));
    expect(container.textContent).toContain('Mijke jailbreak prompts');

    const launch = [...container.querySelectorAll('button')].find(b => (b.textContent || '').includes('Launch Evaluation'));
    await settle(container, () => !!launch && !launch.disabled);
    await act(async () => { launch!.click(); });
    await settle(container, () => launched !== null);

    expect(launched, 'the relaunch was sent').not.toBeNull();
    const inputs = launched!.plugins_to_run[0].inputs;
    const judge = inputs.find(i => i.name === 'helper:judge');
    expect(judge, 'the relaunch carries the judge the last run had').toMatchObject({
        name: 'helper:judge',
        input_type: 'helper',
        helper_ref: JUDGE_REF,
        value: { model: 'gpt-judge' },
    });
    container.remove();
});

it('opening the card brings back the judge of the last run', async () => {
    const onSelectionChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        createRoot(container).render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid={PROJECT} />
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
    await settle(container, () => onSelectionChange.mock.calls.some(c => c[1] === 'helper:judge'));

    expect(onSelectionChange.mock.calls.some(c => c[1] === 'forbidden-prompts-file')).toBe(true);
    const judge = onSelectionChange.mock.calls.find(c => c[1] === 'helper:judge')?.[0];
    expect(judge, 'the card restores the judge with the prompts file').toMatchObject({
        name: 'helper:judge',
        input_type: 'helper',
        helper_ref: JUDGE_REF,
        value: { model: 'gpt-judge' },
    });
    container.remove();
});
