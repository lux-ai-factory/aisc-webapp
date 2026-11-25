import { useSyncExternalStore } from 'react';
import { exportEvaluationCharts } from './evaluationChartExport';
import { uploadReportCharts, type RenderedDashboardWidget } from './reportCharts';
import { cleanSections, deleteReport, generateReport, prepareReport, setReportSettings,
    type PastReport, type ReportSettingsPayload } from './report';

interface ReportJob { running: boolean; report?: PastReport; error?: string }
const jobs = new Map<string, ReportJob>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const publish = (pid: string, job: ReportJob) => {
    jobs.set(pid, job);
    listeners.forEach(listener => listener());
};
export function useReportGeneration(pid: string | null) {
    return useSyncExternalStore(subscribe, () => pid ? jobs.get(pid) : undefined);
}

/** Own the whole preparation independently of mounted routes and their UI state. */
export function startReportGeneration(pid: string, input: {
    settings: ReportSettingsPayload; period: string; evaluations: string[];
}, exportDashboard: () => Promise<RenderedDashboardWidget[]>) {
    if (jobs.get(pid)?.running) return;
    const snapshot = structuredClone(input);
    publish(pid, { running: true });
    void (async () => {
        let draft: PastReport | undefined;
        let submitted = false;
        try {
            const sections = cleanSections(snapshot.settings.default_sections);
            const preparations = [setReportSettings(pid, snapshot.settings), exportDashboard(),
                !sections.length || sections.includes('evaluations')
                    ? exportEvaluationCharts(pid, snapshot.evaluations) : Promise.resolve([])] as const;
            preparations.forEach(promise => { void promise.catch(() => {}); });
            draft = await prepareReport(pid, snapshot.period, snapshot.settings.default_format);
            publish(pid, { running: true, report: draft });
            await Promise.allSettled(preparations);
            const [settings, dashboard, evaluations] = await Promise.all(preparations);
            const charts = await uploadReportCharts(pid, draft.pid, dashboard, evaluations);
            submitted = true;
            const report = await generateReport(pid, { report_pid: draft.pid, period: snapshot.period,
                format: settings.default_format, evaluation_pids: snapshot.evaluations,
                sections: cleanSections(settings.default_sections), ...charts });
            publish(pid, { running: false, report });
        } catch (error) {
            if (draft && !submitted) await deleteReport(pid, draft.pid).catch(() => {});
            publish(pid, { running: false, report: submitted ? draft : undefined,
                error: error instanceof Error ? error.message : 'Report generation failed' });
        }
    })();
}
