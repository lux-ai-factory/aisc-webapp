// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import CardAgentPanel from './CardAgentPanel';
import type { Qualification } from '../lib/qualification';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const qualification = {
    pid: 'q1',
    questionnaire_id: 'form1',
    answers: {},
    system_card: { nodes: [] },
    status: 'completed',
    system_version: null,
} as unknown as Qualification;

let container: HTMLElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

const links = [
    {
        component_key: 'c1',
        name: 'Risk model',
        component_type: 'model',
        role: 'in-house',
        engine_component_pid: 'e1',
        snapshot: {},
        changed: false,
        missing: false,
        captured_at: '2026-01-01T00:00:00Z',
    },
    {
        component_key: 'c2',
        name: 'Training data',
        component_type: 'dataset',
        role: '',
        engine_component_pid: 'e2',
        snapshot: {},
        changed: true,
        missing: false,
        captured_at: '2026-01-01T00:00:00Z',
    },
    {
        component_key: 'c3',
        name: 'An unregistered model',
        component_type: 'model',
        role: '',
        engine_component_pid: '',
        snapshot: {},
        changed: false,
        missing: true,
        captured_at: '2026-01-01T00:00:00Z',
    },
];

beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/projects/p1/qualification/q1/card-components')) {
            return Promise.resolve({ ok: true, json: async () => links });
        }
        if (url.endsWith('/projects/p1/qualification/q1/agent')) {
            return Promise.resolve({
                ok: true,
                json: async () => ({
                    text: 'I would name it after what you said.',
                    proposals: [
                        {
                            node_id: 'n1',
                            property: 'label',
                            value: 'Loan scoring model',
                            quote: 'loan scoring model',
                            reason: '',
                        },
                    ],
                    dropped: [{ node_id: 'n9', reason: 'no quote' }],
                    card: { nodes: [] },
                }),
            });
        }
        if (url.endsWith('/projects/p1/qualification/q1/nodes/n1')) {
            expect(init?.method).toBe('PUT');
            expect(init?.body).toBe(JSON.stringify({ label: 'Loan scoring model' }));
            return Promise.resolve({
                ok: true,
                json: async () => ({ ...qualification, pid: 'q2' }),
            });
        }
        throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
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

async function renderPanel(
    onApplied: (qualification: Qualification) => void = () => {},
) {
    await act(async () => {
        root.render(<CardAgentPanel pid="p1" qualification={qualification} onApplied={onApplied} />);
    });
    await act(async () => {});
}

function type(value: string) {
    const input = document.querySelector('input[aria-label=""]') as HTMLInputElement
        ?? (document.querySelector('input') as HTMLInputElement);
    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CardAgentPanel', () => {
    it('shows which card components drifted from the engine', async () => {
        await renderPanel();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Card components vs the engine');
        expect(text).toContain('Risk model');
        expect(text).toContain('Training data: changed in the engine since');
        expect(text).toContain('An unregistered model: not in the engine');
    });

    it('sends what the person says and shows the proposal, quoting it', async () => {
        await renderPanel();
        await act(async () => {
            type('call the model the loan scoring model');
        });
        const ask = Array.from(document.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').includes('Ask'),
        ) as HTMLButtonElement;
        await act(async () => {
            ask.click();
        });
        await act(async () => {});

        const body = JSON.stringify(
            (fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/agent'))?.[1] as RequestInit)
                .body,
        );
        expect(body).toContain('call the model the loan scoring model');
        const text = document.body.textContent ?? '';
        expect(text).toContain('I would name it after what you said.');
        expect(text).toContain('Loan scoring model');
        expect(text).toContain('quoting “loan scoring model”');
        expect(text).toContain('Left out: no quote');
    });

    it('applies a proposal through the node-correction endpoint', async () => {
        const applied: Qualification[] = [];
        await renderPanel((q) => applied.push(q));
        await act(async () => {
            type('rename it');
        });
        await act(async () => {
            (Array.from(document.querySelectorAll('button')).find(
                (b) => (b.textContent ?? '').includes('Ask'),
            ) as HTMLButtonElement).click();
        });
        await act(async () => {});

        const apply = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent === 'Apply',
        ) as HTMLButtonElement;
        await act(async () => {
            apply.click();
        });
        await act(async () => {});

        expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/nodes/n1'))).toBe(true);
        expect(applied).toHaveLength(1);
        expect(applied[0].pid).toBe('q2');
        // the applied proposal is gone from the list
        expect(document.body.textContent).not.toContain('Apply');
    });

    it('says when no model is configured instead of staying silent', async () => {
        fetchMock.mockImplementation((url: string) => {
            if (url.endsWith('/card-components')) {
                return Promise.resolve({ ok: true, json: async () => [] });
            }
            return Promise.resolve({
                ok: false,
                status: 503,
                json: async () => ({ detail: 'no model is configured for the card agent' }),
            });
        });
        await renderPanel();
        await act(async () => {
            type('hi');
        });
        await act(async () => {
            (Array.from(document.querySelectorAll('button')).find(
                (b) => (b.textContent ?? '').includes('Ask'),
            ) as HTMLButtonElement).click();
        });
        await act(async () => {});
        expect(document.body.textContent).toContain('no model is configured for the card agent');
    });
});
