// WP13 (pipeline 2026-09-23, 03-specs.md): webapp undo of e36fed4.
// Tests first. The implementation deletes SystemVersionBanner.tsx and its test,
// and returns AISystemSettings.tsx to Sean's 429f62c content.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repo = resolve(__dirname, '..');
const src = resolve(repo, 'src');
const SELF = resolve(__filename);

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

describe('WP13 webapp undo', () => {
    it('S13.1 no file under src mentions "frozen" (grep -ri frozen src)', () => {
        const hits = walk(src)
            .filter((p) => p !== SELF)
            .filter((p) => /frozen/i.test(readFileSync(p, 'utf8')))
            .map((p) => p.slice(repo.length + 1));
        expect(hits).toEqual([]);
    });

    it("S13.2 AISystemSettings.tsx is byte-identical to Sean's 429f62c", () => {
        const ref = execFileSync('git', ['show', '429f62c:src/components/AISystemSettings.tsx'], {
            cwd: repo,
        });
        const now = readFileSync(join(src, 'components/AISystemSettings.tsx'));
        expect(now.equals(ref)).toBe(true);
    });

    it('S13.2 SystemVersionBanner is gone', () => {
        const names = walk(src).map((p) => p.slice(src.length + 1));
        expect(names.filter((n) => n.includes('SystemVersionBanner'))).toEqual([]);
    });
});
