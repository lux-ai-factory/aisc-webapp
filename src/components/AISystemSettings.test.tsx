// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AISystemSettings from './AISystemSettings';
import { ProjectProvider, useProject } from '../context/ProjectContext';
import { useEffect } from 'react';

const PID = '11111111-2222-4333-8444-555555555555';

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/aisystem')) {
            return {
                ok: true,
                json: async () => ({
                    pid: 'sys-1', name: 'System',
                    components: [
                        { pid: 'c-1', name: 'Legacy judge', component_type: 'llm', json_value: { endpoint_url: 'https://x' } },
                        { pid: 'c-2', name: 'Weights', component_type: 'model', data: 'f' },
                    ],
                }),
            } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
    });
});

afterEach(() => { vi.unstubAllEnvs(); document.body.innerHTML = ''; });

async function renderSettings() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
        createRoot(container).render(
            <ProjectProvider>
                <ProjectUUIDSetter uuid={PID} />
                <AISystemSettings />
            </ProjectProvider>,
        );
    });
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    return container;
}

async function typeOptions(container: HTMLElement): Promise<string[]> {
    const add = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Add component'))!;
    await act(async () => { add.click(); });
    const select = document.querySelector('[role="dialog"] [role="combobox"]')!;
    await act(async () => { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    return [...document.querySelectorAll('[role="option"]')].map(o => o.textContent ?? '');
}

it('configurator offers no LLM type and lists no llm component', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'configurator');
    const container = await renderSettings();
    expect(container.textContent).toContain('Weights');
    expect(container.textContent).not.toContain('Legacy judge');
    const options = await typeOptions(container);
    expect(options.length).toBeGreaterThan(0);
    expect(options.some(o => o.startsWith('LLM'))).toBe(false);
});

it('standalone still offers the LLM type', async () => {
    vi.stubEnv('VITE_DEPLOYMENT', 'standalone');
    const container = await renderSettings();
    expect(container.textContent).toContain('Legacy judge');
    const options = await typeOptions(container);
    expect(options.some(o => o.startsWith('LLM'))).toBe(true);
});
