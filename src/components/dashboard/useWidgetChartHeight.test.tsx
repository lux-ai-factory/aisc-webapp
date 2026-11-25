// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useWidgetChartHeight } from './useWidgetChartHeight';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([1, 2, 6])('fits %i surfaces, reserving wrapped legends, toolbar and facet labels', async (count) => {
    let bodyHeight = 1000;
    let chrome = 80;
    const callbacks: Array<() => void> = [];
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { callbacks.push(callback); }
        observe() {}
        disconnect = disconnect;
    });
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-body') ? bodyHeight : Number(this.getAttribute('height'));
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return [...this.querySelectorAll('svg')].reduce((sum, svg) => sum + Number(svg.getAttribute('height')), chrome);
    });
    // A scaled preview must never mix screen pixels with unscaled body sizes.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 1, width: 1 } as DOMRect);
    function Harness() {
        const body = useRef<HTMLDivElement>(null);
        const content = useRef<HTMLDivElement>(null);
        const height = useWidgetChartHeight(body, content, true);
        return <div ref={body} data-body style={{ padding: 8 }}>
            <div ref={content} data-content>
                {Array.from({ length: count }, (_, index) =>
                    <svg key={index} className="MuiChartsSurface-root" height={height ?? 400} />)}
            </div>
        </div>;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const current = () => Number(container.querySelector('svg')!.getAttribute('height'));
    const resize = async () => {
        await act(async () => {
            callbacks.forEach((callback) => callback());
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        });
    };
    try {
        await act(async () => root.render(<Harness />));
        expect(current()).toBe(Math.max(200, Math.floor((1000 - 16 - 80) / count)));
        chrome = 160; // narrow width wraps the legend onto more lines
        bodyHeight = 1200; // resizing or a changing comment footer changes the available body
        await resize();
        expect(current()).toBe(Math.max(200, Math.floor((1200 - 16 - 160) / count)));
        const stable = current();
        await resize();
        expect(current()).toBe(stable); // changing SVG size does not grow its parent repeatedly
        bodyHeight = 150;
        await resize();
        expect(current()).toBe(200); // small cards retain readable plots and may scroll
    } finally {
        await act(async () => root.unmount());
        container.remove();
    }
    expect(disconnect).toHaveBeenCalledOnce();
});
