import { createLimiter, settledValues } from './concurrency';
import { API_VERSION_PREFIX } from '../config';
import { refreshDoneEvaluations, type EvalPluginResults } from './dashboardCharts';
import type { RenderedEvaluationChart as EvaluationChartExport } from './reportCharts';

/** Export only the selected completed runs, without session-cached measurements. */
export async function exportEvaluationCharts(projectPid: string, selected: string[]) {
    const charts: EvaluationChartExport[] = [];
    if (!selected.length) return charts;
    const evaluations = await refreshDoneEvaluations(projectPid);
    const scheduleFetch = createLimiter(4);
    const plugins = evaluations.filter((run) => selected.includes(run.pid)).flatMap((evaluation) =>
        (evaluation.evaluation_plugins ?? []).map((plugin) => ({ evaluation, plugin })),
    );
    const exporter = import('../components/dashboard/reportChartExport');
    void exporter.catch(() => {});
    const groups = await settledValues(plugins.map(async ({ evaluation, plugin }) => {
        try {
            const result = await scheduleFetch(async () => {
                const response = await fetch(`${import.meta.env.VITE_API_URL}${API_VERSION_PREFIX}/plugins/${plugin.pid}/evaluations/${evaluation.pid}/result`);
                if (!response.ok) throw new Error('Cannot load evaluation charts');
                return await response.json() as EvalPluginResults;
            });
            const { exportChartPanels } = await exporter;
            return await settledValues((result.metric_visualizations ?? []).map(async (viz, index): Promise<EvaluationChartExport | null> => {
                if (viz.chart_type === 'table') return null;
                let panels: EvaluationChartExport['panels'] = [];
                try {
                    panels = await exportChartPanels(result.measurements ?? [], viz, { title: viz.title ?? undefined });
                } catch (error) {
                    console.warn('Evaluation chart export failed', error);
                }
                return { evaluation_pid: evaluation.pid, evaluation_plugin_pid: plugin.pid,
                    visualization_index: index, panels: panels.map(({ image, label }) => ({ image, label })) };
            }));
        } catch (error) {
            console.warn('Evaluation chart data unavailable', error);
            return [];
        }
    }));
    return groups.flat().filter((chart): chart is EvaluationChartExport => chart !== null);
}
