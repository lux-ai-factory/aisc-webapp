import { expect, it, vi } from 'vitest';
import { uploadReportCharts, type RenderedDashboardWidget } from './reportCharts';
import { uploadReportChart } from './report';
vi.mock('./report', () => ({ uploadReportChart: vi.fn() }));

it('builds ordered artifact-only payloads without mutating render results', async () => {
    vi.mocked(uploadReportChart).mockImplementation(async (_pid, _report, image) => `artifact:${image}`);
    const dashboard: RenderedDashboardWidget[] = [
        { key: 'a', kind: 'chart', image: 'one', comment: 'note' },
        { key: 'b', kind: 'text', text: '' },
    ];
    const evaluations = [{ evaluation_pid: 'e', evaluation_plugin_pid: 'p', visualization_index: 0,
        panels: [{ image: 'two', label: 'en' }] }];
    const before = JSON.stringify({ dashboard, evaluations });
    const payload = await uploadReportCharts('project', 'report', dashboard, evaluations);
    expect(payload.dashboard).toEqual([
        { key: 'a', kind: 'chart', artifact_id: 'artifact:one', comment: 'note' }, dashboard[1],
    ]);
    expect(payload.evaluation_charts[0].panels).toEqual([{ artifact_id: 'artifact:two', label: 'en' }]);
    expect(JSON.stringify(payload)).not.toContain('"image"');
    expect(JSON.stringify({ dashboard, evaluations })).toBe(before);
});

it('shares the four-upload limit and drains jobs after a failure', async () => {
    const releases: Array<() => void> = [];
    vi.mocked(uploadReportChart).mockImplementation((_pid, _report, image) => new Promise((resolve, reject) => {
        releases.push(() => image === '0' ? reject(new Error('failed')) : resolve(image));
    }));
    const dashboard: RenderedDashboardWidget[] = [0, 1, 2].map((i) => ({ key: String(i), kind: 'chart', image: String(i) }));
    const evaluations = [{ evaluation_pid: 'e', evaluation_plugin_pid: 'p', visualization_index: 0,
        panels: [3, 4, 5].map((i) => ({ image: String(i) })) }];
    let finished = false;
    const pending = uploadReportCharts('project', 'report', dashboard, evaluations);
    const rejected = expect(pending).rejects.toThrow('failed');
    void pending.catch(() => { finished = true; });
    expect(releases).toHaveLength(4);
    releases[0]();
    await vi.waitFor(() => expect(releases).toHaveLength(5));
    expect(finished).toBe(false);
    releases[1]();
    await vi.waitFor(() => expect(releases).toHaveLength(6));
    releases.slice(2).forEach((release) => release());
    await rejected;
});
