// @vitest-environment jsdom
// A launch sends only the tests that are complete, but unticks every ticked test: a ticked test that was
// still incomplete keeps its half-filled inputs for the next tick.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PluginStartEvaluation from './PluginStartEvaluation';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { Plugin } from '../models/models';

// a stand-in card: buttons that tick the test, fill one input and report validity
vi.mock('../components/plugin/PluginEvaluationForm.tsx', () => ({
    default: ({ plugin, selections, onToggle, onSelectionChange, onValidationChange }: any) => (
        <div>
            <button data-testid={`tick-${plugin.name}`} onClick={onToggle} />
            <button data-testid={`fill-${plugin.name}`}
                onClick={() => onSelectionChange({ name: 'x', input_type: 'string', value: 'half' }, 'x')} />
            <button data-testid={`valid-${plugin.name}`} onClick={() => onValidationChange(true)} />
            <button data-testid={`invalid-${plugin.name}`} onClick={() => onValidationChange(false)} />
            <span data-testid={`count-${plugin.name}`}>{selections.length}</span>
        </div>
    ),
}));

const PROJECT = '11111111-2222-4333-8444-555555555555';
function Setter() {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(PROJECT); }, [setProjectUUID]);
    return null;
}
const mk = (name: string): Plugin => ({
    pid: name, name, config: {}, display_icon: 'x', package_name: `pkg-${name}`, version: '1', display_name: name,
    plugin_pid: name, enabled: true, status: 'ok',
});
let launched: { plugins_to_run: Array<{ name: string }> } | null = null;

beforeEach(() => {
    sessionStorage.clear();
    launched = null;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/evaluations/task') && init?.method === 'POST') {
            launched = JSON.parse(String(init.body));
            return { ok: true, json: async () => ({ pid: 'run-1' }) } as Response;
        }
        if (url.includes('/evaluation-inputs-template')) return { ok: true, json: async () => ({}) } as Response;
        if (url.includes('/projects/')) {
            return { ok: true, json: async () => ({ pid: PROJECT, name: 'P', plugins: [mk('Good'), mk('Half')], components: [] }) } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
    });
});

const wait = () => act(async () => { await new Promise(r => setTimeout(r, 80)); });

it('a ticked test that was incomplete at launch keeps its inputs for the next tick', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        createRoot(container).render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter><ProjectProvider><Setter /><PluginStartEvaluation /></ProjectProvider></MemoryRouter>
            </QueryClientProvider>,
        );
    });
    const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    for (let i = 0; i < 20 && !q('tick-Good'); i++) await wait();

    for (const name of ['Good', 'Half']) {
        await act(async () => { q(`tick-${name}`).click(); });
        await act(async () => { q(`fill-${name}`).click(); });
    }
    await act(async () => { q('valid-Good').click(); });
    await act(async () => { q('invalid-Half').click(); });
    const launch = [...container.querySelectorAll('button')].find(b => (b.textContent || '').includes('Launch Evaluation'))!;
    await act(async () => { launch.click(); });
    for (let i = 0; i < 20 && !launched; i++) await wait();
    expect(launched!.plugins_to_run.map(p => p.name)).toEqual(['Good']);
    await wait();
    expect(q('count-Half').textContent).toBe('0');

    await act(async () => { q('tick-Half').click(); });
    await wait();
    expect(q('count-Half').textContent).toBe('1');
    container.remove();
});
