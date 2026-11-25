// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import PluginConfigForm from './PluginConfigForm';
import type { ProjectConfig } from '../../models/models';

const form = vi.hoisted(() => ({ change: vi.fn<(event: { formData: object }) => void>(), submit: vi.fn<(event: { formData: object }) => void>() }));
vi.mock('./CustomFormTemplates.tsx', () => ({ default: (props: { onChange: typeof form.change; onSubmit: typeof form.submit }) => {
    form.change = props.onChange; form.submit = props.onSubmit; return null;
} }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('restores settings by definition key and ignores responses for older edits', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const update = vi.fn();
    const submit = vi.fn();
    const replies: Array<(value: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => replies.push(resolve))));
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}>
        <PluginConfigForm pluginPID="p" formSchema={{}} uiSchema={{}} onFormUpdate={update} onSubmit={submit}
            projectConfigDefinitions={['first', 'second'].map(key => ({ key, name: key, category: 'secrets', required: true }))}
            projectSettings={['first', 'second'].map((key, index) => ({ key, pid: `s${index}`, category: 'secrets' }) as ProjectConfig)}
            projectSettingSelections={['first', 'second'].map((key, index) => ({ plugin_config_key: key, project_config_pid: `s${index}` }))} />
    </QueryClientProvider>));
    form.submit({ formData: {} });
    expect(submit.mock.calls[0][1]).toEqual([
        { plugin_config_key: 'first', project_config_pid: 's0' },
        { plugin_config_key: 'second', project_config_pid: 's1' },
    ]);
    vi.useFakeTimers();
    await act(async () => { form.change({ formData: { value: 'old' } }); await vi.advanceTimersByTimeAsync(510); });
    await act(async () => { form.change({ formData: { value: 'new' } }); await vi.advanceTimersByTimeAsync(510); });
    expect(replies).toHaveLength(2);
    const response = (value: string) => ({ ok: true, json: async () => ({ config: { value } }) }) as Response;
    await act(async () => { replies[1](response('new')); await vi.advanceTimersByTimeAsync(1); });
    await act(async () => { replies[0](response('old')); await vi.advanceTimersByTimeAsync(1); });
    expect(update).toHaveBeenLastCalledWith({ config: { value: 'new' } });
    await act(async () => { form.change({ formData: { value: 'cancelled' } }); root.unmount(); await vi.advanceTimersByTimeAsync(600); });
    expect(replies).toHaveLength(2);
});
