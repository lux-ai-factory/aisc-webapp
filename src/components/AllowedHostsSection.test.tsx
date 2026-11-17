// @vitest-environment jsdom
//
// The allowed internal hosts section (CON-01), the pilot's `#allowed-hosts`: the rule, the
// deployment's own floor rows, the project's entries (with a denied entry marked), allowing
// a host and withdrawing one. Uses the repo's own component-test style (react-dom createRoot
// + act, no extra test libraries).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import AllowedHostsSection from './AllowedHostsSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let calls: { url: string; method: string; body: unknown }[];
let list: Record<string, unknown>;
let putStatus: { ok: boolean; status: number; detail?: string };

beforeEach(() => {
    calls = [];
    list = {
        floor: ['10.0.0.5:8500'],
        entries: [
            {
                host: 'box.local:8500',
                note: 'MCAS-lite on the Docker host',
                updated_at: '2026-11-17T09:25:00Z',
                updated_by: 'development',
                denied: null,
            },
        ],
        can_manage: true,
        rule: 'A connection may call any public address. An internal one is refused unless it is listed here.',
    };
    putStatus = { ok: true, status: 200 };
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const method = init?.method ?? 'GET';
            calls.push({
                url,
                method,
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            if (method === 'PUT')
                return Promise.resolve({
                    ok: putStatus.ok,
                    status: putStatus.status,
                    json: async () => (putStatus.ok ? { host: 'box.local:8500' } : { detail: putStatus.detail }),
                });
            return Promise.resolve({ ok: true, status: 200, json: async () => list });
        }),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

const render = async () => {
    await act(async () => {
        root.render(<AllowedHostsSection projectPid="p1" />);
    });
};

const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`);

const type = async (id: string, value: string) => {
    const input = byTestId(id) as HTMLInputElement;
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
        )?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

const click = async (id: string) => {
    await act(async () => {
        (byTestId(id) as HTMLElement).click();
    });
};

describe('allowed internal hosts section', () => {
    it('shows the rule, the deployment floor and the project entries', async () => {
        await render();

        expect(container.textContent).toContain('Allowed internal hosts');
        expect(container.textContent).toContain('A connection may call any public address');
        expect(byTestId('allowed-floor-10.0.0.5:8500')?.textContent).toContain('set by the deployment');
        expect(byTestId('allowed-box.local:8500')?.textContent).toContain('MCAS-lite on the Docker host');
        expect(byTestId('allowed-box.local:8500')?.textContent).toContain('2026-11-17 09:25 by development');
        expect(calls[0].url).toContain('/projects/p1/allowed-hosts');
    });

    it('marks an entry that can no longer take effect, with the reason', async () => {
        (list.entries as Record<string, unknown>[])[0].denied =
            'loopback addresses (the platform itself) can never be reached';

        await render();

        expect(byTestId('denied-box.local:8500')?.textContent).toContain('loopback');
    });

    it('allows a host with its note and reloads the list', async () => {
        await render();

        await type('allow-host', 'box.local:8500');
        await type('allow-note', 'MCAS-lite on the Docker host');
        await click('allow-submit');

        const put = calls.find((c) => c.method === 'PUT');
        expect(put?.url).toContain('/projects/p1/allowed-hosts/box.local%3A8500');
        expect(put?.body).toEqual({ note: 'MCAS-lite on the Docker host' });
        expect(byTestId('allowed-message')?.textContent).toContain('Allowed box.local:8500');
        expect(calls.filter((c) => c.method === 'GET').length).toBe(2);
    });

    it('will not send an empty host', async () => {
        await render();

        await click('allow-submit');

        expect(calls.some((c) => c.method === 'PUT')).toBe(false);
        expect(byTestId('allowed-message')?.textContent).toContain('Enter a host or host:port');
    });

    it('shows the platform’s own refusal when a host may never be listed', async () => {
        putStatus = {
            ok: false,
            status: 400,
            detail: 'cloud metadata addresses can never be reached',
        };
        await render();

        await type('allow-host', '169.254.169.254');
        await click('allow-submit');

        expect(byTestId('allowed-message')?.textContent).toContain('cloud metadata addresses');
    });

    it('withdraws an entry', async () => {
        await render();

        await click('remove-allowed-box.local:8500');

        const removed = calls.find((c) => c.method === 'DELETE');
        expect(removed?.url).toContain('/projects/p1/allowed-hosts/box.local%3A8500');
    });

    it('is read-only for someone who may not manage it', async () => {
        list.can_manage = false;

        await render();

        expect(byTestId('allowed-readonly')).not.toBeNull();
        expect(byTestId('allow-submit')).toBeNull();
        expect(byTestId('remove-allowed-box.local:8500')).toBeNull();
    });
});
