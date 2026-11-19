import { API_VERSION_PREFIX } from '../config';
import type { SystemVersion } from './qualification';

export const REPORT_SECTIONS = ['system', 'controls', 'objectives', 'evaluations'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** Output formats the composer offers, and the ones the API accepts. */
export const REPORT_FORMATS = ['pdf', 'docx'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export interface ReportSettings {
    pid: string;
    default_format: string;
    default_sections: string[];
    report_title: string;
    subtitle: string;
    primary_color: string;
    accent_color: string;
    font: string;
    font_size_pt: number;
    header_text: string;
    footer_text: string;
    marking: string;
    show_document_id: boolean;
    logo: { mime: string; data_base64: string } | null;
    updated_by: string;
}

export interface PastReport {
    pid: string;
    project_id: string;
    period: string;
    version?: number;
    format: string;
    file_ref: string;
    status: string;
    created_at: string;
    /** The AI-card version the report snapshots (REP-01); null if none existed. */
    system_version?: { pid?: string; number?: number; name?: string | null } | null;
    layout_id?: string | null;
    layout_revision?: number | null;
    snapshot_checksum?: string;
    document_checksum?: string;
    /** the selected evaluations (empty = the whole project) */
    evaluations?: Array<{ pid: string; status?: string; task?: string | null }>;
}

export interface ReportBlock {
    instance_id: string;
    block_type: string;
    options: Record<string, unknown>;
}

export interface ReportLayout {
    id: string;
    name: string;
    description: string;
    blocks: ReportBlock[];
    show_index: boolean;
    numbering: boolean;
    revision: number;
    built_in: boolean;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface BlockOptionSpec {
    type: string;
    default?: unknown;
    enum?: string[];
    label?: string;
}

export interface BlockType {
    type_id: string;
    label: string;
    group: string;
    options_schema: { properties: Record<string, BlockOptionSpec> };
    default_options: Record<string, unknown>;
}

export interface BlockTypeGroup {
    group: string;
    types: BlockType[];
}

export interface OutlineRow {
    instance_id: string;
    block_type: string;
    label: string;
    number: string;
    kind: string;
    empty?: boolean;
}

export interface LayoutPreview {
    html: string;
    outline: OutlineRow[];
    layout: { id: string; name: string; show_index: boolean; numbering: boolean };
}

export interface ReportSnapshotView {
    snapshot: Record<string, unknown>;
    snapshot_checksum: string;
    document_checksum: string;
    format: string;
}

export interface ReportSettingsPayload {
    default_format: string;
    default_sections: string[];
    report_title: string;
    subtitle: string;
    primary_color: string;
    accent_color: string;
    font: string;
    font_size_pt: number;
    header_text: string;
    footer_text: string;
    marking: string;
    show_document_id: boolean;
    logo: { mime: string; data_base64: string } | null;
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
    data: ReportSettingsPayload,
): Promise<ReportSettings> {
    return request<ReportSettings>(`/projects/${pid}/report-settings`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function listReports(pid: string): Promise<PastReport[]> {
    return request<PastReport[]>(`/projects/${pid}/reports`);
}

export function getReportSnapshot(pid: string, reportPid: string): Promise<ReportSnapshotView> {
    return request<ReportSnapshotView>(`/projects/${pid}/reports/${reportPid}/snapshot`);
}

export function listSystemVersions(pid: string): Promise<SystemVersion[]> {
    return request<SystemVersion[]>(`/projects/${pid}/system-versions`);
}

// --- layouts and blocks ---------------------------------------------------------

export function getReportBlockTypes(
    pid: string,
): Promise<{ groups: BlockTypeGroup[]; max_blocks: number }> {
    return request<{ groups: BlockTypeGroup[]; max_blocks: number }>(
        `/projects/${pid}/report-block-types`,
    );
}

export function listReportLayouts(pid: string): Promise<ReportLayout[]> {
    return request<ReportLayout[]>(`/projects/${pid}/report-layouts`);
}

export function createReportLayout(
    pid: string,
    data: {
        name: string;
        description?: string;
        blocks: ReportBlock[];
        show_index?: boolean;
        numbering?: boolean;
    },
): Promise<ReportLayout> {
    return request<ReportLayout>(`/projects/${pid}/report-layouts`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function updateReportLayout(
    pid: string,
    layoutId: string,
    data: {
        name: string;
        description?: string;
        blocks: ReportBlock[];
        show_index?: boolean;
        numbering?: boolean;
    },
): Promise<ReportLayout> {
    return request<ReportLayout>(`/projects/${pid}/report-layouts/${layoutId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function deleteReportLayout(pid: string, layoutId: string): Promise<void> {
    return request<void>(`/projects/${pid}/report-layouts/${layoutId}`, { method: 'DELETE' });
}

export function duplicateReportLayout(pid: string, layoutId: string, name = ''): Promise<ReportLayout> {
    return request<ReportLayout>(`/projects/${pid}/report-layouts/${layoutId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    });
}

export function exportReportLayout(pid: string, layoutId: string): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`/projects/${pid}/report-layouts/${layoutId}/export`);
}

export function importReportLayout(pid: string, file: Record<string, unknown>): Promise<ReportLayout> {
    return request<ReportLayout>(`/projects/${pid}/report-layouts/import`, {
        method: 'POST',
        body: JSON.stringify(file),
    });
}

export function previewReportLayout(
    pid: string,
    layoutId: string,
    data: { version_pid?: string; period?: string; blocks?: ReportBlock[] } = {},
): Promise<LayoutPreview> {
    return request<LayoutPreview>(`/projects/${pid}/report-layouts/${layoutId}/preview`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function generateReport(
    pid: string,
    data: {
        period: string;
        format: string;
        evaluation_pids: string[];
        sections: string[];
        layout_id?: string;
        version_pid?: string;
        other_versions?: boolean;
        compare_to?: string;
    },
): Promise<PastReport> {
    return request<PastReport>(`/projects/${pid}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export function deleteReport(pid: string, reportPid: string): Promise<void> {
    return request<void>(`/projects/${pid}/reports/${reportPid}`, { method: 'DELETE' });
}

export function reportDocumentUrl(pid: string, reportPid: string): string {
    return `${API_URL}/projects/${pid}/reports/${reportPid}/pdf`;
}

export function reportDownloadUrl(pid: string, reportPid: string): string {
    return `${API_URL}/projects/${pid}/reports/${reportPid}/download`;
}

async function fetchReportDocument(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cannot fetch report: ${res.status}`);
    return await res.blob();
}

/** Open the report's PDF in a new tab. Uses fetch so the auth token is attached
(browsers do not send Authorization on a plain navigation to the API). */
export async function openReportDocument(pid: string, reportPid: string): Promise<void> {
    const blob = await fetchReportDocument(reportDocumentUrl(pid, reportPid));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download the report's primary document (PDF or Word) through fetch. */
export async function downloadReportDocument(
    pid: string,
    reportPid: string,
    format: string,
): Promise<void> {
    const blob = await fetchReportDocument(reportDownloadUrl(pid, reportPid));
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
