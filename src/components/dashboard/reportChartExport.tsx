import { createLimiter, settledValues } from '../../lib/concurrency';
import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type {} from '@mui/x-charts/themeAugmentation';
import type { Measurement, MetricVisualization } from '../../models/models';
import { selectMeasurements } from '../../lib/dashboardCharts';
import { renderVisualization } from './dashboardPlot';
import { chartImage, readLegendItems, serializeChartSurfaceSvg } from './dashboardExport';

const exportTheme = createTheme({
    palette: { mode: 'light' },
    components: { MuiChartDataProvider: { defaultProps: { skipAnimation: true } } },
});
const scheduleChart = createLimiter(2);
const pause = () => new Promise((resolve) => setTimeout(resolve, 50));

async function waitForSurface(host: HTMLElement): Promise<string> {
    let previous = '';
    let stable = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
        await pause();
        const svg = host.querySelector<SVGSVGElement>('svg.MuiChartsSurface-root');
        const bounds = svg?.getBoundingClientRect();
        const markup = serializeChartSurfaceSvg(host);
        const hasMarks = svg?.querySelector('path[d], rect[height], circle[r], ellipse[rx]');
        if (bounds && bounds.width > 0 && bounds.height > 0 && hasMarks && markup) {
            stable = markup === previous ? stable + 1 : 0;
            if (stable >= 3) return markup;
            previous = markup;
        }
    }
    throw new Error('Chart did not finish rendering for export');
}

/** Render each facet independently so no SVG surface is lost during export. */
export async function exportChartPanels(
    data: Measurement[], viz: MetricVisualization,
    options: { title?: string; labelOverrides?: Record<string, string>; seriesOrder?: string[];
        groupByEvaluation?: boolean } = {},
): Promise<Array<{ image: string; svg: string; label?: string }>> {
    if (!['line', 'scatter', 'kde', 'bars', 'radar', 'pie'].includes(viz.chart_type)) return [];
    const filtered = selectMeasurements(data, viz.metrics ?? [], viz.filter_dimensions ?? {});
    if (!filtered.length) return [];
    const facet = viz.facet_by_dimension?.[0];
    const values = facet ? [...new Set(filtered.map((row) => row.dimensions?.[facet])
        .filter((value) => value != null).map(String))].sort() : [];
    const panels = values.length ? values.map((value) => ({
        label: `${facet}: ${value}`,
        data: filtered.filter((row) => String(row.dimensions?.[facet!]) === value),
    })) : [{ label: undefined, data: filtered }];
    return settledValues(panels.map((panel) => scheduleChart(async () => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;background:white;';
        document.body.appendChild(host);
        const root = createRoot(host);
        try {
            if (document.fonts) await Promise.race([
                document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
            root.render(<ThemeProvider theme={exportTheme}>
                {renderVisualization(panel.data, { ...viz, title: undefined,
                    description: undefined, facet_by_dimension: undefined },
                options.labelOverrides, options.seriesOrder, ['line', 'bars'].includes(viz.chart_type) ? 430 : 400, false,
                options.groupByEvaluation ?? false)}
            </ThemeProvider>);
            const svg = await waitForSurface(host);
            const image = await chartImage(svg, options.title ?? '', readLegendItems(host));
            return { image, svg, label: panel.label };
        } finally {
            root.unmount();
            host.remove();
        }
    })));
}
