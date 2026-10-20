// In AISC the report is the report composer (step 6, /report-composer). The engine's own report links went
// to /report/generate, which nothing serves in the AISC stack, so they are gone from the whole app.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sources(path);
        return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
}

describe('no engine report links', () => {
    const files = sources(join(__dirname, '..'));

    it('finds the sources it checks', () => {
        expect(files.some((f) => f.endsWith('PluginEvaluations.tsx'))).toBe(true);
    });

    it.each(['/report/generate', 'VITE_REPORT_URL', 'REPORT_URL', 'Download Report', 'Download report for this evaluation'])(
        'no source mentions %s',
        (needle) => {
            const hits = files.filter((f) => readFileSync(f, 'utf8').includes(needle));
            expect(hits).toEqual([]);
        },
    );
});
