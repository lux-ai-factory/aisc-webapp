// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { chartImage, type LegendItem } from './dashboardExport';

const textWidth = (label: string) => [...label].reduce((width, character) =>
    width + (character === 'W' ? 12 : character === 'i' ? 3 : 6), 0);
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let texts: Array<{ label: string; x: number; y: number; font: string }>;
let markers: Array<{ x: number; y: number; width: number; height: number }>;
const surface = '<svg viewBox="0 0 1000 400"><rect width="1000" height="400"/></svg>';
const item = (label: string): LegendItem => ({ label, color: '#123456', type: 'square' });

beforeEach(() => {
    texts = [];
    markers = [];
    ctx = {
        font: '',
        measureText: vi.fn((label: string) => {
            expect(ctx.font).toBe('12px Inter, Arial, sans-serif');
            return { width: textWidth(label) };
        }),
        fillText: (label: string, x: number, y: number) => texts.push({ label, x, y, font: ctx.font }),
        fillRect: (x: number, y: number, width: number, height: number) => markers.push({ x, y, width, height }),
        drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    canvas = document.createElement('canvas');
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
    vi.stubGlobal('Image', class {
        onload = () => {};
        set src(value: string) { void value; queueMicrotask(() => this.onload()); }
    });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses actual glyph widths and leaves 16px between legend items', async () => {
    const wide = 'W'.repeat(20);
    await chartImage(surface, '', [item(wide), item('iii')]);
    expect(texts[1].y).toBe(texts[0].y);
    const firstTextEnd = texts[0].x + textWidth(wide);
    const secondMarker = markers[2]; // background, first marker, second marker
    expect(secondMarker.x - firstTextEnd).toBe(16);
    expect(texts[1].x - (secondMarker.x + secondMarker.width)).toBe(6);
    expect(canvas.width).toBe(1000);
});

it('wraps items whose measured widths exceed the row', async () => {
    await chartImage(surface, '', [item('W'.repeat(50)), item('W'.repeat(50))]);
    expect(texts[1].x).toBe(texts[0].x);
    expect(texts[1].y - texts[0].y).toBe(22);
    expect(texts[1].y + 4).toBeLessThan(canvas.height);
});

it.each(['long words '.repeat(100), 'W'.repeat(200)])('wraps oversized labels without clipping', async (label) => {
    await chartImage(surface, '', [item(label), item('Next item')]);
    expect(texts.length).toBeGreaterThan(2);
    const wrapped = texts.slice(0, -1);
    expect(wrapped.map((text) => text.label).join('').replace(/\s/g, ''))
        .toBe(label.replace(/\s/g, ''));
    for (const text of texts) {
        expect(text.x + textWidth(text.label)).toBeLessThanOrEqual(990);
        expect(text.y + 4).toBeLessThan(canvas.height);
    }
    // A following item is placed below the entire multiline label.
    expect(texts[texts.length - 1].y).toBeGreaterThan(wrapped[wrapped.length - 1].y);
});

it('uses the same font after drawing a title and preserves chart dimensions', async () => {
    await chartImage(surface, 'Title', [item('Legend')]);
    expect(texts[0].font).toBe('700 18px Inter, Arial, sans-serif');
    expect(texts[1].font).toBe('12px Inter, Arial, sans-serif');
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 34, 1000, 400);
});

it('adds no legend space when the legend is empty', async () => {
    await chartImage(surface);
    expect(texts).toHaveLength(0);
    expect(canvas.height).toBe(400);
});
