// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import RiskRegister from '../components/RiskRegisterSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/ProjectContext', () => ({
    useProject: () => ({
        projectUUID: 'p1',
        setProjectUUID: () => {},
        projectName: 'demo',
        setProjectName: () => {},
        fileUploadingPids: new Set<string>(),
        addFileUploadingPid: () => {},
        removeFileUploadingPid: () => {},
    }),
}));

const risk = {
    pid: 'r1',
    position: 1,
    name: 'Poisoned training data',
    airo_text: '',
    impact: null,
    likelihood: null,
    rating: 0,
    comment: '',
    version: 1,
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
            const json = (payload: unknown) => Promise.resolve({ ok: true, json: async () => payload });
            if (url.includes('/control-objectives/risks/r1/versions')) {
                return json([
                    { pid: 'rv1', risk_pid: 'r1', number: 1, name: 'Poisoned training data', impact: 1, likelihood: 2, rating: 2, comment: 'early', airo_text: '', created_at: '2026-01-01T00:00:00Z', created_by: '' },
                    { pid: 'rv2', risk_pid: 'r1', number: 2, name: 'Poisoned training data', impact: 3, likelihood: 4, rating: 12, comment: 'assessed', airo_text: '', created_at: '2026-01-02T00:00:00Z', created_by: '' },
                ]);
            }
            if (url.includes('/control-objectives/risks/') && (init?.method ?? 'GET') === 'PATCH') {
                return json(risk);
            }
            if (url.includes('/control-objectives/risks')) return json([risk]);
            if (url.includes('/control-objectives/mappings')) return json([]);
            if (url.includes('/control-objectives/profile')) {
                return json({ objectives: ['O1'], key_objectives: ['O1'] });
            }
            if (url.includes('/control-objectives/catalogue')) {
                return json([
                    { id: 'O1', macro_requirement: 'REQ1', text: 'Human oversight', assessment_mode: 'Control' },
                    { id: 'O2', macro_requirement: 'REQ2', text: 'Transparency', assessment_mode: 'Test' },
                ]);
            }
            throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
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

async function renderPage() {
    await act(async () => {
        root.render(<RiskRegister pid="p1" />);
    });
    for (let i = 0; i < 30; i++) {
        if ((document.body.textContent ?? '').includes('Poisoned training data')) return;
        await act(async () => {
            await new Promise((r) => setTimeout(r, 25));
        });
    }
}

/** The risk card itself (the whole card opens the edit dialog). */
function riskCard(): HTMLElement {
    return Array.from(document.body.querySelectorAll('.MuiCard-root')).find(
        (c) => (c.textContent ?? '').includes('Poisoned training data'),
    ) as HTMLElement;
}

describe('RiskRegister', () => {
    it('renders the register with the risks rated by the assessor', async () => {
        await renderPage();
        const text = document.body.textContent ?? '';
        expect(text).toContain('Risk register');
        expect(text).toContain('Poisoned training data');
        expect(text).toContain('Impact');
        expect(text).toContain('Likelihood');
        // the card carries the risk's current revision chip
        expect(text).toContain('v1');
    });

    it('ratings save via PATCH on the risk', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const json = (payload: unknown) => Promise.resolve({ ok: true, json: async () => payload });
                if (url.includes('/control-objectives/risks/') && (init?.method ?? 'GET') === 'PATCH') {
                    return json({ ...risk, impact: 3, likelihood: 4, rating: 12 });
                }
                if (url.includes('/control-objectives/risks')) return json([risk]);
                if (url.includes('/control-objectives/mappings')) return json([]);
                if (url.includes('/control-objectives/profile')) {
                    return json({ objectives: ['O1'], key_objectives: ['O1'] });
                }
                if (url.includes('/control-objectives/catalogue')) {
                    return json([{ id: 'O1', macro_requirement: 'REQ1', text: 'Human oversight', assessment_mode: 'Control' }]);
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        await act(async () => {
            riskCard().click();
        });
        await act(async () => {});
        const rationale = Array.from(document.body.querySelectorAll('textarea')).find(
            (ta) => (ta.getAttribute('aria-label') ?? '') === 'Comment',
        ) as HTMLTextAreaElement;
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        setter.call(rationale, 'draft rationale');
        rationale.dispatchEvent(new Event('input', { bubbles: true }));
        await act(async () => {});
        const save = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Save',
        );
        expect(save).toBeTruthy();
        await act(async () => {
            save!.click();
        });
        await act(async () => {});
        expect(calls.some((c) => c.startsWith('PATCH') && c.includes('/control-objectives/risks/r1/rating'))).toBe(true);
    });

    it('the edit-risk dialog offers only the enabled control objectives', async () => {
        await renderPage();
        await act(async () => {
            riskCard().click();
        });
        await act(async () => {});
        const text = document.body.textContent ?? '';
        expect(text).toContain('Edit risk');
        expect(text).toContain('Human oversight');
        expect(text).not.toContain('Transparency');
    });

    it('importing risks from the AI card refreshes the section instead of reloading the page', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const json = (payload: unknown) => Promise.resolve({ ok: true, json: async () => payload });
                const fresh = [
                    risk,
                    { ...risk, pid: 'r2', name: 'A new risk from the card', position: 2 },
                ];
                if (url.includes('/control-objectives/risks/from-card') && (init?.method ?? 'GET') === 'POST') {
                    return json({ created: [fresh[1]], updated: [] });
                }
                if (url.includes('/control-objectives/risks')) return json(fresh);
                if (url.includes('/control-objectives/mappings')) return json([]);
                if (url.includes('/control-objectives/profile')) {
                    return json({ objectives: ['O1'], key_objectives: ['O1'] });
                }
                if (url.includes('/control-objectives/catalogue')) {
                    return json([{ id: 'O1', macro_requirement: 'REQ1', text: 'Human oversight', assessment_mode: 'Control' }]);
                }
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        const importBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Reload risks'),
        );
        expect(importBtn).toBeTruthy();
        await act(async () => {
            importBtn!.click();
        });
        for (let i = 0; i < 30; i++) {
            if ((document.body.textContent ?? '').includes('A new risk from the card')) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 25));
            });
        }
        expect(calls.some((c) => c.startsWith('POST') && c.includes('/control-objectives/risks/from-card'))).toBe(true);
        // The imported risk appears in the DOM, driven by a refetch of the list
        // (a hard page reload would be in the way and would not show it here).
        expect(document.body.textContent ?? '').toContain('A new risk from the card');
        expect(
            calls.filter((c) => c.startsWith('GET') && c.endsWith('/control-objectives/risks')).length,
        ).toBeGreaterThanOrEqual(2);
    });

    it('does not call from-card when the AI card has no risks', async () => {
        const calls: string[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                calls.push(`${init?.method ?? 'GET'} ${url}`);
                const json = (payload: unknown) =>
                    Promise.resolve({ ok: true, json: async () => payload });
                if (url.endsWith('/projects/p1/qualification')) {
                    return json([
                        {
                            pid: 'd1',
                            questionnaire_id: 'q1',
                            answers: {},
                            status: 'completed',
                            system_version: { number: 1 },
                            system_card: { view: { counts: { risks: 0 }, risks: [] } },
                        },
                    ]);
                }
                if (url.includes('/control-objectives/risks')) return json([risk]);
                if (url.includes('/control-objectives/mappings')) return json([]);
                if (url.includes('/control-objectives/profile')) {
                    return json({ objectives: ['O1'], key_objectives: ['O1'] });
                }
                if (url.includes('/control-objectives/catalogue')) return json([]);
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        const importBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('Reload risks'),
        );
        expect(importBtn).toBeTruthy();
        await act(async () => {
            importBtn!.click();
        });
        for (let i = 0; i < 30; i++) {
            if (calls.some((c) => c.includes('/projects/p1/qualification'))) break;
            await act(async () => {
                await new Promise((r) => setTimeout(r, 25));
            });
        }
        expect(calls.some((c) => c.includes('/projects/p1/qualification'))).toBe(true);
        expect(
            calls.some((c) => c.startsWith('POST') && c.includes('/control-objectives/risks/from-card')),
        ).toBe(false);
    });

    it('the dialog shows the risk history and navigates an old version', async () => {
        // a rated risk (current revision v2) with two rated revisions to browse
        const ratedRisk = { ...risk, impact: 3, likelihood: 4, rating: 12, version: 2 };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((url: string, init?: RequestInit) => {
                const json = (payload: unknown) => Promise.resolve({ ok: true, json: async () => payload });
                if (url.includes('/control-objectives/risks/r1/versions')) {
                    return json([
                        { pid: 'rv1', risk_pid: 'r1', number: 1, name: 'Poisoned training data', impact: 1, likelihood: 2, rating: 2, comment: 'early', airo_text: '', created_at: '2026-01-01T00:00:00Z', created_by: '' },
                        { pid: 'rv2', risk_pid: 'r1', number: 2, name: 'Poisoned training data', impact: 3, likelihood: 4, rating: 12, comment: 'assessed', airo_text: '', created_at: '2026-01-02T00:00:00Z', created_by: '' },
                    ]);
                }
                if (url.includes('/control-objectives/risks')) return json([ratedRisk]);
                if (url.includes('/control-objectives/mappings')) return json([]);
                if (url.includes('/control-objectives/profile')) return json({ objectives: ['O1'], key_objectives: ['O1'] });
                if (url.includes('/control-objectives/catalogue')) return json([{ id: 'O1', macro_requirement: 'REQ1', text: 'Human oversight', assessment_mode: 'Control' }]);
                throw new Error(`unexpected fetch: ${url} ${init?.method ?? ''}`);
            }),
        );
        await renderPage();
        // the card starts on the current revision: v2 with its scores
        expect(riskCard().textContent).toContain('v2');
        expect(riskCard().textContent).toContain('Impact: 3');
        await act(async () => {
            riskCard().dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        const versionButton = (text: string) =>
            Array.from(document.body.querySelectorAll('button')).find((b) =>
                b.textContent?.includes(text),
            ) as HTMLButtonElement | undefined;
        const menuEntry = (text: string) => {
            const entries = Array.from(document.body.querySelectorAll('*')).filter(
                (el) => (el.textContent ?? '').trim() === text,
            );
            return entries.find((el) => !entries.some((n) => n !== el && el.contains(n))) as HTMLElement;
        };
        // the dropdown opens on the current (latest rated) revision, like the AI card
        expect(versionButton('v2 · 3×4')).toBeTruthy();
        await act(async () => {
            versionButton('v2 · 3×4')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        // both rated revisions are offered; picking one switches the dialog live
        expect(menuEntry('v1 · 1×2')).toBeTruthy();
        expect(menuEntry('v2 · 3×4')).toBeTruthy();
        await act(async () => {
            menuEntry('v1 · 1×2').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {});
        expect(versionButton('v1 · 1×2')).toBeTruthy();
        // leave the dialog without saving: the card now shows the picked v1
        // (frontend "remembered pick" like the AI card, no data written)
        const cancel = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent === 'Cancel',
        ) as HTMLButtonElement;
        await act(async () => {
            cancel.click();
        });
        await act(async () => {});
        expect(riskCard().textContent).toContain('v1');
        expect(riskCard().textContent).toContain('Impact: 1');
        expect(riskCard().textContent).toContain('Likelihood: 2');
    });
});
