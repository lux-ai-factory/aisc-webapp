// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import VersionSelect from './VersionSelect';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const options = [
    { id: '1', label: 'v1' },
    { id: '2', label: 'v2' },
];

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

async function renderSelect(value: string | null, fallbackLabel?: string) {
    const calls: string[] = [];
    await act(async () => {
        root.render(
            <VersionSelect
                options={options}
                value={value}
                fallbackLabel={fallbackLabel}
                ariaLabel="test version"
                onSelect={(id) => calls.push(id ?? '')}
            />,
        );
    });
    const trigger = () =>
        document.body.querySelector<HTMLButtonElement>('button[aria-label="test version"]');
    const open = async () => {
        await act(async () => {
            trigger()!.click();
        });
        await act(async () => {});
    };
    return { calls, trigger, open };
}

describe('VersionSelect', () => {
    it('shows the label of the active option on the trigger', async () => {
        const { trigger } = await renderSelect('2');
        expect(trigger()?.textContent).toContain('v2');
    });

    it('shows the fallback label when no option matches the value', async () => {
        const { trigger } = await renderSelect(null, 'current');
        expect(trigger()?.textContent).toContain('current');
    });

    it('opens the menu on click, marks the active item with a circle radio, and selects on item click', async () => {
        const { open, calls } = await renderSelect('2');
        await open();
        const items = Array.from(document.body.querySelectorAll('.MuiMenuItem-root'));
        expect(items.length).toBe(2);
        const activeRadio = items[1]?.querySelector('input') as HTMLInputElement | null;
        expect(activeRadio?.checked).toBe(true);
        await act(async () => {
            (items[0] as HTMLElement).click();
        });
        await act(async () => {});
        expect(calls).toEqual(['1']);
    });

    it('is disabled when there are no options', async () => {
        await act(async () => {
            root.render(
                <VersionSelect
                    options={[]}
                    value={null}
                    ariaLabel="empty version"
                    onSelect={() => {}}
                />,
            );
        });
        const trigger = document.body.querySelector<HTMLButtonElement>(
            'button[aria-label="empty version"]',
        );
        expect(trigger?.disabled).toBe(true);
    });
});
