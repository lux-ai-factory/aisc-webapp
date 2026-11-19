// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CeleryTasks from './CeleryTasks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, onRowClick }: { rows: { uuid: string; name: string }[]; onRowClick: (params: unknown) => void }) => <button onClick={() => onRowClick({ row: rows[0] })}>Open task</button>,
}));
vi.mock('../components/SideDrawer', () => ({ default: () => null }));

it('loads global tasks and details through Django monitoring endpoints', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ 'task-1': { state: 'SUCCESS', name: 'evaluation' } }) });
  vi.stubGlobal('fetch', fetchMock);
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<CeleryTasks />); });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/tasks\/monitoring$/);
    await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Open task')!.click(); });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/v1\/tasks\/monitoring\/task-1$/);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/flower'))).toBe(true);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
