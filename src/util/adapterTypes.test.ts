import { describe, expect, it } from 'vitest';
import { AdapterCatalogItem, AIComponent, InputAdapter, PluginInputDefinition } from '../models/models';
import {
    describeTypeHints,
    fileTypeCandidates,
    findCatalogAdapter,
    typeHintMatches,
    validateAdapterChain,
} from './adapterTypes';

const catalogAdapter = (
    adapter_class: string,
    input_types: string[] | null,
    output_type: string | null,
): AdapterCatalogItem => ({
    package_name: 'demo-pkg',
    version: '0.1.0',
    adapter_class,
    source: 'local',
    input_types,
    output_type,
});

const inputDefinition = (
    input_types: string[] | null,
    output_type: string | null = null,
): PluginInputDefinition => ({
    name: 'dataset',
    label: 'Dataset',
    input_type: 'dataset',
    required: true,
    input_types,
    output_type,
});

const component: AIComponent = {
    pid: 'comp-dataset',
    name: 'Dataset A',
    description: '',
    component_type: 'dataset',
    data: '1234-uuid.csv',
    file_size: 10,
};

const ref = (adapter_class: string): InputAdapter => ({
    adapter_class,
    package_name: 'demo-pkg',
    version: '0.1.0',
});

describe('typeHintMatches', () => {
    it('matches wildcard input patterns case-insensitively', () => {
        expect(typeHintMatches(['*.CSV'], '1234-uuid.csv')).toBe(true);
        expect(typeHintMatches(['pd.*'], 'PD.DataFrame')).toBe(true);
    });

    it('returns false for declared but incompatible types', () => {
        expect(typeHintMatches(['*.csv'], 'pd.dataframe')).toBe(false);
    });

    it('returns null when either side is unspecified', () => {
        expect(typeHintMatches(null, 'pd.dataframe')).toBeNull();
        expect(typeHintMatches(['pd.dataframe'], null)).toBeNull();
        expect(typeHintMatches([], 'pd.dataframe')).toBeNull();
    });

    it('accepts any of multiple expected patterns', () => {
        expect(typeHintMatches(['*.parquet', 'pd.dataframe'], 'pd.dataframe')).toBe(true);
    });
});

describe('fileTypeCandidates', () => {
    it('returns the filename and extension forms', () => {
        expect(fileTypeCandidates(component)).toEqual(['1234-uuid.csv', '.csv', 'csv']);
    });

    it('returns nothing when the component has no file', () => {
        expect(fileTypeCandidates({ ...component, data: '' })).toEqual([]);
    });
});

describe('findCatalogAdapter', () => {
    it('resolves by package, version, and class', () => {
        const item = catalogAdapter('Upper', ['*.csv'], 'bytes');
        expect(findCatalogAdapter([item], ref('Upper'))).toBe(item);
        expect(findCatalogAdapter([item], { ...ref('Upper'), version: '9.9.9' })).toBeUndefined();
    });
});

describe('describeTypeHints', () => {
    it('formats accepted inputs and produced output', () => {
        expect(describeTypeHints(catalogAdapter('Upper', ['*.csv', 'bytes'], 'bytes')))
            .toBe('accepts *.csv or bytes → produces bytes');
    });

    it('uses commas and a final or for longer type lists', () => {
        expect(describeTypeHints(catalogAdapter('Upper', ['*.txt', 'bytes', 'str'], 'bytes')))
            .toBe('accepts *.txt, bytes or str → produces bytes');
    });
});

describe('validateAdapterChain', () => {
    it('returns no warnings for a compatible chain', () => {
        const catalog = [
            catalogAdapter('ToDataFrame', ['*.csv'], 'pd.dataframe'),
            catalogAdapter('Clean', ['pd.dataframe'], 'pd.dataframe'),
        ];
        const warnings = validateAdapterChain({
            inputDefinition: inputDefinition(['pd.dataframe']),
            adapters: [ref('ToDataFrame'), ref('Clean')],
            catalog,
            selectedComponent: component,
        });
        expect(warnings).toEqual([]);
    });

    it('warns when an adapter output does not match the next adapter input', () => {
        const catalog = [
            catalogAdapter('ToDataFrame', ['*.csv'], 'pd.dataframe'),
            catalogAdapter('ToJson', ['dict'], 'dict'),
        ];
        const warnings = validateAdapterChain({
            inputDefinition: inputDefinition(['dict']),
            adapters: [ref('ToDataFrame'), ref('ToJson')],
            catalog,
            selectedComponent: component,
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0].stage).toBe('adapter');
        expect(warnings[0].message).toContain('pd.dataframe');
        expect(warnings[0].message).toContain('dict');
    });

    it('warns when the last adapter output does not match the provider input', () => {
        const catalog = [catalogAdapter('ToDataFrame', ['*.csv'], 'pd.dataframe')];
        const warnings = validateAdapterChain({
            inputDefinition: inputDefinition(['*.csv']),
            adapters: [ref('ToDataFrame')],
            catalog,
            selectedComponent: component,
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0].stage).toBe('input');
        expect(warnings[0].message).toContain('Dataset');
    });

    it('warns when a file is passed directly to an incompatible provider', () => {
        const warnings = validateAdapterChain({
            inputDefinition: inputDefinition(['pd.dataframe']),
            adapters: [],
            catalog: [],
            selectedComponent: component,
        });
        expect(warnings).toHaveLength(1);
        expect(warnings[0].stage).toBe('file');
        expect(warnings[0].message).toContain('Dataset A');
        expect(warnings[0].message).toContain('.csv');
        expect(warnings[0].message).not.toContain('1234-uuid.csv');
    });

    it('stays silent when hints are missing at a boundary', () => {
        const warnings = validateAdapterChain({
            inputDefinition: inputDefinition(['pd.dataframe']),
            adapters: [ref('Unknown')],
            catalog: [catalogAdapter('Unknown', null, null)],
            selectedComponent: component,
        });
        expect(warnings).toEqual([]);
    });
});
