// @vitest-environment jsdom
// A plugin's settings page: its author names a configuration when saving it, and Config History keeps showing
// the configuration that is current while the form is being edited (the form's live preview is not a saved
// configuration and names none).
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useEffect, useImperativeHandle, act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// The settings form itself is upstream's JSON-schema form; a stand-in with its two outward calls: an edit
// (the live preview it hands the page) and a save.
vi.mock('../components/plugin/PluginConfigForm.tsx', () => ({
  default: React.forwardRef(function FormStandIn(props: any, ref) {
    useImperativeHandle(ref, () => ({ submit: () => props.onSubmit({ test: 'conversations' }, []),
                                       exportJson: () => {}, importClick: () => {} }));
    return <>
      <output data-testid="form-config">{JSON.stringify(props.config)}</output>
      <button data-testid="edit" onClick={() => props.onFormUpdate({ config: { test: 'conversations' },
                                                                     formSchema: {}, uiSchema: {} })}>edit</button>
    </>;
  }),
}));

import PluginConfig from './PluginsConfig';
import { ProjectProvider, useProject } from '../context/ProjectContext';

const PROJECT = 'fa6bf828-b44a-40dc-ba61-2c107251487f';
const PLUGIN = { pid: 'abfd8721-c402-443c-86a3-1d88933a04ee', name: 'LangBiteMijkeEvaluationPlugin',
                 display_name: 'LangBiTe (Mijke)', package_name: 'aisc-plugin-langbite-mijke', version: '0.3.0', enabled: true };
const HISTORY = [
  { id: 2, name: '', config: {}, created_at: '2026-10-28T16:03:01Z' },
  { id: 3, name: 'format check', config: {}, created_at: '2026-11-02T15:06:36Z' },
];

function SetProject() {
  const { setProjectUUID } = useProject();
  useEffect(() => { setProjectUUID(PROJECT); }, [setProjectUUID]);
  return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let calls: { method: string; url: string; body?: any }[] = [];
let current = { id: 3, name: 'format check' };
let fillsFromSettingsFile = false;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function settle(until: () => boolean) {
  for (let i = 0; i < 40 && !until(); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}

async function renderPage() {
  calls = [];
  current = { id: 3, name: 'format check' };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'POST' && url.endsWith(`/plugins/${PLUGIN.pid}/config`)) {
      const name = JSON.parse(String(init!.body)).name ?? '';
      current = { id: 4, name };
      HISTORY.push({ id: 4, name, config: {}, created_at: '2026-11-02T18:00:00Z' });
      return json({ plugin_config_id: 4, name, config: {}, formSchema: {}, uiSchema: {} });
    }
    if (url.endsWith('/config/state')) {
      return json({ plugin_config_id: current.id, name: current.name, config: { test: 'conversations', repetitions: 3 },
                    formSchema: {}, uiSchema: {} });
    }
    if (url.endsWith('/configs')) return json(HISTORY);
    if (url.includes('feature')) return json({ can_parse_config_from_dataset: fillsFromSettingsFile,
                                               show_dimensions_visualisation: false, extra: {} });
    return json({ pid: PROJECT, name: 'Mijke', plugins: [PLUGIN] });
  }));
  host = document.createElement('div');
  document.body.appendChild(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root = createRoot(host!);
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/projects/mijke/plugins/${PLUGIN.name}`]}>
          <ProjectProvider><SetProject />
            <Routes><Route path="/projects/:project_name/plugins/:plugin_name" element={<PluginConfig />} /></Routes>
          </ProjectProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await settle(() => historyShown().includes('format check'));
}

function historyShown(): string {
  return document.querySelector('.plugin-config-select')?.textContent ?? '';
}

function nameInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[name="configuration-name"]');
  if (!input) throw new Error('no configuration name field');
  return input;
}

async function typeName(value: string) {
  const input = nameInput();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(el: Element) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

function saveButton(): Element {
  const button = [...document.querySelectorAll('button')].find((b) => /save/i.test(b.textContent ?? ''));
  if (!button) throw new Error('no Save button');
  return button;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  HISTORY.splice(2);
  fillsFromSettingsFile = false;
  vi.unstubAllGlobals();
});

describe('Config History', () => {
  it('shows the current configuration by its name and date', async () => {
    await renderPage();
    expect(historyShown()).toContain('format check');
    expect(historyShown()).toContain('(Current)');
  });

  it('keeps showing the current configuration while the form is edited', async () => {
    await renderPage();
    await click(document.querySelector('[data-testid="edit"]')!);
    expect(historyShown()).toContain('format check');
  });
});

describe('naming a configuration at save time', () => {
  it('offers the current configuration\'s name, to keep or change', async () => {
    await renderPage();
    expect(nameInput().value).toBe('format check');
  });

  it('sends the name typed with the configuration, and then shows the saved one as current', async () => {
    await renderPage();
    await typeName('debts pilot, 3 reps');
    await click(saveButton());
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith(`/plugins/${PLUGIN.pid}/config`));
    expect(post?.body.name).toBe('debts pilot, 3 reps');
    await settle(() => historyShown().includes('debts pilot, 3 reps'));
    expect(historyShown()).toContain('debts pilot, 3 reps');
  });
});

describe('filling the form from a settings file', () => {
  it('is called loading settings, not a dataset', async () => {
    fillsFromSettingsFile = true;
    await renderPage();
    await settle(() => /Load settings/.test(document.body.textContent ?? ''));
    const text = document.body.textContent ?? '';
    expect(text).toContain('Load settings from Test data');
    expect(text).not.toContain('Select a dataset to derive the plugin config from');
  });
});

describe('opening the settings page', () => {
  it('shows the current configuration in the form, so Save never stores the defaults by mistake', async () => {
    await renderPage();
    const shown = JSON.parse(document.querySelector('[data-testid="form-config"]')!.textContent ?? '{}');
    expect(shown).toEqual({ test: 'conversations', repetitions: 3 });
  });
});
