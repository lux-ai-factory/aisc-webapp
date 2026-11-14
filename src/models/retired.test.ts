import { it, expect } from 'vitest';
import { inUse, isRetired } from './retired';
import { AIComponent } from './models';

const c = (pid: string, retired_at: string | null = null) =>
    ({ pid, name: pid, description: '', component_type: 'dataset', data: '', file_size: null, retired_at }) as AIComponent;

it('a component with a retired date is retired', () => {
    expect(isRetired(c('a', '2026-11-12T17:00:00Z'))).toBe(true);
    expect(isRetired(c('b'))).toBe(false);
});

it('only components in use are offered', () => {
    expect(inUse([c('a', '2026-11-12T17:00:00Z'), c('b')]).map(x => x.pid)).toEqual(['b']);
});
