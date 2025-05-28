/** Dictionary type for mapping original names to display names */
type NameDictionary = { [key: string]: string };

/**
 * Maps an array of names using a dictionary
 * @param names - Array of original names to map
 * @param dictionary - Dictionary containing name mappings
 * @returns Array of mapped names, using original name if no mapping exists
 */
function mapNames(names: string[], dictionary: NameDictionary): string[] {
    return names.map(name => dictionary[name] || name);
}

/** Dictionary mapping metric names to their display names */
const metricNames: NameDictionary = {
    "mcc": "MCC",
    "test_get_metric": "Testing metric",
    "accuracy": "Accuracy"
};

/**
 * Maps metric names to their display names
 * @param metrics - Single metric name or array of metric names
 * @returns Mapped metric name(s) using the metricNames dictionary
 */
export function mapMetricsNames(metrics: string[] | string): string[] | string {
    if (typeof metrics === 'string') {
        return mapNames([metrics], metricNames)[0];
    }
    return mapNames(metrics, metricNames);
}

/**
 * Maps a single metric name to its display name
 * @param metrics - Single metric name to map
 * @returns Mapped metric name using the metricNames dictionary
 */
export function mapMetricsName(metrics: string): string {
    return mapNames([metrics], metricNames)[0];
}