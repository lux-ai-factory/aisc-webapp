import { API_VERSION_PREFIX } from '../config';

export const REPORT_SECTIONS = ['system', 'controls', 'objectives', 'evaluations'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export interface ReportSettings {
    pid: string;
    default_format: string;
    default_sections: string[];
    updated_by: string;
}

export interface PastReport {
    pid: string;
    project_id: string;
    period: string;
    format: string;
    file_ref: string;
    status: string;
    created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!res.ok) throw new Error(`request failed: ${res.status} ${path}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

export function getReportSettings(pid: string): Promise<ReportSettings | null> {
    return request<ReportSettings>(`/projects/${pid}/report-settings`).catch((e: unknown) => {
        if (e instanceof Error && e.message.includes('404')) return null;
        throw e;
    });
}

export function setReportSettings(
    pid: string,
    data: { default_format: string; default_sections: string[] },
): Promise<ReportSettings> {
    return request<ReportSettings>(`/projects/${pid}/report-settings`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function listReports(pid: string): Promise<PastReport[]> {
    return request<PastReport[]>(`/projects/${pid}/reports`);
}

export function generateReport(
    pid: string,
    data: {
        period: string;
        format: string;
        evaluation_pids: string[];
        sections: string[];
    },
): Promise<PastReport> {
    return request<PastReport>(`/projects/${pid}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function reportDocumentUrl(pid: string, reportPid: string): string {
    return `${API_URL}/projects/${pid}/reports/${reportPid}/pdf`;
}

async function fetchReportDocument(pid: string, reportPid: string): Promise<Blob> {
    const res = await fetch(reportDocumentUrl(pid, reportPid));
    if (!res.ok) throw new Error(`cannot fetch report: ${res.status}`);
    return await res.blob();
}

/** Open the report in a new tab. Uses fetch so the auth token is attached
(browsers do not send Authorization on a plain navigation to the API). */
export async function openReportDocument(pid: string, reportPid: string): Promise<void> {
    const blob = await fetchReportDocument(pid, reportPid);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download the report through fetch (auth-friendly), not a plain anchor. */
export async function downloadReportDocument(
    pid: string,
    reportPid: string,
    format: string,
): Promise<void> {
    const blob = await fetchReportDocument(pid, reportPid);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportPid}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Keep only known section keys (anything else is dropped, never sent). */
export function cleanSections(sections: string[]): string[] {
    return sections.filter((s): s is ReportSection =>
        (REPORT_SECTIONS as readonly string[]).includes(s),
    );
}
