// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import ObjectiveProfileSection from './ObjectiveProfileSection';
import type { ObjectiveCatalogueItem, ObjectiveSet } from '../lib/qualification';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const catalogue = [
    {
        id: 'O1',
        macro_requirement: 'REQ1 Human Agency and Oversight',
        legal_basis: 'Art 14',
        sub_requirement_label: '',
        text: 'Human oversight',
        assessment_mode: 'Control',
    },
    {
        id: 'O2',
        macro_requirement: 'REQ5 Fairness',
        legal_basis: 'Art 10',
        sub_requirement_label: '',
        text: 'Fair training data',
        assessment_mode: 'Control',
    },
] as unknown as ObjectiveCatalogueItem[];

const profiles = {
    profiles: [
        {
            key: 'fairness-oversight',
            name: 'Fairness and oversight',
            description: 'the fairness and oversight dimensions',
            objectives: ['O1'],
        },
        { key: 'full-ai-act', name: 'Full AI Act', description: 'every objective', objectives: ['O1', 'O2'] },
    ],
    current: 'fairness-oversight',
    current_name: 'Fairness and oversight',
    selected: ['O1'],
};

let container: HTMLElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let sets: ObjectiveSet[];

function jsonResponse(payload: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

beforeEach(() => {
    sets = [];
    fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (url.endsWith('/control-objectives/profiles')) return Promise.resolve(jsonResponse(profiles));
        if (url.endsWith('/objective-sets') && method === 'GET') return Promise.resolve(jsonResponse(sets));
        if (url.endsWith('/objective-sets') && method === 'POST') {
            const body = JSON.parse(String(init?.body)) as { name: string; draft: unknown[] };
            const created = {
                pid: 's1',
                name: body.name,
                code_prefix: '',
                draft: body.draft,
                published_version: null,
                versions: [],
            } as unknown as ObjectiveSet;
            sets = [created];
            return Promise.resolve(jsonResponse(created));
        }
        if (url.endsWith('/objective-sets/s1') && method === 'PUT') {
            const body = JSON.parse(String(init?.body)) as { name: string; draft: ObjectiveSet['draft'] };
            sets = [{ ...sets[0], name: body.name, draft: body.draft }];
            return Promise.resolve(jsonResponse(sets[0]));
        }
        if (url.endsWith('/objective-sets/s1/publish')) {
            sets = [{ ...sets[0], published_version: 1 }];
            return Promise.resolve(jsonResponse(sets[0]));
        }
        if (url.endsWith('/objective-sets/s1/apply')) {
            return Promise.resolve(
                jsonResponse({ created: ['O1', 'O2'], updated: [], selected: ['O1', 'O2'], number: 1 }),
            );
        }
        if (url.endsWith('/control-objectives/profile')) {
            return Promise.resolve(jsonResponse({ objectives: ['O1'], key_objectives: [] }));
        }
        if (url.includes('/control-objectives/risks/mappings/suggest')) {
            return Promise.resolve(
                jsonResponse({
                    attempts: 1,
                    created: [
                        { pid: 'm1', risk_pid: 'r1', objective_id: 'O1', quote: 'q', rationale: '', source: 'ai' },
                        { pid: 'm2', risk_pid: 'r1', objective_id: 'O2', quote: 'q', rationale: '', source: 'ai' },
                    ],
                    dropped: [{ risk: 'r2', objective_id: null, reason: 'no valid proposal within 1 attempt(s)' }],
                }),
            );
        }
        throw new Error(`unexpected fetch: ${method} ${url}`);
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

async function render(onChanged = () => {}) {
    await act(async () => {
        root.render(<ObjectiveProfileSection pid="p1" catalogue={catalogue} onChanged={onChanged} />);
    });
    await act(async () => {});
}

function button(label: string): HTMLButtonElement {
    return Array.from(document.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').includes(label),
    ) as HTMLButtonElement;
}

function typeInto(label: string, value: string) {
    const input = document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ObjectiveProfileSection', () => {
    it('shows the profile the project is on, and its two built-ins', async () => {
        await render();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Fairness and oversight');
        expect(text).toContain('the fairness and oversight dimensions');
        expect(text).toContain('New set from the catalogue');
    });

    it('switches to the other built-in profile', async () => {
        await render();
        const combo = document.querySelector('[role="combobox"]') as HTMLElement;
        await act(async () => {
            // MUI opens a select on mousedown, not click
            combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });
        const option = Array.from(document.querySelectorAll('[role="option"]')).find((li) =>
            (li.textContent ?? '').includes('Full AI Act'),
        ) as HTMLElement;
        expect(option).toBeTruthy();
        await act(async () => {
            option.click();
        });
        await act(async () => {});

        const put = fetchMock.mock.calls.find(
            (c) => String(c[0]).endsWith('/control-objectives/profile') && c[1]?.method === 'PUT',
        );
        expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ profile_key: 'full-ai-act' });
    });

    it('runs the risk mapper and reports what it linked', async () => {
        let changed = 0;
        await render(() => {
            changed += 1;
        });
        await act(async () => {
            button('Suggest with AI').click();
        });
        await act(async () => {});

        const post = fetchMock.mock.calls.find((c) =>
            String(c[0]).includes('/risks/mappings/suggest'),
        );
        expect(JSON.parse(String(post?.[1]?.body))).toEqual({ also_replace_manual: false });
        expect(document.body.textContent).toContain('Linked 2, left 1 unlinked in 1 attempt.');
        expect(changed).toBe(1);
    });

    it('passes "replace my hand links" to the mapper when ticked', async () => {
        await render();
        const box = document.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        await act(async () => {
            box.click();
        });
        await act(async () => {
            button('Suggest with AI').click();
        });
        const post = fetchMock.mock.calls.find((c) =>
            String(c[0]).includes('/risks/mappings/suggest'),
        );
        expect(JSON.parse(String(post?.[1]?.body))).toEqual({ also_replace_manual: true });
    });

    it('says when no model is configured', async () => {
        fetchMock.mockImplementation((url: string, init?: RequestInit) => {
            if (url.endsWith('/control-objectives/profiles')) return Promise.resolve(jsonResponse(profiles));
            if (url.endsWith('/objective-sets')) return Promise.resolve(jsonResponse([]));
            if (url.includes('/risks/mappings/suggest')) {
                return Promise.resolve(
                    jsonResponse({ detail: 'no model is configured for the risk mapper' }, 503),
                );
            }
            throw new Error(`unexpected fetch: ${url} ${init?.method}`);
        });
        await render();
        await act(async () => {
            button('Suggest with AI').click();
        });
        await act(async () => {});
        expect(document.body.textContent).toContain('no model is configured for the risk mapper');
    });

    it('creates a set from the catalogue, publishes it and applies it', async () => {
        await render();
        await act(async () => {
            button('New set from the catalogue').click();
        });
        await act(async () => {
            typeInto('Set name', 'Our own set');
        });
        await act(async () => {
            button('Create').click();
        });
        await act(async () => {});

        const post = fetchMock.mock.calls.find(
            (c) => String(c[0]).endsWith('/objective-sets') && c[1]?.method === 'POST',
        );
        const body = JSON.parse(String(post?.[1]?.body));
        expect(body.name).toBe('Our own set');
        expect(body.draft.map((r: { objective_id: string }) => r.objective_id)).toEqual(['O1', 'O2']);
        expect(document.body.textContent).toContain('2 in the draft');

        await act(async () => {
            button('Publish').click();
        });
        await act(async () => {});
        expect(
            fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/objective-sets/s1/publish')),
        ).toBe(true);
        expect(document.body.textContent).toContain('published v1');

        await act(async () => {
            button('Apply to this project').click();
        });
        await act(async () => {});
        expect(
            fetchMock.mock.calls.some(
                (c) =>
                    String(c[0]).endsWith('/objective-sets/s1/apply') && c[1]?.method === 'POST',
            ),
        ).toBe(true);
        // applying selects the new objectives in the project's profile
        const put = fetchMock.mock.calls.find(
            (c) => String(c[0]).endsWith('/control-objectives/profile') && c[1]?.method === 'PUT',
        );
        expect(JSON.parse(String(put?.[1]?.body)).objectives).toEqual(['O1', 'O2']);
    });

    it('will not publish an empty draft', async () => {
        await render();
        await act(async () => {
            button('New set from the catalogue').click();
        });
        await act(async () => {
            typeInto('Set name', 'Empty');
        });
        await act(async () => {
            button('Create').click();
        });
        await act(async () => {});
        // drop both rows, one at a time: the delete control on each chip
        for (let i = 0; i < 2; i += 1) {
            const icon = document.querySelector('.MuiChip-deleteIcon') as Element;
            expect(icon).toBeTruthy();
            await act(async () => {
                icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await act(async () => {});
        }
        expect(document.body.textContent).toContain('0 in the draft');
        expect(button('Publish').disabled).toBe(true);
    });
});
