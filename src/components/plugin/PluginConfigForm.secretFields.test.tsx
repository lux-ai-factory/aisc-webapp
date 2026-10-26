// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginConfigForm from './PluginConfigForm';

// Under vitest, Node's ESM loader cannot resolve the extensionless imports of the theme's ESM build, so the
// theme is loaded from its CommonJS build. That build takes each react-bootstrap component as the whole module
// (Node's interop), which for a module that marks itself __esModule (Col) is not the component: it is handed
// the module's default export instead, as the bundler does for the app.
vi.mock('@rjsf/react-bootstrap', async () => {
    type Loader = (this: unknown, request: string, ...rest: unknown[]) => { __esModule?: boolean; default?: unknown };
    const nodeModule = (await import('node:module')).default as unknown as typeof import('node:module') & { _load: Loader };
    const load = nodeModule._load;
    nodeModule._load = function (this: unknown, request: string, ...rest: unknown[]) {
        const loaded = load.call(this, request, ...rest);
        return request.startsWith('react-bootstrap/') && loaded?.__esModule ? loaded.default as ReturnType<Loader> : loaded;
    };
    try {
        return nodeModule.createRequire(import.meta.url)('@rjsf/react-bootstrap');
    } finally {
        nodeModule._load = load;
    }
});

// The backend keeps a key typed into a plugin's form as a project secret and drives the form through its
// uiSchema: the field comes back empty, as a password input, with the name of the secret that keeps it.
const SECRET_HELP =
    'Kept as the project secret demoa_model_credential. Leave this empty to keep it; type a new key to replace it.';

// stable across renders, as the page passes them: a fresh [] on each render would reset the form's selections forever
const NONE: never[] = [];

it('shows a kept key field as an empty password input with its help text', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <QueryClientProvider client={new QueryClient()}>
                <PluginConfigForm
                    pluginPID="plg-1"
                    formSchema={{
                        type: 'object',
                        properties: { threshold: { type: 'number' }, model_credential: { type: 'string' } },
                    }}
                    uiSchema={{ model_credential: { 'ui:widget': 'password', 'ui:help': SECRET_HELP } }}
                    config={{ threshold: 0.5 }}
                    onFormUpdate={() => {}}
                    onSubmit={() => {}}
                    projectConfigDefinitions={NONE}
                    projectSettings={NONE}
                    projectSettingSelections={NONE}
                />
            </QueryClientProvider>,
        );
    });

    const input = container.querySelector<HTMLInputElement>('input#root_model_credential');
    expect(input).not.toBeNull();
    expect(input!.type).toBe('password');
    expect(input!.value).toBe('');
    expect(container.textContent).toContain(SECRET_HELP);

    act(() => root.unmount());
    container.remove();
});
