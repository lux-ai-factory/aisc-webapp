import { expect, it } from 'vitest';
import { computeYDomainFromVisible } from './ChartUtils';

it('computes bounds for large result sets without spreading arguments', () => {
    expect(computeYDomainFromVisible([{ id: 'large', label: 'large', data: Array.from({ length: 200_000 }, (_, i) => i) }], []))
        .toEqual({ yMin: -19999.9, yMax: 219998.9 });
    expect(computeYDomainFromVisible([{ id: 'hidden', label: 'hidden', data: [99] }], ['hidden']))
        .toEqual({ yMin: 0, yMax: 1 });
});
