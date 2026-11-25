import { settledValues } from './concurrency';
import { combineByPlugin, getDoneEvaluations, getPluginMeasurements, type GridWidget, type EvalRow, type EvalPluginResults } from './dashboardCharts';
import { evalTitle } from './sandbox';
import { exportChartPanels } from '../components/dashboard/reportChartExport';
import { chartWidgetToViz } from '../components/dashboard/dashboardPlot';
import type { Measurement } from '../models/models';
import type { RenderedDashboardWidget as ReportDashboardWidget } from './reportCharts';

/** Render independently of the picker so navigation cannot interrupt preparation. */
export async function exportDashboardWidgets(projectPid: string, widgets: GridWidget[], selected: Set<string>) {
    const evaluations = widgets.some(widget => widget.kind !== 'text' && selected.has(widget.key))
        ? await getDoneEvaluations(projectPid) : [];
    const pairs = new Map<string, Promise<EvalRow>>();
    for (const widget of widgets) {
        if (widget.kind === 'text' || !widget.plugin || !selected.has(widget.key)) continue;
        for (const evaluation of evaluations) {
            if (widget.evaluations?.length && !widget.evaluations.includes(evaluation.pid)) continue;
            const plugin = evaluation.evaluation_plugins?.find(p => p.name === widget.plugin);
            if (!plugin) continue;
            const key = `${evaluation.pid}|${widget.plugin}`;
            if (!pairs.has(key)) pairs.set(key, getPluginMeasurements(plugin.pid, evaluation.pid)
                .then(result => makeRow(plugin.name, evaluation.pid, evalTitle(evaluation), plugin.pid, result)));
        }
    }
    const rows = await settledValues([...pairs.values()]);
    const dataFor = (widget: GridWidget) => ({ measurements: combineByPlugin(rows.filter(row =>
        row.pluginName === widget.plugin && (!widget.evaluations?.length || widget.evaluations.includes(row.evalUuid))
    )).get(widget.plugin ?? '') ?? [] });
    const pending: Array<Promise<ReportDashboardWidget[]>> = [];
    widgets.forEach((widget) => {
        if (!selected.has(widget.key)) return;
        if (widget.kind === 'text') {
            pending.push(Promise.resolve([{
                key: widget.key, kind: 'text', text: widget.text ?? '',
            } as ReportDashboardWidget]));
            return;
        }
        const data = dataFor(widget).measurements ?? [];
        if (data.length === 0) {
            pending.push(Promise.resolve([]));
            return;
        }
        pending.push(
            renderChartImage(widget, data)
                .then((panels) => panels.filter((panel) => panel.image).map((panel, index) => ({
                    key: panels.length === 1 ? widget.key : `${widget.key.slice(0, 240)}:panel:${index}`,
                    kind: 'chart' as const,
                    title: panels.length === 1 ? widget.title
                        : [widget.title, panel.label].filter(Boolean).join(' · ').slice(0, 200),
                    comment: widget.comment,
                    image: panel.image,
                })))
                .catch((error) => {
                    console.warn(
                        `dashboard export: widget ${widget.key} failed: `
                        + (error instanceof Error ? error.message : String(error)),
                    );
                    return [];
                }),
        );
    });
    const results = await settledValues(pending);
    return results.flat();
}

async function renderChartImage(widget: GridWidget, data: Measurement[]) {
    const panels = await exportChartPanels(data, chartWidgetToViz(widget), {
        title: widget.title, labelOverrides: widget.labelOverrides, seriesOrder: widget.labelOrder,
        groupByEvaluation: true,
    });
    return panels;
}

function makeRow(
    plugin: string, evalUuid: string, evalLabel: string, epPid: string, res: EvalPluginResults,
): EvalRow {
    return { index: 0, evalUuid, evalLabel, pluginName: plugin,
        evalPluginPid: epPid, measurements: res.measurements ?? [],
        metric_visualizations: res.metric_visualizations };
}
