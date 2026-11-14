import type { AIComponentType } from './models';

/** The file extensions the engine takes for each component type with a file (its component.EXTENSIONS);
 *  it refuses any other with 415. */
export const COMPONENT_FILE_EXTENSIONS: Partial<Record<AIComponentType, readonly string[]>> = {
    dataset: ['.csv', '.tsv', '.parquet', '.json', '.jsonl', '.zip'],
    model: ['.onnx', '.pkl', '.joblib', '.pt', '.pth', '.safetensors', '.h5', '.keras', '.zip'],
};

/** A file picker's accept value for a component type: its extensions, or nothing for a type without a file. */
export const acceptFor = (type: AIComponentType): string | undefined => COMPONENT_FILE_EXTENSIONS[type]?.join(',');
