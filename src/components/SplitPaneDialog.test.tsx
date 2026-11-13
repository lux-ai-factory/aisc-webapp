// @vitest-environment jsdom
//
// SplitPaneDialog: the reusable master/detail dialog. Covers default selection,
// switching panes without closing, disabled items, and the empty state. Uses
// the repo's own component-test style (react-dom createRoot + act).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import SplitPaneDialog, { SplitPaneItem } from './SplitPaneDialog';

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

const items: SplitPaneItem[] = [
    { id: 'general', label: 'General', icon: 'i', content: <div>General detail</div> },
    { id: 'appearance', label: 'Appearance', content: <div>Appearance detail</div> },
    { id: 'disabled', label: 'Disabled', disabled: true, content: <div>Disabled detail</div> },
];

function renderDialog(props: Partial<React.ComponentProps<typeof SplitPaneDialog>> = {}) {
    const onClose = vi.fn();
    act(() => {
        root.render(<SplitPaneDialog open onClose={onClose} title="Settings" items={items} {...props} />);
    });
    return { onClose };
}

async function settle() {
    await act(async () => {});
}

function byText(t: string): HTMLElement | null {
    return (
        (Array.from(document.body.querySelectorAll('*')).find(
            (el) => el.childElementCount === 0 && el.textContent === t,
        ) as HTMLElement | undefined) ?? null
    );
}

describe('SplitPaneDialog', () => {
    it('opens with the first enabled item selected and shows its detail', async () => {
        renderDialog();
        await settle();
        expect(byText('General detail')).not.toBeNull();
        expect(byText('Appearance detail')).toBeNull();
    });

    it('respects defaultSelectedId and switches panes without closing', async () => {
        const { onClose } = renderDialog({ defaultSelectedId: 'appearance' });
        await settle();
        expect(byText('Appearance detail')).not.toBeNull();

        act(() => {
            byText('General')?.click();
        });
        await settle();
        expect(byText('General detail')).not.toBeNull();
        expect(byText('Appearance detail')).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('cannot select a disabled item', async () => {
        renderDialog();
        await settle();
        act(() => {
            byText('Disabled')?.click();
        });
        await settle();
        expect(byText('Disabled detail')).toBeNull();
    });

    it('renders the empty state without crashing', async () => {
        renderDialog({ items: [] });
        await settle();
        expect(byText('No items.')).not.toBeNull();
    });
});
