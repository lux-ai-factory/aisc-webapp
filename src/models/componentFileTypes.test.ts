import { it, expect } from 'vitest';
import { COMPONENT_FILE_EXTENSIONS, acceptFor } from './componentFileTypes';

// The engine refuses a component file whose extension its type does not take (415); the pickers
// offer only those, so the refusal is never the first thing a person learns.

it('a dataset is one of the engine\'s dataset extensions', () => {
    expect([...COMPONENT_FILE_EXTENSIONS.dataset].sort())
        .toEqual(['.csv', '.json', '.jsonl', '.parquet', '.tsv', '.zip']);
});

it('a model is one of the engine\'s model extensions', () => {
    expect([...COMPONENT_FILE_EXTENSIONS.model].sort())
        .toEqual(['.h5', '.joblib', '.keras', '.onnx', '.pkl', '.pt', '.pth', '.safetensors', '.zip']);
});

it('the picker of a type lists its extensions', () => {
    expect(acceptFor('dataset')).toBe('.csv,.tsv,.parquet,.json,.jsonl,.zip');
    expect(acceptFor('model').split(',')).toContain('.safetensors');
});

it('a type without a file accepts nothing in particular', () => {
    expect(acceptFor('llm')).toBeUndefined();
});
