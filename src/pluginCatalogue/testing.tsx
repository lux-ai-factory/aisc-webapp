/**
 * Test helper: mount a component under the install context with the installs
 * of one catalogue URI pending, as if the catalogue had just opened /receiver.
 *
 * The web app has no testing library, so this mounts with react-dom and gives
 * the few queries the install-dialog tests need.
 */
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import { PluginInstallContext } from './PluginInstallContext';
import { parseInstallUris } from './installUri';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function WithInstalls({ uri, children }: { uri: string; children: ReactElement }) {
  const [pendingInstalls, setPending] = useState(() => parseInstallUris(uri));
  return (
    <PluginInstallContext.Provider
      value={{
        pendingInstalls,
        currentInstall: pendingInstalls[0] ?? null,
        advance: () => setPending((prev) => prev.slice(1)),
        clear: () => setPending([]),
        protocolStatus: 'not-ready',
        registerProtocol: async () => 'not-ready',
      }}
    >
      {children}
    </PluginInstallContext.Provider>
  );
}

/** Mount `ui` with the installs of `uri` pending; `search` becomes the page's query string. */
export function renderWithInstall(ui: ReactElement, opts: { uri: string; search?: string }): void {
  cleanup();
  window.history.replaceState(null, '', `/${opts.search ?? ''}`);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const qc = new QueryClient();
  act(() => {
    root!.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ProjectProvider>
            <WithInstalls uri={opts.uri}>{ui}</WithInstalls>
          </ProjectProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

/** Unmount whatever renderWithInstall mounted. */
export function cleanup(): void {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
}

/** Let pending promises and effects settle. */
export async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Retry `check` until it stops throwing (about one second). */
export async function waitFor(check: () => void): Promise<void> {
  let last: unknown;
  for (let i = 0; i < 50; i++) {
    try {
      check();
      return;
    } catch (err) {
      last = err;
      await flush(1);
    }
  }
  throw last;
}

/** All visible text on the page (the dialog renders in a portal on body). */
export const pageText = (): string => document.body.textContent ?? '';

/** The one button whose text matches, or undefined. */
export function buttonNamed(re: RegExp): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find((b) => re.test(b.textContent ?? ''));
}

/** Open a MUI Select (it lists its options only once opened). */
export async function openSelect(index = 0): Promise<void> {
  const box = document.querySelectorAll('[role="combobox"]')[index];
  if (!box) throw new Error('no combobox on the page');
  await act(async () => {
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  await flush(2);
}

/** Click the option whose text matches, in an open Select. */
export async function chooseOption(re: RegExp): Promise<void> {
  const option = Array.from(document.querySelectorAll('[role="option"]')).find((o) => re.test(o.textContent ?? ''));
  if (!option) throw new Error(`no option ${re}`);
  await act(async () => {
    (option as HTMLElement).click();
  });
  await flush(2);
}

/** Click a button and let the calls it makes settle. */
export async function click(button: HTMLButtonElement | undefined): Promise<void> {
  if (!button) throw new Error('no such button');
  await act(async () => button.click());
  await flush();
}
