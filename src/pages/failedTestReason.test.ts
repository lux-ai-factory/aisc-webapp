// Every failed test on the Results page says why it failed, or says that no reason was recorded: a Failed test
// whose reason is empty is not hidden from the run's card.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as outcome from './evaluationOutcome';

type Reason = (plugin: { status?: string; error_message?: string | null }) => string | null;

function failedTestReason(): Reason {
    const found = (outcome as Record<string, unknown>).failedTestReason;
    expect(typeof found, 'evaluationOutcome has no failedTestReason').toBe('function');
    return found as Reason;
}

describe('every failed test says why', () => {
    it('shows its own reason', () => {
        expect(failedTestReason()({ status: 'Failed', error_message: 'Plugin failed: boom' })).toBe('Plugin failed: boom');
    });

    it('says no reason was recorded rather than hiding the test', () => {
        const reason = failedTestReason();
        expect(reason({ status: 'Failed', error_message: '' })).toBe('Failed, no reason recorded.');
        expect(reason({ status: 'Failed' })).toBe('Failed, no reason recorded.');
    });

    it('has nothing to say of a test that did not fail and has no error', () => {
        expect(failedTestReason()({ status: 'Done', error_message: '' })).toBeNull();
    });

    it('is what the run card shows', () => {
        const page = readFileSync(join(__dirname, 'PluginEvaluations.tsx'), 'utf8');
        expect(page).toContain('failedTestReason(plugin)');
    });
});
