import { AdapterCatalogItem, AIComponent, InputAdapter, PluginInputDefinition } from '../models/models.tsx';

export interface AdapterChainWarning {
    stage: 'file' | 'adapter' | 'input';
    index?: number;
    message: string;
}

const normalizeType = (value: string): string => value.trim().toLowerCase();

const globToRegExp = (pattern: string): RegExp => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`, 'i');
};

export const typeHintMatches = (
    expectedInputTypes: string[] | null | undefined,
    actualOutputTypes: string | string[] | null | undefined,
): boolean | null => {
    const patterns = (expectedInputTypes ?? []).map(normalizeType).filter(Boolean);
    const actuals = (Array.isArray(actualOutputTypes) ? actualOutputTypes : [actualOutputTypes])
        .map(value => (value == null ? '' : normalizeType(String(value))))
        .filter(Boolean);

    if (patterns.length === 0 || actuals.length === 0) return null;

    return patterns.some(pattern =>
        actuals.some(actual => globToRegExp(pattern).test(actual)),
    );
};

export const fileTypeCandidates = (component: AIComponent | null | undefined): string[] => {
    if (!component?.data) return [];

    const fileName = component.data.split(/[\\/]/).pop() ?? component.data;
    const extensionIndex = fileName.lastIndexOf('.');
    const extension = extensionIndex >= 0 ? fileName.slice(extensionIndex) : '';
    const bareExtension = extension.replace(/^\./, '');

    return [fileName, extension, bareExtension].filter(Boolean);
};

export const findCatalogAdapter = (
    catalog: AdapterCatalogItem[] | undefined,
    adapter: InputAdapter,
): AdapterCatalogItem | undefined => {
    return catalog?.find(item =>
        item.adapter_class === adapter.adapter_class
        && (adapter.package_name == null || item.package_name === adapter.package_name)
        && (adapter.version == null || item.version === adapter.version),
    );
};

export const formatTypeList = (types: string[] | null | undefined): string => {
    const values = (types ?? []).map(typeName => typeName.trim()).filter(Boolean);
    if (values.length === 0) return 'an unspecified type';
    if (values.length === 1) return values[0];
    return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
};

export const describeTypeHints = (
    hints: Pick<AdapterCatalogItem, 'input_types' | 'output_type'> | null | undefined,
): string => {
    const inputTypes = (hints?.input_types ?? []).map(typeName => typeName.trim()).filter(Boolean);
    const outputType = hints?.output_type?.trim();
    const parts: string[] = [];
    if (inputTypes.length > 0) parts.push(`accepts ${formatTypeList(inputTypes)}`);
    if (outputType) parts.push(`produces ${outputType}`);
    return parts.join(' → ');
};

const formatFileType = (candidates: string[]): string => {
    return candidates.find(candidate => candidate.startsWith('.')) ?? 'an unknown type';
};

const formatProducedType = (typeName: string | null | undefined): string => {
    const value = typeName?.trim();
    return value ? `"${value}"` : 'an unspecified type';
};

export const validateAdapterChain = ({
    inputDefinition,
    adapters,
    catalog,
    selectedComponent,
}: {
    inputDefinition: PluginInputDefinition;
    adapters: InputAdapter[];
    catalog?: AdapterCatalogItem[];
    selectedComponent?: AIComponent | null;
}): AdapterChainWarning[] => {
    const warnings: AdapterChainWarning[] = [];
    const label = inputDefinition.label || inputDefinition.name;
    const fileCandidates = fileTypeCandidates(selectedComponent);
    const resolved = adapters.map(adapter => ({
        adapter,
        hints: findCatalogAdapter(catalog, adapter),
    }));

    if (resolved.length === 0) {
        const compatible = typeHintMatches(inputDefinition.input_types, fileCandidates);
        if (compatible === false) {
            warnings.push({
                stage: 'file',
                message: `File "${selectedComponent?.name ?? 'selected file'}" looks like ${formatFileType(fileCandidates)}, but input "${label}" expects ${formatTypeList(inputDefinition.input_types)}.`,
            });
        }
        return warnings;
    }

    const first = resolved[0];
    const firstCompatible = typeHintMatches(first.hints?.input_types, fileCandidates);
    if (firstCompatible === false) {
        warnings.push({
            stage: 'file',
            index: 0,
            message: `File "${selectedComponent?.name ?? 'selected file'}" looks like ${formatFileType(fileCandidates)}, but "${first.adapter.adapter_class}" expects ${formatTypeList(first.hints?.input_types)}.`,
        });
    }

    for (let index = 1; index < resolved.length; index += 1) {
        const previous = resolved[index - 1];
        const current = resolved[index];
        const compatible = typeHintMatches(current.hints?.input_types, previous.hints?.output_type);
        if (compatible === false) {
            warnings.push({
                stage: 'adapter',
                index,
                message: `"${previous.adapter.adapter_class}" produces ${formatProducedType(previous.hints?.output_type)}, but "${current.adapter.adapter_class}" expects ${formatTypeList(current.hints?.input_types)}.`,
            });
        }
    }

    const last = resolved[resolved.length - 1];
    const providerCompatible = typeHintMatches(inputDefinition.input_types, last.hints?.output_type);
    if (providerCompatible === false) {
        warnings.push({
            stage: 'input',
            index: resolved.length - 1,
            message: `"${last.adapter.adapter_class}" produces ${formatProducedType(last.hints?.output_type)}, but input "${label}" expects ${formatTypeList(inputDefinition.input_types)}.`,
        });
    }

    return warnings;
};
