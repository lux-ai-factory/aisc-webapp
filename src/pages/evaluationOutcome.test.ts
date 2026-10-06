// A failed run was listed nowhere: the Results page asked for Done runs only and the Tasks page leaves out
// Done and Failed, so a failure, its error and its log (an artifact) could not be reached (2026-10-07).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluationOutcome, finishedEvaluationUrls, pluginErrorText } from './evaluationOutcome';

describe('the Results page lists finished runs, failed ones included', () => {
    it('asks for Done and Failed, nothing archived or still running', () => {
        expect(finishedEvaluationUrls('/api/v1', 'p1')).toEqual([
            '/api/v1/projects/p1/evaluations?status=Done',
            '/api/v1/projects/p1/evaluations?status=Failed',
        ]);
    });

    it('says Failed for a failed run and Finished otherwise', () => {
        expect(evaluationOutcome({ status: 'Failed' })).toBe('Failed');
        expect(evaluationOutcome({ status: 'Done' })).toBe('Finished');
    });
});

describe('a plugin run error reads as words', () => {
    it('turns the engine validation answer into one line per problem', () => {
        const engine = JSON.stringify({ detail: [
            { type: 'string_too_long', loc: ['body', 'data', 'f29a', 1, 'description'],
              msg: 'String should have at most 255 characters' },
            { type: 'string_too_long', loc: ['body', 'data', 'f29a', 2, 'description'],
              msg: 'String should have at most 255 characters' },
        ] });
        expect(pluginErrorText(engine)).toBe(
            'measure 1, description: String should have at most 255 characters\n' +
            'measure 2, description: String should have at most 255 characters');
    });

    it('keeps any other error as it is, and has nothing to say without one', () => {
        expect(pluginErrorText('Traceback: boom')).toBe('Traceback: boom');
        expect(pluginErrorText(null)).toBeNull();
        expect(pluginErrorText('')).toBeNull();
    });
});

describe('the pages use them', () => {
    const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

    it('the Results page reads Done and Failed runs and labels a failed one', () => {
        const page = read('PluginEvaluations.tsx');
        expect(page).toContain('finishedEvaluationUrls(');
        expect(page).toContain('evaluationOutcome(');
        expect(page).not.toContain('evaluations?status=Done`');
    });

    // on the card: the run's own page (PluginEvaluationMeasurements.tsx) is one of Sean's, kept as master
    it("a failed run's card shows each plugin's error", () => {
        expect(read('PluginEvaluations.tsx')).toContain('pluginErrorText(plugin.error_message)');
    });
});
