/** Export a dashboard chart the way the webapp draws it.
 *
 * The report's PDF engine cannot read the app's stylesheets, so the chart is
 * rasterized in the browser: the chart surface is serialized as a
 * self-contained SVG (computed styles inlined on every element), drawn to a
 * canvas, and the title + legend — which MUI renders as HTML, not SVG — are
 * drawn on top with canvas2D from the parsed live DOM. The result is ONE PNG
 * data URI that includes title + chart + legend, ready for the report to embed.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_STYLE_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
    'opacity', 'font-family', 'font-size', 'font-style', 'font-weight',
    'text-anchor', 'dominant-baseline', 'letter-spacing', 'stroke-linecap',
    'stroke-linejoin', 'stroke-dasharray',
] as const;

/** Copy each live element's computed styles onto the matching clone element
 *  (in lockstep), so the exported SVG carries every colour/length/font the
 *  app's CSS gave it. */
function applyComputedStyles(source: Element, target: Element): void {
    const style = getComputedStyle(source);
    for (const prop of CHART_STYLE_PROPS) {
        const value = style.getPropertyValue(prop);
        if (value && value !== 'none') (target as SVGElement).style.setProperty(prop, value);
    }
    const sourceChildren = Array.from(source.children);
    const targetChildren = Array.from(target.children);
    const n = Math.min(sourceChildren.length, targetChildren.length);
    for (let i = 0; i < n; i++) {
        applyComputedStyles(sourceChildren[i] as Element, targetChildren[i] as Element);
    }
}

/** The chart's main <svg> in a block: MUI's chart surface, not the tiny legend
 *  marker svgs (each legend item is its own ~13px <svg><rect|circle>). */
function surfaceSvgOf(container: HTMLElement): SVGSVGElement | null {
    const svgs = Array.from(container.querySelectorAll<SVGSVGElement>('svg'));
    if (!svgs.length) return null;
    const legendUls = Array.from(container.querySelectorAll('ul')).filter((u) =>
        String(u.className).includes('MuiChartsLegend'),
    );
    const notMarker = svgs.filter((s) => !legendUls.some((ul) => ul.contains(s)));
    if (!notMarker.length) return null;
    const surface = notMarker.find((s) => s.classList.contains('MuiChartsSurface-root'));
    if (surface) return surface;
    return notMarker.reduce((a, b) =>
        b.querySelectorAll('*').length > a.querySelectorAll('*').length ? b : a,
    );
}

/** The chart surface as ONE self-contained vector SVG (computed styles
 *  inlined). No title/legend — those are drawn onto the raster by chartImage.
 *  Undefined when no chart was drawn. */
export function serializeChartSurfaceSvg(
    container: HTMLElement | undefined | null,
): string | undefined {
    const svg = container ? surfaceSvgOf(container) : null;
    if (!svg) return undefined;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    applyComputedStyles(svg, clone);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', SVG_NS);
    if (!clone.getAttribute('viewBox')) {
        const vb = parseViewBox(clone);
        clone.setAttribute('viewBox', `0 0 ${vb.w || 600} ${vb.h || 260}`);
    }
    return new XMLSerializer().serializeToString(clone);
}

/** The last two numbers of an svg's viewBox (its intrinsic size). */
function parseViewBox(el: SVGSVGElement): { w: number; h: number } {
    const vb = (el.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number);
    return { w: Number(vb[vb.length - 2]) || 0, h: Number(vb[vb.length - 1]) || 0 };
}

export interface LegendItem {
    label: string;
    color: string;
    type: 'square' | 'circle' | 'line';
}

/** The chart's legend as it renders: one entry per MUI legend <li> (label text
 *  + the marker's fill colour and shape), so the legend can be drawn onto the
 *  raster — the legend is HTML, it never lives inside the chart's svg. */
export function readLegendItems(container: HTMLElement | undefined | null): LegendItem[] {
    if (!container) return [];
    const ul = Array.from(container.querySelectorAll('ul')).find((u) =>
        String(u.className).includes('MuiChartsLegend'),
    );
    if (!ul) return [];
    const items: LegendItem[] = [];
    ul.querySelectorAll('li').forEach((li) => {
        const label = (li.textContent ?? '').trim();
        if (!label) return;
        const mark = li.querySelector('div[class*="MuiChartsLabelMark"]');
        const margin = String(mark?.className ?? '');
        const type: LegendItem['type'] = margin.includes('circle')
            ? 'circle'
            : margin.includes('line')
              ? 'line'
              : 'square';
        items.push({
            label,
            color: li.querySelector('rect,circle')?.getAttribute('fill') ?? '#1976d2',
            type,
        });
    });
    return items;
}

/** The chart as an embeddable PNG data URI: the vector surface rasterized at a
 *  fixed resolution, with the title and legend drawn on top with canvas2D —
 *  so the image always contains the complete plot. */
export async function chartImage(
    surfaceMarkup: string,
    title = '',
    legend: LegendItem[] = [],
): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Chart export requires canvas support');

    const vb = parseViewBoxMarkup(surfaceMarkup);
    const width = 1000;
    const chartHeight = Math.max(Math.round(width * ((vb.h || 260) / (vb.w || 600))), 160);
    const titleBand = title ? 34 : 0;
    const legendLayout = layoutLegend(ctx, legend, width);
    const legendHeight = legend.length ? legendLayout.height + 6 + 4 : 0;

    canvas.width = width;
    canvas.height = chartHeight + titleBand + legendHeight;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, canvas.height);

    if (title) {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '700 18px Inter, Arial, sans-serif';
        ctx.fillText(title, 10, 24);
    }

    const img = await loadSvgImage(surfaceMarkup);
    ctx.drawImage(img, 0, titleBand, width, chartHeight);

    drawLegend(ctx, legendLayout.items, titleBand + chartHeight + 6);
    return canvas.toDataURL('image/png');
}

function parseViewBoxMarkup(markup: string): { w: number; h: number } {
    const vb = /viewBox="([^"]*)"/.exec(markup);
    const parts = vb?.[1].trim().split(/\s+/).map(Number) ?? [];
    return { w: Number(parts[parts.length - 2]) || 0, h: Number(parts[parts.length - 1]) || 0 };
}

function loadSvgImage(markup: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('svg load failed'));
        img.src = svgDataUri(markup);
    });
}

const LEGEND_FONT = '12px Inter, Arial, sans-serif';
const LEGEND_PADDING = 10;
const LEGEND_MARKER_GAP = 6;
const LEGEND_ITEM_GAP = 16;
const LEGEND_LINE_HEIGHT = 22;

interface PositionedLegendItem {
    item: LegendItem;
    lines: string[];
    x: number;
    y: number;
}

/** Wrap words, breaking oversized tokens without dropping any characters. */
function wrapLegendLabel(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of label.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
            line = candidate;
            continue;
        }
        if (line) lines.push(line);
        line = '';
        for (const character of word) {
            if (line && ctx.measureText(line + character).width > maxWidth) {
                lines.push(line);
                line = '';
            }
            line += character;
        }
    }
    if (line || lines.length === 0) lines.push(line);
    return lines;
}

/** Measure once; drawing uses these exact positions and wrapped lines. */
function layoutLegend(ctx: CanvasRenderingContext2D, items: LegendItem[], width: number) {
    ctx.font = LEGEND_FONT;
    const availableWidth = width - 2 * LEGEND_PADDING;
    const positioned: PositionedLegendItem[] = [];
    let x = LEGEND_PADDING;
    let y = 0;
    let rowHeight = 0;
    for (const item of items) {
        const markerWidth = markerSize(item.type) + LEGEND_MARKER_GAP;
        const lines = wrapLegendLabel(ctx, item.label, availableWidth - markerWidth);
        const itemWidth = markerWidth + Math.max(...lines.map((line) => ctx.measureText(line).width));
        if (x > LEGEND_PADDING && x + itemWidth > width - LEGEND_PADDING) {
            y += rowHeight;
            x = LEGEND_PADDING;
            rowHeight = 0;
        }
        positioned.push({ item, lines, x, y });
        rowHeight = Math.max(rowHeight, lines.length * LEGEND_LINE_HEIGHT);
        x += itemWidth + LEGEND_ITEM_GAP;
    }
    return { items: positioned, height: y + rowHeight };
}

function markerSize(type: LegendItem['type']): number {
    return type === 'circle' ? 15 : type === 'line' ? 16 : 13;
}

function drawLegend(
    ctx: CanvasRenderingContext2D,
    items: PositionedLegendItem[],
    startY: number,
): void {
    // Resizing the canvas resets its font, so restore the measurement font.
    ctx.font = LEGEND_FONT;
    ctx.textBaseline = 'alphabetic';
    for (const { item, lines, x, y: offsetY } of items) {
        const y = startY + offsetY;
        const size = markerSize(item.type);
        ctx.fillStyle = item.color;
        if (item.type === 'circle') {
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (item.type === 'line') {
            ctx.fillRect(x, y + (size - 4) / 2, size, 4);
        } else {
            ctx.fillRect(x, y, 13, 13);
        }
        ctx.fillStyle = '#1a1a1a';
        lines.forEach((line, index) => {
            ctx.fillText(line, x + size + LEGEND_MARKER_GAP, y + 14 + index * LEGEND_LINE_HEIGHT);
        });
    }
}

function svgDataUri(svgMarkup: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}
