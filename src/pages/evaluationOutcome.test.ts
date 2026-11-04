// The Results page lists Failed runs as well as Done ones: the Tasks page leaves out Done and Failed, so
// without it a failure, its error and its log (an artifact) could not be reached.
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

    // On the card: the run's own page (PluginEvaluationMeasurements.tsx) is an upstream one, kept as master
    it("a failed run's card shows each plugin's error", () => {
        expect(read('PluginEvaluations.tsx')).toContain('pluginErrorText(plugin.error_message)');
    });
});

describe('a failed run stored with its whole log reads as its reason', () => {
    const logged = 'Plugin failed: ====== Step 1: Venv Creation ======\nUsing CPython 3.12.12\n\n\n' +
        '====== Step 2: Plugin Install ======\nResolved 71 packages in 990ms\n + aiohttp==3.14.5\n\n\n' +
        '====== Step 3: Plugin Run ======\n❌ Plugin execution failed: evaluator needs a judge model\n' +
        'Traceback (most recent call last):\n  File "plugin.py", line 293, in _run\n' +
        "aisc_plugin_strongreject_mijke.plugin.RunRefused: evaluator 'strongreject_rubric' needs a judge model: " +
        'bind one to the helper model \'Judge\', or choose evaluator=string_matching.\n\n\n';

    it('shows what the plugin said last, without the setup, the installs or the exception class', () => {
        expect(pluginErrorText(logged)).toBe(
            "Plugin failed: evaluator 'strongreject_rubric' needs a judge model: bind one to the helper model " +
            "'Judge', or choose evaluator=string_matching.");
    });

    it('cuts a reason that is still too long for a card', () => {
        const long = pluginErrorText('Plugin failed: ' + 'x'.repeat(2000))!;
        expect(long.length).toBeLessThanOrEqual(520);
        expect(long.endsWith('…')).toBe(true);
    });
});
