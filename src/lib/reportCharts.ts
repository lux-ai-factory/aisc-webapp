import { createLimiter, settledValues } from './concurrency';
import { uploadReportChart, type EvaluationChartExport } from './report';

interface DashboardChart { key: string; kind: 'chart'; title?: string; comment?: string }
interface DashboardNote { key: string; kind: 'text'; text: string }
export type RenderedDashboardWidget = DashboardNote | (DashboardChart & { image: string });
export type ReportDashboardWidget = DashboardNote | (DashboardChart & { artifact_id: string });
export interface RenderedEvaluationChart extends Omit<EvaluationChartExport, 'panels'> {
    panels: Array<{ image: string; label?: string }>;
}

/** Upload without mutating render results; only artifact references cross the API. */
export async function uploadReportCharts(
    projectPid: string, reportPid: string,
    dashboard: RenderedDashboardWidget[], evaluations: RenderedEvaluationChart[],
) {
    const schedule = createLimiter(4);
    const panel = (image: string, label?: string) => schedule(async () => ({
        artifact_id: await uploadReportChart(projectPid, reportPid, image),
        ...(label === undefined ? {} : { label }),
    }));
    const dashboardJobs = dashboard.map((widget): Promise<ReportDashboardWidget> => {
        if (widget.kind === 'text') return Promise.resolve({ ...widget });
        const { image, ...metadata } = widget;
        return panel(image).then((reference) => ({ ...metadata, ...reference }));
    });
    const evaluationJobs = evaluations.map(async (chart): Promise<EvaluationChartExport> => ({
        ...chart, panels: await settledValues(chart.panels.map((p) => panel(p.image, p.label))),
    }));
    // Drain every upload, including both groups, before returning any failure.
    const groups = [settledValues(dashboardJobs), settledValues(evaluationJobs)] as const;
    await Promise.allSettled(groups);
    const [widgets, charts] = await Promise.all(groups);
    return { dashboard: widgets, evaluation_charts: charts };
}
