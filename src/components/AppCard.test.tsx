// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AppCard from './AppCard';

it('supports keyboard activation without intercepting child controls', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const clicked = vi.fn();
    await act(async () => root.render(<AppCard onClick={clicked}><button>Child</button></AppCard>));
    const card = host.querySelector('[role="button"]')!;
    expect(card.getAttribute('tabindex')).toBe('0');
    for (const key of ['Enter', ' ']) card.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    host.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicked).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
});
