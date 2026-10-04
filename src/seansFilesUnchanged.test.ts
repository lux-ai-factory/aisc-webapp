import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const UNCHANGED = [
  'src/api/api.tsx', 'src/components/AISystemSettings.tsx', 'src/components/EvaluationProgressList.tsx',
  'src/components/GenericTextDataGrid.tsx', 'src/components/SummaryTable.tsx', 'src/components/UploadFileField.tsx',
  'src/components/plugin/CSVDataGridChart.tsx', 'src/components/plugin/ConfigHistory.tsx',
  'src/components/plugin/PluginConfigForm.tsx', 'src/components/plugin/PluginEvaluationForm.tsx',
  // PluginEvaluations.tsx is not on this list: its report links went to /report, which the AISC stack
  // never serves (the report is the report composer), so they were removed (PluginEvaluations.noReport.test.ts).
  'src/pages/PluginEvaluationMeasurements.tsx', 'src/pages/PluginEvaluationsTasks.tsx',
  // PluginStartEvaluation.tsx is not on this list either: its button says Launch Evaluation, not Create
  // Evaluation (PluginStartEvaluation.launch.test.ts).
  'src/pages/PluginsConfig.tsx', 'src/pages/Settings.tsx', 'src/pages/StartEvaluation.tsx',
];
const master = (p: string) => { try { return execFileSync('git', ['show', `origin/master:${p}`], { encoding: 'utf8' }); } catch { return null; } };

describe("Sean's files the configurator no longer edits", () => {
  it.skipIf(master('package.json') === null)('each equals master', () => {
    for (const p of UNCHANGED) expect(readFileSync(p, 'utf8'), p).toBe(master(p));
  });
  it('no source file outside src/api imports apiFetch or apiAxios', () => {
    const files = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split('\n')
      .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('src/api/') && !/\.test\.tsx?$/.test(f));
    const users = files.filter((f) => /\b(apiFetch|apiAxios)\b/.test(readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });
});
