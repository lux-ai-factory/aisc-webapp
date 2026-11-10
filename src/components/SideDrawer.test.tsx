// @vitest-environment jsdom
//
// SideDrawer: the right-hand resizable panel. Tests the context-agnostic core —
// open/close, resizable width via the drag handle, the version gutter, the
// edit-mode footer, and Esc-to-close. Uses the repo's own component-test style
// (react-dom createRoot + act, no extra test libraries).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import SideDrawer, { VersionEntry } from './SideDrawer';

// React 18 needs this flag in a non-@testing-library jsdom run to flush
// MUI's Portal/Transition work inside act().
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
});

function renderPanel(props: Partial<React.ComponentProps<typeof SideDrawer>> = {}) {
    const onClose = vi.fn();
    act(() => {
        root.render(
            <SideDrawer open onClose={onClose} title="A panel" {...props}>
                <div>content here</div>
            </SideDrawer>,
        );
    });
    return { onClose };
}

// MUI mounts the Drawer through a Portal on the next tick; flush it before
// asserting against the rendered DOM.
async function settle() {
    await act(async () => {});
}

// MUI Drawer mounts through a Portal into document.body, so we search the body.
function paper(): HTMLElement {
    const el = document.body.querySelector('.MuiDrawer-paper') as HTMLElement;
    if (!el) throw new Error('no drawer paper rendered');
    return el;
}

function text(t: string): HTMLElement | null {
    return Array.from(document.body.querySelectorAll('*')).find(
        (el) => el.textContent === t,
    ) as HTMLElement | null;
}

function mockElRect(el: Element, left: number, width: number) {
    Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({
            left,
            width,
            right: left + width,
            top: 0,
            bottom: 0,
            height: 500,
            x: left,
            y: 0,
            toJSON: () => ({}),
        }),
        configurable: true,
    });
}

async function drag(widths: [number, number, number]) {
    const handle = document.body.querySelector('[role="separator"]') as HTMLElement;
    if (!handle) throw new Error('no resize handle rendered');
    await act(async () => {
        handle.dispatchEvent(new MouseEvent('mousedown', { clientX: widths[0], bubbles: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: widths[1], bubbles: true }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
}

describe('SideDrawer', () => {
    it('renders children and the title while open', async () => {
        renderPanel();
        await settle();
        expect(text('content here')).toBeTruthy();
        expect(text('A panel')).toBeTruthy();
    });

    it('calls onClose when the Escape key is pressed', async () => {
        const { onClose } = renderPanel();
        await settle();
        await act(async () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resizes by dragging the left edge', async () => {
        const { onClose } = renderPanel({ defaultWidth: 480, minWidth: 320, maxWidth: 600 });
        await settle();
        mockElRect(paper(), 600, 480);
        // drag left edge right by 60 -> narrower (480 - 60 = 420)
        await drag([600, 660, 0]);
        expect(paper().style.width).toBe('420px');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('clamps the width to min/max', async () => {
        renderPanel({ defaultWidth: 480, minWidth: 320, maxWidth: 520 });
        await settle();
        await drag([800, 200, 0]);
        expect(paper().style.width).toBe('520px');   // capped at max
        await drag([500, 900, 0]);
        expect(paper().style.width).toBe('320px');   // floored at min
    });

    it('renders the version dropdown and selects via its checkbox', async () => {
        const versions: VersionEntry[] = [
            { id: 'v1', label: 'v1' },
            { id: 'v2', label: 'v2' },
        ];
        const onSelectVersion = vi.fn();
        renderPanel({ versions, selectedVersionId: 'v1', onSelectVersion });
        await settle();

        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').includes('v1'),
        ) as HTMLElement;
        expect(trigger).toBeTruthy();
        await act(async () => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });

        const boxes = Array.from(
            document.body.querySelectorAll('input[type="checkbox"]'),
        ) as HTMLElement[];
        const v2 = boxes[1] ?? boxes[0];
        expect(v2).toBeTruthy();
        await act(async () => {
            v2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });
        expect(onSelectVersion).toHaveBeenCalledWith({ id: 'v2', label: 'v2' }, 1);
    });

    it('shows the selected version on the dropdown trigger', async () => {
        renderPanel({ versions: [{ id: 'vX', label: 'vX' }], selectedVersionId: 'vX' });
        await settle();
        const trigger = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent ?? '').includes('vX'),
        );
        expect(trigger).toBeTruthy();
    });

    it('renders Save/Cancel only in edit mode', async () => {
        renderPanel({ mode: 'edit', onSave: vi.fn(), onCancel: vi.fn() });
        await settle();
        expect(text('Save')).toBeTruthy();
        expect(text('Cancel')).toBeTruthy();
    });

    it('does not render Save/Cancel in static mode', async () => {
        renderPanel({ mode: 'static' });
        await settle();
        expect(document.body.textContent).not.toContain('Save');
        expect(document.body.textContent).not.toContain('Cancel');
    });
});
