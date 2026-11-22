// @vitest-environment jsdom
// A test that cannot be launched yet (a test that calls its target while no target of the AI card has a
// connection): its card is greyed out, says why, and a click does not tick it.
import { it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginEvaluationForm from './PluginEvaluationForm';
import { ProjectProvider, useProject } from '../../context/ProjectContext';
import { Plugin } from '../../models/models';

const REASON = 'No target of the AI card has a connection yet: set one under Manage, Components and connections';

const plugin: Plugin = {
    pid: 'plg-1', name: 'LangBiTe', config: {}, display_icon: 'science', package_name: 'langbite-pkg',
    version: '0.3.8', display_name: 'LangBiTe', plugin_pid: 'plg-1', enabled: true, status: 'ok',
};

function ProjectUUIDSetter({ uuid }: { uuid: string }) {
    const { setProjectUUID } = useProject();
    useEffect(() => { setProjectUUID(uuid); }, [uuid, setProjectUUID]);
    return null;
}

beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/display_icon')) return { ok: true, json: async () => 'science' } as Response;
        if (url.includes('/input_definitions')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/configs')) return { ok: true, json: async () => [] } as Response;
        if (url.includes('/projects/')) {
            return { ok: true, json: async () => ({ pid: 'proj-1', name: 'P', plugins: [plugin], components: [] }) } as Response;
        }
        throw new Error(`Unexpected fetch: ${url}`);
    });
});

async function renderCard(blockedReason?: string) {
    const onToggle = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <ProjectProvider>
                    <ProjectUUIDSetter uuid="proj-1" />
                    <PluginEvaluationForm plugin={plugin} isConfigured={false} isActive={false} selections={[]}
                                          onToggle={onToggle} onSelectionChange={vi.fn()} blockedReason={blockedReason} />
                </ProjectProvider>
            </QueryClientProvider>,
        );
    });
    for (let i = 0; i < 40 && !container.querySelector('[data-plugin-card]'); i++) {
        await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    const card = container.querySelector('[data-plugin-card]') as HTMLElement;
    return { container, root, card, onToggle };
}

it('greys out a test that cannot be launched yet and says why', async () => {
    const { container, root, card } = await renderCard(REASON);
    expect(card.className).toContain('plugin-eval-card--blocked');
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(container.textContent).toContain(REASON);
    act(() => root.unmount());
    container.remove();
});

it('does not tick a test that cannot be launched yet when its card is clicked', async () => {
    const { container, root, card, onToggle } = await renderCard(REASON);
    await act(async () => { card.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onToggle).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
});

it('ticks a test that can be launched, as before', async () => {
    const { container, root, card, onToggle } = await renderCard(undefined);
    expect(card.className).not.toContain('plugin-eval-card--blocked');
    expect(card.getAttribute('aria-disabled')).toBeNull();
    await act(async () => { card.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
});
