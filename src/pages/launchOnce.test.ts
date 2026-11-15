// A launch is sent once: the Launch button is off while a launch is on its way, and each click carries a key of its
// own (Idempotency-Key), so a double click or a retried request makes one run, not two.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type LaunchOnce = {
    launchInit: (body: unknown, key: string) => RequestInit;
    newLaunchKey: () => string;
};

async function launchOnce(): Promise<LaunchOnce | null> {
    const path = './launchOnce';
    try {
        return (await import(/* @vite-ignore */ path)) as LaunchOnce;
    } catch {
        return null;
    }
}

describe('a launch is sent once', () => {
    it('carries its own Idempotency-Key', async () => {
        const mod = await launchOnce();
        expect(mod, 'nothing gives a launch its key (./launchOnce)').not.toBeNull();
        const init = mod!.launchInit({ a: 1 }, 'k1');
        expect(init.method).toBe('POST');
        expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k1');
        expect(init.body).toBe('{"a":1}');
    });

    it('makes a new key per click, in the shape the engine takes', async () => {
        const mod = await launchOnce();
        expect(mod, 'nothing gives a launch its key (./launchOnce)').not.toBeNull();
        const a = mod!.newLaunchKey();
        const b = mod!.newLaunchKey();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    });
});

describe('the Launch button', () => {
    const page = readFileSync(join(__dirname, 'PluginStartEvaluation.tsx'), 'utf8');

    it('is off while a launch is sent', () => {
        expect(page).toMatch(/disabled=\{launching \|\|/);
        expect(page).toContain('setLaunching(true)');
        expect(page).toMatch(/finally\s*\{\s*setLaunching\(false\)/);
    });

    it('sends each click with a key of its own', () => {
        expect(page).toContain('launchInit(');
        expect(page).toContain('newLaunchKey()');
    });
});
