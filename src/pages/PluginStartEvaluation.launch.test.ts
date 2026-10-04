// The button that starts an evaluation says what it does: it launches the run (Create Evaluation before).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('start evaluation button', () => {
    const page = readFileSync(join(__dirname, 'PluginStartEvaluation.tsx'), 'utf8');

    it('is labelled Launch Evaluation, button and tooltip', () => {
        expect(page).toMatch(/<Tooltip title="Launch Evaluation">/);
        expect(page).toMatch(/>\s*Launch Evaluation\s*</);
    });

    it('says create nowhere, errors included', () => {
        expect(page).not.toMatch(/create evaluation/i);
        expect(page).toContain('Failed to launch evaluation');
    });
});
