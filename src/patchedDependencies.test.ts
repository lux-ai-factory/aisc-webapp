// Shipped dependencies are past the releases npm audit reports as high (review 2026-10-06): each
// installed version must be above the top of its vulnerable range.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** package: the highest vulnerable version (npm audit --omit=dev, 2026-10-06) */
const VULNERABLE_UP_TO: Record<string, string> = {
  axios: '1.19.0',
  'fast-uri': '3.1.7',
  'form-data': '4.0.5',
  'react-router': '7.18.1',
  'react-router-dom': '7.14.1',
};

function parts(version: string): number[] {
  return version.split('-')[0].split('.').map((n) => Number.parseInt(n, 10));
}

function above(installed: string, ceiling: string): boolean {
  const a = parts(installed);
  const b = parts(ceiling);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

describe('patched dependencies', () => {
  for (const [name, ceiling] of Object.entries(VULNERABLE_UP_TO)) {
    it(`${name} is above ${ceiling}`, () => {
      const installed = (require(`${name}/package.json`) as { version: string }).version;
      expect(above(installed, ceiling), `${name} ${installed}`).toBe(true);
    });
  }
});
